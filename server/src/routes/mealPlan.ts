import { Hono } from 'hono'
import { eq, and, gte } from 'drizzle-orm'
import { z } from 'zod'
import { mealPlan, recipes } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { expandRecurrenceRule, type RecurrenceRule } from '../lib/recurrence.js'
import { broadcastToFamily } from '../lib/ws.js'
import { chatSuggestMeal, withNutrition } from '../lib/ai.js'
import type { AppEnv } from '../types.js'

export const mealPlanRoutes = new Hono<AppEnv>()
mealPlanRoutes.use('*', authMiddleware)

// D1 caps bound parameters at 100 per statement. The meal_plan table has 11
// columns, so we can safely insert floor(99/11) = 9 rows per statement.
const MEAL_PLAN_COLS = 11
const CHUNK_SIZE = Math.max(1, Math.floor(99 / MEAL_PLAN_COLS)) // 9

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
      const recipe = await db.query.recipes.findFirst({
        where: eq(recipes.id, entry.recipeId),
        columns: { id: true, title: true, pictureUrl: true, prepTime: true, cookTime: true },
      })
      return { ...entry, recipe: recipe ?? null }
    })
  )

  return c.json({ entries: withRecipes })
})

const mealPlanBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealLabel: z.enum(['breakfast', 'lunch', 'dinner']),
  recipeId: z.string().nullable().optional(),
  noteText: z.string().nullable().optional(),
  dayNote: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().nullable().optional(),
})

mealPlanRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = mealPlanBodySchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { date, mealLabel, recipeId, noteText, dayNote, isRecurring, recurrenceRule } = result.data

  const entryId = crypto.randomUUID()
  const [entry] = await db.insert(mealPlan).values({
    id: entryId, familyId, date, mealLabel,
    recipeId: recipeId ?? null, noteText: noteText ?? null, dayNote: dayNote ?? null,
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
          recipeId: recipeId ?? null, noteText: noteText ?? null,
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

  if (scope === 'series' && entry.parentId) {
    const allSeries = await db.query.mealPlan.findMany({
      where: and(eq(mealPlan.parentId, entry.parentId), gte(mealPlan.date, entry.date)),
    })
    await Promise.all([
      db.update(mealPlan).set(result.data).where(eq(mealPlan.id, id)),
      ...allSeries.map((e) => db.update(mealPlan).set(result.data).where(eq(mealPlan.id, e.id))),
    ])
  } else {
    await db.update(mealPlan).set(result.data).where(eq(mealPlan.id, id))
  }

  // Recalculate future recurring entries whenever the recurrence settings change.
  // The POST handler creates future rows on insert; PATCH must mirror that logic.
  const newIsRecurring = result.data.isRecurring ?? entry.isRecurring
  const newRecurrenceRule = result.data.recurrenceRule !== undefined
    ? result.data.recurrenceRule
    : entry.recurrenceRule

  // Always wipe existing children first — handles rule changes and turning off recurrence.
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
    await db.delete(mealPlan).where(
      and(eq(mealPlan.parentId, entry.parentId), gte(mealPlan.date, entry.date))
    )
  }

  await db.delete(mealPlan).where(eq(mealPlan.id, id))
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'meal-plan:updated', familyId: familyId! })
  return c.json({ ok: true })
})

const suggestBodySchema = z.object({
  mealLabel: z.enum(['breakfast', 'lunch', 'dinner']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
})

mealPlanRoutes.post('/suggest', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = suggestBodySchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { mealLabel, messages } = result.data

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
  for (const entry of recentEntries) {
    if (entry.noteText) recentMeals.push(entry.noteText)
    if (entry.recipeId) {
      const recipe = await db.query.recipes.findFirst({
        where: eq(recipes.id, entry.recipeId),
        columns: { title: true },
      })
      if (recipe) recentMeals.push(recipe.title)
    }
  }

  const response = await chatSuggestMeal(messages, recentMeals, c.env.ANTHROPIC_API_KEY)
  if (response.type === 'recipe') {
    response.importResult = await withNutrition(response.importResult, c.env.AI_GATEWAY_API_KEY)
  }
  return c.json(response)
})
