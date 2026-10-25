import { Hono } from 'hono'
import { eq, and, gte, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { mealPlan, recipes, ingredients, nutrition } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { expandRecurrenceRule, type RecurrenceRule } from '../lib/recurrence.js'
import { broadcastToFamily } from '../lib/ws.js'
import { chatSuggestMeal, withNutrition, estimateNoteCalories } from '../lib/ai.js'
import { scoreLibraryRecipes } from '../lib/classify.js'
import type { AppEnv } from '../types.js'

export const mealPlanRoutes = new Hono<AppEnv>()
mealPlanRoutes.use('*', authMiddleware)

// D1 caps bound parameters at 100 per statement. The meal_plan table has 11
// columns, so we can safely insert floor(99/13) = 7 rows per statement.
const MEAL_PLAN_COLS = 13
const CHUNK_SIZE = Math.max(1, Math.floor(99 / MEAL_PLAN_COLS)) // 7

function inChunks<T>(arr: T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += CHUNK_SIZE) result.push(arr.slice(i, i + CHUNK_SIZE))
  return result
}

mealPlanRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ entries: [] })

  const start = c.req.query('start')
  const end = c.req.query('end')

  let entries = await db.query.mealPlan.findMany({
    where: eq(mealPlan.familyId, familyId),
  })

  if (start) entries = entries.filter((e) => e.date >= start)
  if (end) entries = entries.filter((e) => e.date <= end)
  entries.sort((a, b) => a.date.localeCompare(b.date))

  const withRecipes = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.recipeId) return entry
      const [recipe, nut] = await Promise.all([
        db.query.recipes.findFirst({
          where: eq(recipes.id, entry.recipeId),
          columns: { id: true, title: true, pictureUrl: true, prepTime: true, cookTime: true },
        }),
        db.query.nutrition.findFirst({ where: eq(nutrition.recipeId, entry.recipeId), columns: { calories: true } }),
      ])
      return { ...entry, recipe: recipe ? { ...recipe, calories: nut?.calories ?? null } : null }
    })
  )

  return c.json({ entries: withRecipes })
})

const mealPlanBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealLabel: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  recipeId: z.string().nullable().optional(),
  noteText: z.string().nullable().optional(),
  calories: z.number().int().min(0).max(10000).nullable().optional(),
  dayNote: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().nullable().optional(),
})

const mealPlanCreateSchema = mealPlanBodySchema.extend({ sideOf: z.string().nullable().optional() })

/** Sides live and die with the entry they belong to. */
async function deleteSidesOf(db: AppEnv['Variables']['db'], ids: string[]) {
  for (let i = 0; i < ids.length; i += 50) {
    await db.delete(mealPlan).where(inArray(mealPlan.sideOf, ids.slice(i, i + 50)))
  }
}

mealPlanRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = mealPlanCreateSchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { recipeId, noteText, dayNote } = result.data
  let { date, mealLabel, isRecurring, recurrenceRule } = result.data
  const sideOf = result.data.sideOf ?? null
  if (sideOf) {
    // A side sits in its meal's day and slot and never repeats on its own.
    const parent = await db.query.mealPlan.findFirst({ where: eq(mealPlan.id, sideOf) })
    if (!parent || parent.familyId !== familyId || parent.sideOf) {
      return c.json({ error: { code: 'validation_error', message: 'Meal not found' } }, 400)
    }
    date = parent.date
    mealLabel = parent.mealLabel
    isRecurring = false
    recurrenceRule = null
  }

  // Notes carry their own calorie figure: the user's, or an AI estimate when none was given.
  const calories = recipeId ? null
    : result.data.calories !== undefined ? result.data.calories
    : noteText?.trim() ? await estimateNoteCalories(noteText, c.env.AI_GATEWAY_API_KEY) : null

  const entryId = crypto.randomUUID()
  const [entry] = await db.insert(mealPlan).values({
    id: entryId, familyId, date, mealLabel,
    recipeId: recipeId ?? null, noteText: noteText ?? null, calories, dayNote: dayNote ?? null, sideOf,
    isRecurring: isRecurring ?? false, recurrenceRule: recurrenceRule ?? null,
    parentId: null, createdBy: userId,
  }).returning()

  if (isRecurring && recurrenceRule) {
    try {
      const rule: RecurrenceRule = JSON.parse(recurrenceRule)
      const futureDates = expandRecurrenceRule(rule, date)
      if (futureDates.length > 0) {
        const rows = futureDates.map((d) => ({
          familyId, date: d, mealLabel,
          recipeId: recipeId ?? null, noteText: noteText ?? null, calories,
          isRecurring: true, recurrenceRule, parentId: entryId, createdBy: userId,
        }))
        for (const chunk of inChunks(rows)) {
          await db.insert(mealPlan).values(chunk)
        }
      }
    } catch { /* invalid rule JSON */ }
  }

  if (recipeId) {
    const existing = await db.query.recipes.findFirst({ where: eq(recipes.id, recipeId) })
    if (existing) {
      await db.update(recipes).set({
        lastPreparedAt: date,
        preparedCount: existing.preparedCount + 1,
      }).where(eq(recipes.id, recipeId))
    }
  }

  await broadcastToFamily(c.env.FAMILY_ROOM, familyId, { type: 'meal-plan:updated', familyId })
  return c.json({ entry }, 201)
})

