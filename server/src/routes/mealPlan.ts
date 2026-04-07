import { Hono } from 'hono'
import { eq, and, gte } from 'drizzle-orm'
import { z } from 'zod'
import { mealPlan, recipes } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { expandRecurrenceRule, type RecurrenceRule } from '../lib/recurrence.js'
import { broadcastToFamily } from '../lib/ws.js'
import type { AppEnv } from '../types.js'

export const mealPlanRoutes = new Hono<AppEnv>()
mealPlanRoutes.use('*', authMiddleware)

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
        await db.insert(mealPlan).values(
          futureDates.map((d) => ({
            familyId, date: d, mealLabel,
            recipeId: recipeId ?? null, noteText: noteText ?? null,
            isRecurring: true, recurrenceRule, parentId: entryId, createdBy: userId,
          }))
        )
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
