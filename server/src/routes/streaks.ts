import { Hono } from 'hono'
import { eq, and, gte, isNull, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { streakGoals, streakCheckins } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { addDays, appliesOn, computeStreaks, describeGoal, resolveAchieved, summariseDay } from '../lib/streaks.js'
import type { AppEnv } from '../types.js'

export const streaksRoutes = new Hono<AppEnv>()
streaksRoutes.use('*', authMiddleware)

const MAX_GOALS = 10
const HISTORY_DAYS = 14
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const err = (code: string, message: string) => ({ error: { code, message } })

// Last ~14 months of check-ins is plenty for streak maths (cap in streaks.ts is 800 days).
async function loadState(db: AppEnv['Variables']['db'], userId: string, today: string) {
  const goals = await db.query.streakGoals.findMany({
    where: eq(streakGoals.userId, userId),
    orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.createdAt)],
  })
  const checkins = await db.query.streakCheckins.findMany({
    where: and(eq(streakCheckins.userId, userId), gte(streakCheckins.date, addDays(today, -800))),
  })
  return { goals, checkins }
}

streaksRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const parsedToday = isoDate.safeParse(c.req.query('today'))
  if (!parsedToday.success) return c.json(err('validation_error', 'today is required (YYYY-MM-DD)'), 400)
  const today = parsedToday.data

  const { goals, checkins } = await loadState(db, userId, today)
  const streaks = computeStreaks(goals, checkins, today)
  const achieved = new Set(checkins.filter((k) => k.achieved).map((k) => `${k.goalId}|${k.date}`))

  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => summariseDay(goals, achieved, addDays(today, i - (HISTORY_DAYS - 1))))
  const recentFrom = addDays(today, -6)

  return c.json({
    today,
    streak: { current: streaks.current, best: streaks.best, todayDone: streaks.todayDone },
    goals: goals
      .filter((g) => !g.archivedDate || today < g.archivedDate)
      .map((g) => ({
        id: g.id, type: g.type, title: g.title, target: g.target, comparator: g.comparator,
        sortOrder: g.sortOrder, createdDate: g.createdDate,
        streak: streaks.perGoal[g.id] ?? { current: 0, best: 0 },
      })),
    history,
    checkins: checkins
      .filter((k) => k.date >= recentFrom)
      .map((k) => ({ goalId: k.goalId, date: k.date, achieved: k.achieved, value: k.value })),
  })
})

const goalBody = z.object({
  type: z.enum(['custom', 'calories', 'daily_dozen']),
  title: z.string().trim().max(80).optional(),
  target: z.number().positive().nullable().optional(),
  comparator: z.enum(['lte', 'gte']).optional(),
  today: isoDate,
})

function validateGoal(type: 'custom' | 'calories' | 'daily_dozen', title: string, target: number | null): string | null {
  if (type === 'custom' && !title) return 'Give your goal a name'
  if (type === 'calories' && (target == null || target < 500 || target > 10000)) return 'Calorie target must be between 500 and 10,000'
  if (type === 'daily_dozen' && (target == null || !Number.isInteger(target) || target < 1 || target > 10)) return 'Daily Dozen target must be 1 to 10 food groups'
  return null
}

streaksRoutes.post('/goals', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const parsed = goalBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', parsed.error.issues[0].message), 400)
  const { type, today } = parsed.data
  const target = type === 'custom' ? null : parsed.data.target ?? null
  const comparator = type === 'calories' ? parsed.data.comparator ?? 'lte' : 'gte'

  const problem = validateGoal(type, parsed.data.title ?? '', target)
  if (problem) return c.json(err('validation_error', problem), 400)

  const existing = await db.query.streakGoals.findMany({
    where: and(eq(streakGoals.userId, userId), isNull(streakGoals.archivedDate)),
  })
  if (existing.length >= MAX_GOALS) return c.json(err('limit_reached', `You can have up to ${MAX_GOALS} goals`), 400)

  const title = parsed.data.title || describeGoal({ type, target, comparator })
  const [goal] = await db.insert(streakGoals).values({
    userId, type, title, target, comparator,
    sortOrder: existing.length, createdDate: today,
  }).returning()
  return c.json({ goal }, 201)
})