mealPlanRoutes.patch('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  const scope = c.req.query('scope') ?? 'one'

  const body = await c.req.json().catch(() => null)
  const result = mealPlanBodySchema.partial().safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid data' } }, 400)

  const entry = await db.query.mealPlan.findFirst({ where: eq(mealPlan.id, id) })
  if (!entry || entry.familyId !== familyId) {
    return c.json({ error: { code: 'not_found', message: 'Entry not found' } }, 404)
  }

  // Changing a note's text re-estimates its calories (unless the caller supplied a figure); a recipe has none of its own.
  const update = { ...result.data }
  const finalRecipeId = update.recipeId !== undefined ? update.recipeId : entry.recipeId
  if (finalRecipeId) update.calories = null
  else if (update.calories === undefined && update.noteText != null && update.noteText !== entry.noteText) {
    update.calories = update.noteText.trim() ? await estimateNoteCalories(update.noteText, c.env.AI_GATEWAY_API_KEY) : null
  }

  if (scope === 'series' && entry.parentId) {
    const allSeries = await db.query.mealPlan.findMany({
      where: and(eq(mealPlan.parentId, entry.parentId), gte(mealPlan.date, entry.date)),
    })
    if (update.mealLabel) {
      for (const sid of [id, ...allSeries.map((e) => e.id)]) {
        await db.update(mealPlan).set({ mealLabel: update.mealLabel }).where(eq(mealPlan.sideOf, sid))
      }
    }
    await Promise.all([
      db.update(mealPlan).set(update).where(eq(mealPlan.id, id)),
      ...allSeries.map((e) => db.update(mealPlan).set(update).where(eq(mealPlan.id, e.id))),
    ])
  } else {
    await db.update(mealPlan).set(update).where(eq(mealPlan.id, id))
    if (update.mealLabel) await db.update(mealPlan).set({ mealLabel: update.mealLabel }).where(eq(mealPlan.sideOf, id))
  }

  // Recalculate future recurring entries whenever the recurrence settings change.
  // The POST handler creates future rows on insert; PATCH must mirror that logic.
  const newIsRecurring = result.data.isRecurring ?? entry.isRecurring
  const newRecurrenceRule = result.data.recurrenceRule !== undefined
    ? result.data.recurrenceRule
    : entry.recurrenceRule

  // Always wipe existing children first — handles rule changes and turning off recurrence.
  const children = await db.query.mealPlan.findMany({ where: eq(mealPlan.parentId, id), columns: { id: true } })
  await deleteSidesOf(db, children.map((e) => e.id))
  await db.delete(mealPlan).where(eq(mealPlan.parentId, id))

  if (newIsRecurring && newRecurrenceRule) {
    try {
      const rule: RecurrenceRule = JSON.parse(newRecurrenceRule)
      const futureDates = expandRecurrenceRule(rule, entry.date)
      if (futureDates.length > 0) {
        const rows = futureDates.map((d) => ({
          familyId: entry.familyId,
          date: d,
          mealLabel: result.data.mealLabel ?? entry.mealLabel,
          recipeId: result.data.recipeId !== undefined ? result.data.recipeId : entry.recipeId,
          noteText: result.data.noteText !== undefined ? result.data.noteText : entry.noteText,
          calories: finalRecipeId ? null : update.calories !== undefined ? update.calories : entry.calories,
          isRecurring: true as const,
          recurrenceRule: newRecurrenceRule,
          parentId: id,
          createdBy: entry.createdBy,
        }))
        for (const chunk of inChunks(rows)) {
          await db.insert(mealPlan).values(chunk)
        }
      }
    } catch { /* invalid rule JSON — skip expansion */ }
  }

  const updated = await db.query.mealPlan.findFirst({ where: eq(mealPlan.id, id) })
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'meal-plan:updated', familyId: familyId! })
  return c.json({ entry: updated })
})

mealPlanRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  const scope = c.req.query('scope') ?? 'one'

  const entry = await db.query.mealPlan.findFirst({ where: eq(mealPlan.id, id) })
  if (!entry || entry.familyId !== familyId) {
    return c.json({ error: { code: 'not_found', message: 'Entry not found' } }, 404)
  }

  if (scope === 'series' && entry.parentId) {
    const series = await db.query.mealPlan.findMany({
      where: and(eq(mealPlan.parentId, entry.parentId), gte(mealPlan.date, entry.date)),
      columns: { id: true },
    })
    await deleteSidesOf(db, series.map((e) => e.id))
    await db.delete(mealPlan).where(
      and(eq(mealPlan.parentId, entry.parentId), gte(mealPlan.date, entry.date))
    )
  }

  await deleteSidesOf(db, [id])
  await db.delete(mealPlan).where(eq(mealPlan.id, id))
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'meal-plan:updated', familyId: familyId! })
  return c.json({ ok: true })
})

