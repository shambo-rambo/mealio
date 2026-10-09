// Pure streak logic. Dates are user-local YYYY-MM-DD strings supplied by the client
// (the server has no idea of the user's timezone), so all arithmetic is done on the strings.

export interface GoalLike {
  id: string
  type: 'custom' | 'calories' | 'daily_dozen'
  target: number | null
  comparator: 'lte' | 'gte'
  createdDate: string
  archivedDate: string | null
}

export interface CheckinLike {
  goalId: string
  date: string
  achieved: boolean
}

const MAX_DAYS = 800

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Decide whether a confirmed figure meets the goal. Custom goals are explicit yes/no. */
export function resolveAchieved(goal: Pick<GoalLike, 'type' | 'target' | 'comparator'>, value: number | null, explicit: boolean | null): boolean {
  if (goal.type === 'custom') return explicit === true
  if (value == null || goal.target == null) return false
  return goal.comparator === 'lte' ? value <= goal.target : value >= goal.target
}

export function appliesOn(goal: Pick<GoalLike, 'createdDate' | 'archivedDate'>, date: string): boolean {
  return goal.createdDate <= date && (!goal.archivedDate || date < goal.archivedDate)
}

export interface DaySummary {
  date: string
  total: number // goals that applied that day
  done: number // goals achieved
}

export function summariseDay(goals: GoalLike[], achieved: Set<string>, date: string): DaySummary {
  const applicable = goals.filter((g) => appliesOn(g, date))
  return {
    date,
    total: applicable.length,
    done: applicable.filter((g) => achieved.has(`${g.id}|${date}`)).length,
  }
}

const isComplete = (s: DaySummary) => s.total > 0 && s.done === s.total

export function computeStreaks(goals: GoalLike[], checkins: CheckinLike[], today: string) {
  const achieved = new Set(checkins.filter((c) => c.achieved).map((c) => `${c.goalId}|${c.date}`))

  const earliest = goals.reduce((min, g) => (g.createdDate < min ? g.createdDate : min), today)

  // Overall (every goal, every day) streak walking back from today. An unfinished today
  // doesn't break the streak - it just hasn't been earned yet.
  let current = 0
  let todayDone = false
  for (let i = 0, d = today; i < MAX_DAYS && d >= earliest; i++, d = addDays(today, -i)) {
    const s = summariseDay(goals, achieved, d)
    if (isComplete(s)) {
      current++
      if (i === 0) todayDone = true
    } else if (i !== 0) {
      break
    }
  }

  // Longest run ever, scanning forward.
  let best = 0
  let run = 0
  for (let d = earliest, n = 0; d <= today && n < MAX_DAYS; d = addDays(d, 1), n++) {
    if (isComplete(summariseDay(goals, achieved, d))) {
      run++
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }

  // Per-goal streaks, same rules.
  const perGoal: Record<string, { current: number; best: number }> = {}
  for (const g of goals) {
    let cur = 0
    for (let i = 0, d = today; i < MAX_DAYS && d >= g.createdDate; i++, d = addDays(today, -i)) {
      if (g.archivedDate && d >= g.archivedDate) continue
      if (achieved.has(`${g.id}|${d}`)) cur++
      else if (i !== 0) break
    }
    let b = 0
    let r = 0
    const last = g.archivedDate ? addDays(g.archivedDate, -1) : today
    for (let d = g.createdDate, n = 0; d <= last && d <= today && n < MAX_DAYS; d = addDays(d, 1), n++) {
      if (achieved.has(`${g.id}|${d}`)) { r++; b = Math.max(b, r) } else r = 0
    }
    perGoal[g.id] = { current: cur, best: b }
  }

  return { current, best: Math.max(best, current), todayDone, perGoal }
}

export function describeGoal(g: { type: GoalLike['type']; target: number | null; comparator: 'lte' | 'gte' }): string {
  if (g.type === 'calories') return `${g.comparator === 'lte' ? 'Stay under' : 'Eat at least'} ${Math.round(g.target ?? 0)} kcal`
  if (g.type === 'daily_dozen') return `Hit ${Math.round(g.target ?? 0)} of 12 Daily Dozen groups`
  return 'Goal'
}