const patchBody = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  target: z.number().positive().optional(),
  comparator: z.enum(['lte', 'gte']).optional(),
})

streaksRoutes.patch('/goals/:id', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const id = c.req.param('id')
  const parsed = patchBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', parsed.error.issues[0].message), 400)

  const goal = await db.query.streakGoals.findFirst({ where: and(eq(streakGoals.id, id), eq(streakGoals.userId, userId)) })
  if (!goal) return c.json(err('not_found', 'Goal not found'), 404)

  const target = goal.type === 'custom' ? null : parsed.data.target ?? goal.target
  const comparator = goal.type === 'calories' ? parsed.data.comparator ?? goal.comparator : goal.comparator
  const problem = validateGoal(goal.type, parsed.data.title ?? goal.title, target)
  if (problem) return c.json(err('validation_error', problem), 400)

  // Calorie / Daily Dozen titles are derived from the target, so keep them in step when it changes.
  const title = goal.type === 'custom' ? parsed.data.title ?? goal.title : describeGoal({ type: goal.type, target, comparator })
  const [updated] = await db.update(streakGoals)
    .set({ title, target, comparator })
    .where(eq(streakGoals.id, id))
    .returning()
  return c.json({ goal: updated })
})

// Past check-ins keep their original verdict; a goal with history is archived rather than erased
// so earlier streak days stay intact.
streaksRoutes.delete('/goals/:id', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const id = c.req.param('id')
  const today = isoDate.safeParse(c.req.query('today'))
  if (!today.success) return c.json(err('validation_error', 'today is required (YYYY-MM-DD)'), 400)

  const goal = await db.query.streakGoals.findFirst({ where: and(eq(streakGoals.id, id), eq(streakGoals.userId, userId)) })
  if (!goal) return c.json(err('not_found', 'Goal not found'), 404)

  const history = await db.query.streakCheckins.findFirst({ where: eq(streakCheckins.goalId, id) })
  if (!history) await db.delete(streakGoals).where(eq(streakGoals.id, id))
  else await db.update(streakGoals).set({ archivedDate: today.data }).where(eq(streakGoals.id, id))
  return c.json({ ok: true })
})

const checkinBody = z.object({
  date: isoDate,
  today: isoDate,
  entries: z.array(z.object({
    goalId: z.string(),
    achieved: z.boolean().optional(), // custom goals
    value: z.number().min(0).max(100000).optional(), // calories / daily_dozen
  })).min(1).max(MAX_GOALS),
})

// Confirm a day. For plan-based goals the server decides pass/fail from the confirmed figure so the
// client can't claim a streak the numbers don't support.
streaksRoutes.put('/checkins', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const parsed = checkinBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', parsed.error.issues[0].message), 400)
  const { date, today, entries } = parsed.data

  if (date > today) return c.json(err('validation_error', "You can't check in for a future day"), 400)
  if (date < addDays(today, -7)) return c.json(err('validation_error', 'You can only check in for the last 7 days'), 400)

  const goals = await db.query.streakGoals.findMany({
    where: and(eq(streakGoals.userId, userId), inArray(streakGoals.id, entries.map((e) => e.goalId))),
  })
  const byId = new Map(goals.map((g) => [g.id, g]))

  const rows = []
  for (const e of entries) {
    const goal = byId.get(e.goalId)
    if (!goal || !appliesOn(goal, date)) continue
    const value = goal.type === 'custom' ? null : e.value ?? null
    rows.push({
      goalId: goal.id, userId, date, value,
      achieved: resolveAchieved(goal, value, e.achieved ?? null),
    })
  }
  if (rows.length === 0) return c.json(err('validation_error', 'No matching goals for that day'), 400)

  for (const row of rows) {
    await db.insert(streakCheckins).values(row).onConflictDoUpdate({
      target: [streakCheckins.goalId, streakCheckins.date],
      set: { achieved: row.achieved, value: row.value },
    })
  }
  return c.json({ ok: true, saved: rows.length })
})