const suggestBodySchema = z.object({
  mealLabel: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  shownRecipeIds: z.array(z.string()).optional(), // library recipes already offered this chat
  forceGenerate: z.boolean().optional(), // skip the library, write a new recipe
})

const LIBRARY_MIN_SCORE = 0.6
const LIBRARY_MAX_RESULTS = 3
const LIBRARY_POOL = 60
const MEAL_TYPES_FOR: Record<string, string[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch', 'dinner'],
  dinner: ['dinner', 'lunch'],
  snack: ['snack', 'dessert'],
}


async function findLibraryMatches(
  db: AppEnv['Variables']['db'],
  familyId: string,
  mealLabel: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  excludeIds: Set<string>,
  jevKey: string,
) {
  const allowed = MEAL_TYPES_FOR[mealLabel] ?? []
  const all = await db.query.recipes.findMany({ where: eq(recipes.familyId, familyId) })
  const pool = all
    .filter((r) => !excludeIds.has(r.id) && (r.mealType == null || allowed.includes(r.mealType)))
    .slice(0, LIBRARY_POOL)
  if (pool.length === 0) return []

  const ings: Array<{ recipeId: string; name: string }> = []
  for (let i = 0; i < pool.length; i += 50) {
    const rows = await db.query.ingredients.findMany({
      where: inArray(ingredients.recipeId, pool.slice(i, i + 50).map((r) => r.id)),
      columns: { recipeId: true, name: true },
    })
    ings.push(...rows)
  }
  const namesByRecipe = new Map<string, string[]>()
  for (const i of ings) namesByRecipe.set(i.recipeId, [...(namesByRecipe.get(i.recipeId) ?? []), i.name])

  const candidates = pool.map((r) => {
    const total = (r.prepTime ?? 0) + (r.cookTime ?? 0)
    const facts = [
      r.effort && `${r.effort} effort`,
      total > 0 && `${total} min`,
      r.protein && r.protein !== 'none' && `${r.protein}`,
      r.cuisine && `${r.cuisine.replace(/_/g, ' ')} cuisine`,
      r.kidFriendly && 'kid-friendly',
    ].filter(Boolean).join(', ')
    return { id: r.id, summary: `${r.title} (${facts}). Ingredients: ${(namesByRecipe.get(r.id) ?? []).slice(0, 12).join(', ')}` }
  })

  const conversation = messages.map((m) => `${m.role === 'user' ? 'Person' : 'Assistant'}: ${m.content}`).join('\n')
  const scores = await scoreLibraryRecipes(conversation, candidates, jevKey)
  const byId = new Map(pool.map((r) => [r.id, r]))
  return [...scores.entries()]
    .filter(([, score]) => score >= LIBRARY_MIN_SCORE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIBRARY_MAX_RESULTS)
    .map(([id]) => {
      const r = byId.get(id)!
      return {
        id: r.id, title: r.title, pictureUrl: r.pictureUrl, prepTime: r.prepTime, cookTime: r.cookTime,
        servings: r.servings, effort: r.effort, protein: r.protein,
      }
    })
}

mealPlanRoutes.post('/suggest', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = suggestBodySchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { mealLabel, messages, shownRecipeIds = [], forceGenerate } = result.data

  // Gather recent meal titles of the same type to avoid repetition
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const cutoff = twoWeeksAgo.toISOString().slice(0, 10)

  const recentEntries = await db.query.mealPlan.findMany({
    where: and(
      eq(mealPlan.familyId, familyId),
      gte(mealPlan.date, cutoff),
      eq(mealPlan.mealLabel, mealLabel),
    ),
  })

  const recentMeals: string[] = []
  const recentRecipeIds = new Set<string>()
  for (const entry of recentEntries) {
    if (entry.recipeId) recentRecipeIds.add(entry.recipeId)
    if (entry.noteText) recentMeals.push(entry.noteText)
    if (entry.recipeId) {
      const recipe = await db.query.recipes.findFirst({
        where: eq(recipes.id, entry.recipeId),
        columns: { title: true },
      })
      if (recipe) recentMeals.push(recipe.title)
    }
  }

  // Library first: Haiku only asks the questions; Jev then scores the family's own recipes against the
  // answers. A brand-new recipe is only written when nothing saved fits (or the user asks for one).
  let turn = await chatSuggestMeal(messages, recentMeals, c.env.ANTHROPIC_API_KEY, forceGenerate ? 'generate' : 'ask')

  if (turn.type === 'ready') {
    const matches = await findLibraryMatches(db, familyId, mealLabel, messages, new Set([...recentRecipeIds, ...shownRecipeIds]), c.env.TYPESAFE_API_KEY)
    if (matches.length) return c.json({ type: 'library', recipes: matches })
    turn = await chatSuggestMeal(messages, recentMeals, c.env.ANTHROPIC_API_KEY, 'generate')
  }

  if (turn.type === 'recipe') {
    turn.importResult = await withNutrition(turn.importResult, c.env.AI_GATEWAY_API_KEY)
  }
  return c.json(turn)
})
