import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { Skeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { getErrorMessage } from '../../lib/api'
import { DAILY_DOZEN, type DailyDozenId } from '../../lib/dailyDozen'
import { toLocalIso } from '../../hooks/usePlanner'
import { useDayPlans } from '../../hooks/useDayPlan'
import {
  useStreaksQuery, useSaveGoalMutation, useDeleteGoalMutation, useCheckinMutation,
  meetsGoal, goalSubtitle, goalIcon,
  type StreakGoal, type StreaksData, type GoalType, type CheckinEntry,
} from '../../hooks/useStreaks'

const EVENING_HOUR = 18
const CUSTOM_IDEAS = ['Drink 5 glasses of water', 'Exercise: 90 min moderate or 40 min vigorous', 'Walk 30 minutes', 'No alcohol', 'In bed by 10pm']

const fieldCls = 'w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm'
const primaryBtn = 'w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-40'

function dayLabel(iso: string, today: string) {
  if (iso === today) return 'today'
  const d = new Date(`${iso}T00:00:00`)
  const t = new Date(`${today}T00:00:00`)
  if (Math.round((t.getTime() - d.getTime()) / 86_400_000) === 1) return 'yesterday'
  return d.toLocaleDateString('en-AU', { weekday: 'long' })
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ data }: { data: StreaksData }) {
  // Streaks are per goal: missing one goal only resets that goal. The banner shows the longest one running.
  const top = data.goals.reduce<StreakGoal | null>((m, g) => (!m || g.streak.current > m.streak.current ? g : m), null)
  const current = top?.streak.current ?? 0
  const best = data.goals.reduce((m, g) => Math.max(m, g.streak.best), 0)
  const live = data.goals.filter((g) => g.streak.current > 0).length
  return (
    <div className="rounded-3xl p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-card">
      <div className="flex items-center gap-4">
        <span
          className="material-symbols-outlined text-[64px] leading-none"
          style={{ fontVariationSettings: `'FILL' ${current > 0 ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 48` }}
        >
          local_fire_department
        </span>
        <div className="min-w-0">
          <p className="font-headline font-extrabold text-5xl leading-none">{current}</p>
          <p className="text-sm font-semibold opacity-90 mt-1 truncate">{top && current > 0 ? `days · ${top.title}` : 'day streak'}</p>
        </div>
        <div className="ml-auto text-right flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Best ever</p>
          <p className="font-headline font-bold text-2xl">{best}</p>
        </div>
      </div>
      <p className="text-sm font-medium mt-4 opacity-95">
        {data.goals.length === 0
          ? 'Set a daily goal to start your first streak.'
          : live === 0
            ? 'Check in today to start a streak.'
            : `${live} of ${data.goals.length} goal${data.goals.length > 1 ? 's' : ''} on a streak. Each one is tracked separately.`}
      </p>
    </div>
  )
}

function HistoryStrip({ data }: { data: StreaksData }) {
  return (
    <div className="flex justify-between gap-1">
      {data.history.slice(-7).map((d) => {
        const isToday = d.date === data.today
        const complete = d.total > 0 && d.done === d.total
        const partial = d.done > 0 && !complete
        const label = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'narrow' })
        return (
          <div key={d.date} className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-[10px] font-semibold text-on-surface-variant">{label}</span>
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                complete ? 'bg-amber-400 border-amber-400 text-white'
                : partial ? 'border-amber-400 text-amber-500'
                : d.total === 0 ? 'border-transparent bg-surface-container'
                : isToday ? 'border-dashed border-outline'
                : 'border-outline-variant/60 text-on-surface-variant/40'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {complete ? 'check' : partial ? 'timelapse' : d.total > 0 && !isToday ? 'close' : ''}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Check-in (each goal saves on its own) ─────────────────────────────────────

type Plans = ReturnType<typeof useDayPlans>['plans']

function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toLocalIso(d)
}

/** Daily Dozen goals follow the meal plan with no input from the user: each day's count is saved automatically. */
function useAutoDozen(data: StreaksData | undefined, plans: Plans, loading: boolean) {
  const { mutate } = useCheckinMutation()
  const sent = useRef(new Set<string>())
  useEffect(() => {
    if (!data || loading) return
    const byDate: Record<string, CheckinEntry[]> = {}
    for (const g of data.goals) {
      if (g.type !== 'daily_dozen') continue
      for (let i = 0; i < 7; i++) {
        const date = addDaysIso(data.today, -i)
        if (date < g.createdDate) continue
        const count = plans[date]?.categories.size ?? 0
        const prev = data.checkins.find((c) => c.goalId === g.id && c.date === date)
        // Today only gets recorded once it's met (or to correct an earlier result); past days are final, even at 0.
        const needs = prev ? prev.value !== count : i > 0 || meetsGoal(g, count)
        const key = `${g.id}|${date}|${count}`
        if (needs && !sent.current.has(key)) {
          sent.current.add(key)
          ;(byDate[date] ??= []).push({ goalId: g.id, value: count })
        }
      }
    }
    for (const [date, entries] of Object.entries(byDate)) mutate({ date, entries })
  }, [data, plans, loading, mutate])
}

function GoalCheck({ goal, date, data, plan }: { goal: StreakGoal; date: string; data: StreaksData; plan: Plans[string] | undefined }) {
  const existing = data.checkins.find((c) => c.goalId === goal.id && c.date === date)
  const checkin = useCheckinMutation()
  const [kcal, setKcal] = useState(existing?.value != null ? String(Math.round(existing.value)) : plan && plan.calories > 0 ? String(plan.calories) : '')
  const save = (entry: Omit<CheckinEntry, 'goalId'>, msg: string) =>
    checkin.mutate({ date, entries: [{ goalId: goal.id, ...entry }] }, {
      onSuccess: () => toast.success(msg),
      onError: (e) => toast.error(getErrorMessage(e)),
    })

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">{goalIcon[goal.type]}</span>
        <p className="font-headline font-bold text-on-surface flex-1">{goal.title}</p>
      </div>

      {goal.type === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((yes) => (
            <button key={String(yes)} disabled={checkin.isPending} onClick={() => save({ achieved: yes }, yes ? 'Nice one!' : 'Saved')}
              className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                existing?.achieved === yes
                  ? yes ? 'bg-primary text-on-primary border-primary' : 'bg-error-container text-on-error-container border-error-container'
                  : 'border-outline-variant text-on-surface-variant'}`}>
              {yes ? 'Yes, did it' : 'Not today'}
            </button>
          ))}
        </div>
      )}

      {goal.type === 'daily_dozen' && (() => {
        const cats = plan?.categories ?? new Set<string>()
        const ok = meetsGoal(goal, cats.size)
        return (
          <>
            <div className="grid grid-cols-5 gap-2">
              {DAILY_DOZEN.map((item) => {
                const on = cats.has(item.id)
                return (
                  <div key={item.id} className={`rounded-xl border p-1.5 flex flex-col items-center gap-0.5 ${on ? 'bg-green-50 border-green-300' : 'bg-surface-container border-outline-variant/20 opacity-60'}`}>
                    <span className="text-lg">{item.emoji}</span>
                    <span className={`text-[8px] leading-tight text-center font-semibold ${on ? 'text-green-800' : 'text-on-surface-variant'}`}>{item.shortName}</span>
                  </div>
                )
              })}
            </div>
            <p className={`text-sm font-semibold ${ok ? 'text-primary' : 'text-on-surface-variant'}`}>
              {cats.size}/{DAILY_DOZEN.length} groups · goal {goal.target} {ok ? '✓' : ''}
            </p>
            <p className="text-xs text-on-surface-variant">Automatic: counted from your meal plan, nothing to confirm. Add meals to the plan to change it.</p>
          </>
        )
      })()}

      {goal.type === 'calories' && (() => {
        const n = kcal === '' ? null : Number(kcal)
        const ok = meetsGoal(goal, n)
        return (
          <>
            <div className="flex items-center gap-2">
              <input inputMode="numeric" type="number" min={0} value={kcal} placeholder="0" onChange={(e) => setKcal(e.target.value)} className={fieldCls} />
              <span className="text-sm text-on-surface-variant whitespace-nowrap">kcal</span>
            </div>
            <p className={`text-sm font-semibold ${n == null ? 'text-on-surface-variant' : ok ? 'text-primary' : 'text-error'}`}>
              Goal: {goal.comparator === 'lte' ? 'at most' : 'at least'} {Math.round(goal.target ?? 0)} kcal{n != null && (ok ? ' · on track ✓' : ' · not met')}
            </p>
            <p className="text-xs text-on-surface-variant">
              {plan && plan.meals > 0
                ? `Meal plan total: ${plan.calories} kcal (one serving of each planned recipe)${plan.uncounted ? `, not counting ${plan.uncounted} meal${plan.uncounted > 1 ? 's' : ''} without calorie info` : ''}. Adjust if you ate more or less.`
                : 'Nothing planned for this day, so enter what you ate.'}
            </p>
            <button disabled={n == null || Number.isNaN(n) || checkin.isPending} onClick={() => save({ value: n! }, 'Saved')} className={primaryBtn}>
              {checkin.isPending ? 'Saving…' : existing ? 'Update' : 'Confirm'}
            </button>
          </>
        )
      })()}
    </div>
  )
}

/** Opens for one goal (goalId) or for a whole day. Every goal inside saves independently. */
function CheckInSheet({ data, date, goalId, onClose }: { data: StreaksData; date: string | null; goalId: string | null; onClose: () => void }) {
  const goals = date ? data.goals.filter((g) => g.createdDate <= date && (!goalId || g.id === goalId)) : []
  const needsPlan = goals.some((g) => g.type !== 'custom')
  const { plans, loading } = useDayPlans(date ?? '', date ?? '', !!date && needsPlan)
  const single = goalId ? goals[0] : null
  return (
    <BottomSheet open={!!date} onClose={onClose} title={date ? (single ? single.title : `Check in for ${dayLabel(date, data.today)}`) : ''} size="lg">
      {date && (
        <div className="space-y-3 pb-2">
          {!single && <p className="text-sm text-on-surface-variant">Do as many as you like. Each goal saves on its own.</p>}
          {loading ? <Skeleton className="h-28 w-full" /> : goals.map((g) => <GoalCheck key={g.id} goal={g} date={date} data={data} plan={plans[date]} />)}
        </div>
      )}
    </BottomSheet>
  )
}

// ── Goal editor ───────────────────────────────────────────────────────────────

function GoalEditor({ goal, open, onClose }: { goal: StreakGoal | null; open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={goal ? 'Edit goal' : 'New daily goal'} size="lg">
      {open && <GoalEditorForm goal={goal} onClose={onClose} />}
    </BottomSheet>
  )
}

function GoalEditorForm({ goal, onClose }: { goal: StreakGoal | null; onClose: () => void }) {
  const save = useSaveGoalMutation()
  const [type, setType] = useState<GoalType>(goal?.type ?? 'custom')
  const [title, setTitle] = useState(goal?.type === 'custom' ? goal.title : '')
  const [kcal, setKcal] = useState(String(goal?.type === 'calories' ? goal.target : 2000))
  const [comparator, setComparator] = useState<'lte' | 'gte'>(goal?.comparator ?? 'lte')
  const [groups, setGroups] = useState(goal?.type === 'daily_dozen' ? Math.round(goal.target ?? 8) : 8)

  const types: { id: GoalType; label: string; hint: string }[] = [
    { id: 'custom', label: 'My own goal', hint: 'Tick it off whenever you do it' },
    { id: 'calories', label: 'Calories', hint: 'Worked out from your meal plan' },
    { id: 'daily_dozen', label: 'Daily Dozen foods', hint: 'Automatic from your meal plan' },
  ]

  const submit = () => {
    const body = type === 'custom' ? { type, title: title.trim() }
      : type === 'calories' ? { type, target: Number(kcal), comparator }
      : { type, target: groups }
    save.mutate({ id: goal?.id, ...body }, {
      onSuccess: () => { toast.success(goal ? 'Goal updated' : 'Goal added'); onClose() },
      onError: (e) => toast.error(getErrorMessage(e)),
    })
  }
  const valid = type === 'custom' ? title.trim().length > 0 : type === 'calories' ? Number(kcal) >= 500 : true

  return (
    <div className="space-y-4 pb-2">
      {!goal && (
        <div className="space-y-2">
          {types.map((t) => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left ${type === t.id ? 'border-primary bg-secondary-container/40' : 'border-outline-variant'}`}>
              <span className="material-symbols-outlined text-primary">{goalIcon[t.id]}</span>
              <span>
                <span className="block text-sm font-bold text-on-surface">{t.label}</span>
                <span className="block text-xs text-on-surface-variant">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {type === 'custom' && (
        <div className="space-y-2">
          <input autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walk 30 minutes" className={fieldCls} />
          {!goal && (
            <div className="flex flex-wrap gap-2">
              {CUSTOM_IDEAS.map((idea) => (
                <button key={idea} onClick={() => setTitle(idea)} className="px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-on-surface-variant">{idea}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {type === 'calories' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {([['lte', 'Stay under'], ['gte', 'Reach at least']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setComparator(v)}
                className={`py-3 rounded-xl text-sm font-bold border-2 ${comparator === v ? 'border-primary bg-secondary-container/40 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input inputMode="numeric" type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} className={fieldCls} />
            <span className="text-sm text-on-surface-variant whitespace-nowrap">kcal/day</span>
          </div>
          <p className="text-xs text-on-surface-variant">We total the calories on your meal plan and you confirm the figure when you're ready.</p>
        </div>
      )}

      {type === 'daily_dozen' && (
        <div className="space-y-3">
          <p className="text-sm text-on-surface">Hit <span className="font-bold text-primary">{groups}</span> of the {DAILY_DOZEN.length} Daily Dozen food groups</p>
          <input type="range" min={1} max={DAILY_DOZEN.length} value={groups} onChange={(e) => setGroups(Number(e.target.value))} className="w-full accent-primary" />
          <p className="text-xs text-on-surface-variant">Fully automatic: your meal plan decides which groups count each day. Nothing to tick or confirm.</p>
        </div>
      )}

      <button disabled={!valid || save.isPending} onClick={submit} className={primaryBtn}>{save.isPending ? 'Saving…' : goal ? 'Save' : 'Add goal'}</button>
    </div>
  )
}

/** Goals the user still has to answer for a day. Daily Dozen is automatic, so it never counts. */
function pendingFor(data: StreaksData, date: string) {
  return data.goals.filter((g) => g.type !== 'daily_dozen' && g.createdDate <= date && !data.checkins.some((c) => c.goalId === g.id && c.date === date))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StreaksPage() {
  const { data, isLoading, isError, refetch } = useStreaksQuery()
  const del = useDeleteGoalMutation()
  const hasDozen = !!data?.goals.some((g) => g.type === 'daily_dozen')
  const { plans, loading: plansLoading } = useDayPlans(data ? addDaysIso(data.today, -6) : '', data?.today ?? '', hasDozen)
  useAutoDozen(data, plans, plansLoading)
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<{ date: string; goalId: string | null } | null>(null)
  const quick = useCheckinMutation()
  const [editing, setEditing] = useState<StreakGoal | 'new' | null>(null)
  const [managing, setManaging] = useState(params.get('goals') === '1')

  useEffect(() => { if (params.get('goals') === '1') setManaging(true) }, [params])

  const closeManage = () => {
    setManaging(false)
    if (params.has('goals')) { params.delete('goals'); setParams(params, { replace: true }) }
  }

  // After the evening mark, nudge once per day if there are goals still to answer for today.
  useEffect(() => {
    if (!data || pendingFor(data, data.today).length === 0) return
    if (new Date().getHours() < EVENING_HOUR) return
    try {
      if (localStorage.getItem('mealio-streak-prompted') === data.today) return
      localStorage.setItem('mealio-streak-prompted', data.today)
    } catch { /* storage unavailable: prompt every visit */ }
    setSheet({ date: data.today, goalId: null })
  }, [data])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-28">
        <TopBar title="Streaks" showAvatar />
        <div className="pt-topbar px-4 mt-2 space-y-4"><Skeleton className="h-40 w-full rounded-3xl" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-surface pb-28">
        <TopBar title="Streaks" showAvatar />
        <div className="pt-topbar px-4 mt-6 text-center space-y-3">
          <p className="text-on-surface-variant">Couldn't load your streaks.</p>
          <button onClick={() => refetch()} className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm">Try again</button>
        </div>
      </div>
    )
  }

  const checkinFor = (goalId: string, date: string) => data.checkins.find((c) => c.goalId === goalId && c.date === date)
  const hour = new Date().getHours()
  const isEvening = hour >= EVENING_HOUR
  // Recent days (not today) with goals left unanswered that the user can still catch up on.
  const catchUp = [1, 2, 3].map((i) => addDaysIso(data.today, -i)).map((date) => ({ date, left: pendingFor(data, date).length })).filter((d) => d.left > 0)
  const todayPending = pendingFor(data, data.today).length > 0

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Streaks" showAvatar />

      <div className="pt-topbar px-4 mt-2 space-y-6">
        <Hero data={data} />

        {data.goals.length > 0 && <HistoryStrip data={data} />}

        {data.goals.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card text-center space-y-3">
            <p className="font-headline font-bold text-on-surface">What do you want to do every day?</p>
            <p className="text-sm text-on-surface-variant">Pick a calorie target, a Daily Dozen target or your own habit. Tick off what you've done as you go, and each goal builds its own streak.</p>
            <button onClick={() => setEditing('new')} className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-headline font-bold text-sm">Set your first goal</button>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Today's goals</p>
                <button onClick={() => setManaging(true)} className="text-sm font-bold text-primary">Manage</button>
              </div>
              {data.goals.map((g) => {
                const done = checkinFor(g.id, data.today)
                const count = plans[data.today]?.categories.size ?? 0
                const dozenOk = g.type === 'daily_dozen' && meetsGoal(g, count)
                const good = g.type === 'daily_dozen' ? dozenOk : done?.achieved
                const status = g.type === 'daily_dozen'
                  ? `${count}/${DAILY_DOZEN.length} groups today · automatic`
                  : done ? (done.value != null ? `Confirmed: ${Math.round(done.value)} kcal` : done.achieved ? 'Done' : 'Not today') : goalSubtitle(g)
                const circle = (
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    good ? 'bg-primary text-on-primary' : done && g.type !== 'daily_dozen' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-primary'}`}>
                    <span className="material-symbols-outlined text-[22px]">{good ? 'check' : done && g.type !== 'daily_dozen' ? 'close' : goalIcon[g.type]}</span>
                  </span>
                )
                const body = (
                  <>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block font-headline font-bold text-on-surface truncate">{g.title}</span>
                      <span className="block text-xs text-on-surface-variant truncate">{status}</span>
                    </span>
                    <span className={`flex flex-col items-center flex-shrink-0 min-w-[44px] ${g.streak.current > 0 ? 'text-orange-500' : 'text-on-surface-variant/40'}`}>
                      <span className="flex items-center gap-0.5 text-lg font-extrabold font-headline leading-none">
                        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        {g.streak.current}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide">{g.streak.current === 1 ? 'day' : 'days'}</span>
                    </span>
                  </>
                )
                const row = 'w-full flex items-center gap-3 bg-surface-container-lowest rounded-2xl p-4 shadow-card'
                // Own goals: one tap on the circle ticks it off and saves just that goal.
                return g.type === 'custom' ? (
                  <div key={g.id} className={row}>
                    <button aria-label={done?.achieved ? `Undo ${g.title}` : `Mark ${g.title} done`} disabled={quick.isPending}
                      onClick={() => quick.mutate({ date: data.today, entries: [{ goalId: g.id, achieved: !done?.achieved }] }, { onError: (e) => toast.error(getErrorMessage(e)) })}>
                      {circle}
                    </button>
                    {body}
                  </div>
                ) : (
                  <button key={g.id} onClick={() => setSheet({ date: data.today, goalId: g.id })} className={`${row} active:bg-surface-container-low`}>
                    {circle}
                    {body}
                  </button>
                )
              })}
            </section>

            {todayPending && isEvening && (
              <button onClick={() => setSheet({ date: data.today, goalId: null })} className="w-full py-4 rounded-full font-headline font-bold bg-primary text-on-primary shadow-card-md">
                Time to check in for today
              </button>
            )}

            {catchUp.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Catch up</p>
                {catchUp.map((d) => (
                  <button key={d.date} onClick={() => setSheet({ date: d.date, goalId: null })}
                    className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left">
                    <span className="text-sm font-medium text-amber-900 capitalize">{dayLabel(d.date, data.today)} · {d.left} goal{d.left > 1 ? 's' : ''} to answer</span>
                    <span className="material-symbols-outlined text-amber-700 text-[20px]">chevron_right</span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <CheckInSheet data={data} date={sheet?.date ?? null} goalId={sheet?.goalId ?? null} onClose={() => setSheet(null)} />

      <BottomSheet open={managing} onClose={closeManage} title="Your daily goals" size="lg">
        <div className="space-y-3 pb-2">
          {data.goals.map((g) => (
            <div key={g.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl p-3 shadow-card">
              <span className="material-symbols-outlined text-primary">{goalIcon[g.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">{g.title}</p>
                <p className="text-xs text-on-surface-variant">Current {g.streak.current} · best {g.streak.best}</p>
              </div>
              <button aria-label={`Edit ${g.title}`} onClick={() => setEditing(g)} className="p-2 text-on-surface-variant"><span className="material-symbols-outlined text-[20px]">edit</span></button>
              <button aria-label={`Delete ${g.title}`} disabled={del.isPending}
                onClick={() => { if (confirm(`Delete "${g.title}"? Your past streak days are kept.`)) del.mutate(g.id, { onError: (e) => toast.error(getErrorMessage(e)) }) }}
                className="p-2 text-error"><span className="material-symbols-outlined text-[20px]">delete</span></button>
            </div>
          ))}
          {data.goals.length < 10 && (
            <button onClick={() => setEditing('new')} className="w-full py-3 rounded-full border-2 border-dashed border-outline text-sm font-bold text-primary">+ Add a goal</button>
          )}
        </div>
      </BottomSheet>

      <GoalEditor key={editing === 'new' ? 'new' : editing?.id ?? 'none'} open={!!editing} goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  )
}
