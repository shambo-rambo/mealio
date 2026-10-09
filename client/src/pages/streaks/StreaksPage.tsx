import { useEffect, useState } from 'react'
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
const CUSTOM_IDEAS = ['Walk 30 minutes', 'No alcohol', 'Drink 2L of water', 'Read for 20 minutes', 'In bed by 10pm']

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

// ── Check-in sheet ────────────────────────────────────────────────────────────

interface GoalState { achieved?: boolean; ticked?: Set<DailyDozenId>; kcal?: string }

function CheckInSheet({ data, date, onClose }: { data: StreaksData; date: string | null; onClose: () => void }) {
  return (
    <BottomSheet open={!!date} onClose={onClose} title={date ? `Check in for ${dayLabel(date, data.today)}` : ''} size="full">
      {date && <CheckInForm data={data} date={date} onClose={onClose} />}
    </BottomSheet>
  )
}

function CheckInForm({ data, date, onClose }: { data: StreaksData; date: string; onClose: () => void }) {
  const goals = data.goals.filter((g) => g.createdDate <= date)
  const needsPlan = goals.some((g) => g.type !== 'custom')
  const { plans, loading } = useDayPlans(date, date, needsPlan)
  const checkin = useCheckinMutation()

  if (loading) return <div className="space-y-3 pb-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>

  return <CheckInFields data={data} date={date} goals={goals} plan={plans[date]} saving={checkin.isPending} onSubmit={(entries) =>
    checkin.mutate({ date, entries }, {
      onSuccess: () => { toast.success('Checked in'); onClose() },
      onError: (e) => toast.error(getErrorMessage(e)),
    })
  } />
}

function CheckInFields({ data, date, goals, plan, saving, onSubmit }: {
  data: StreaksData; date: string; goals: StreakGoal[]
  plan: ReturnType<typeof useDayPlans>['plans'][string] | undefined
  saving: boolean; onSubmit: (e: CheckinEntry[]) => void
}) {
  const existing = (goalId: string) => data.checkins.find((c) => c.goalId === goalId && c.date === date)
  const [state, setState] = useState<Record<string, GoalState>>(() => {
    const init: Record<string, GoalState> = {}
    for (const g of goals) {
      const prev = existing(g.id)
      if (g.type === 'custom') init[g.id] = { achieved: prev?.achieved }
      else if (g.type === 'daily_dozen') init[g.id] = { ticked: new Set(plan?.categories ?? []) }
      else init[g.id] = { kcal: prev?.value != null ? String(Math.round(prev.value)) : plan && plan.calories > 0 ? String(plan.calories) : '' }
    }
    return init
  })
  const patch = (id: string, p: GoalState) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }))

  const entryFor = (g: StreakGoal): CheckinEntry | null => {
    const s = state[g.id]
    if (g.type === 'custom') return s.achieved == null ? null : { goalId: g.id, achieved: s.achieved }
    if (g.type === 'daily_dozen') return { goalId: g.id, value: s.ticked?.size ?? 0 }
    const kcal = Number(s.kcal)
    return s.kcal === '' || Number.isNaN(kcal) ? null : { goalId: g.id, value: kcal }
  }
  const entries = goals.map(entryFor)
  const ready = entries.every(Boolean)

  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-on-surface-variant">
        {goals.some((g) => g.type !== 'custom')
          ? "We've filled in what your meal plan says. Fix anything that's not right, then confirm."
          : 'Did you hit your goals?'}
      </p>

      {goals.map((g) => {
        const s = state[g.id]
        return (
          <div key={g.id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">{goalIcon[g.type]}</span>
              <p className="font-headline font-bold text-on-surface flex-1">{g.title}</p>
            </div>

            {g.type === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((yes) => (
                  <button key={String(yes)} onClick={() => patch(g.id, { achieved: yes })}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                      s.achieved === yes
                        ? yes ? 'bg-primary text-on-primary border-primary' : 'bg-error-container text-on-error-container border-error-container'
                        : 'border-outline-variant text-on-surface-variant'}`}>
                    {yes ? 'Yes, did it' : 'Not today'}
                  </button>
                ))}
              </div>
            )}

            {g.type === 'daily_dozen' && (() => {
              const count = s.ticked?.size ?? 0
              const ok = meetsGoal(g, count)
              return (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {DAILY_DOZEN.map((item) => {
                      const on = s.ticked?.has(item.id)
                      return (
                        <button key={item.id} aria-pressed={on}
                          onClick={() => {
                            const next = new Set(s.ticked)
                            if (on) next.delete(item.id); else next.add(item.id)
                            patch(g.id, { ticked: next })
                          }}
                          className={`rounded-xl border p-2 flex flex-col items-center gap-1 ${on ? 'bg-green-50 border-green-300' : 'bg-surface-container border-outline-variant/20 opacity-70'}`}>
                          <span className="text-xl">{item.emoji}</span>
                          <span className={`text-[9px] leading-tight text-center font-semibold ${on ? 'text-green-800' : 'text-on-surface-variant'}`}>{item.shortName}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className={`text-sm font-semibold ${ok ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {count}/12 groups · goal {g.target} {ok ? '✓' : ''}
                  </p>
                  {(!plan || plan.meals === 0) && <p className="text-xs text-on-surface-variant">Nothing planned for this day, so tap what you actually ate.</p>}
                </>
              )
            })()}

            {g.type === 'calories' && (() => {
              const kcal = s.kcal === '' ? null : Number(s.kcal)
              const ok = meetsGoal(g, kcal)
              return (
                <>
                  <div className="flex items-center gap-2">
                    <input inputMode="numeric" type="number" min={0} value={s.kcal ?? ''} placeholder="0"
                      onChange={(e) => patch(g.id, { kcal: e.target.value })} className={fieldCls} />
                    <span className="text-sm text-on-surface-variant whitespace-nowrap">kcal</span>
                  </div>
                  <p className={`text-sm font-semibold ${kcal == null ? 'text-on-surface-variant' : ok ? 'text-primary' : 'text-error'}`}>
                    Goal: {g.comparator === 'lte' ? 'at most' : 'at least'} {Math.round(g.target ?? 0)} kcal
                    {kcal != null && (ok ? ' · on track ✓' : ' · not met')}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {plan && plan.meals > 0
                      ? `Meal plan total: ${plan.calories} kcal (one serving of each planned recipe)${plan.uncounted ? `, not counting ${plan.uncounted} meal${plan.uncounted > 1 ? 's' : ''} without calorie info` : ''}. Adjust if you ate more or less.`
                      : 'Nothing planned for this day, so enter what you ate.'}
                  </p>
                </>
              )
            })()}
          </div>
        )
      })}

      <button disabled={!ready || saving} onClick={() => onSubmit(entries as CheckinEntry[])} className={primaryBtn}>
        {saving ? 'Saving…' : 'Confirm day'}
      </button>
    </div>
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
  const [groups, setGroups] = useState(goal?.type === 'daily_dozen' ? Math.round(goal.target ?? 9) : 9)

  const types: { id: GoalType; label: string; hint: string }[] = [
    { id: 'custom', label: 'My own goal', hint: 'Yes or no each evening' },
    { id: 'calories', label: 'Calories', hint: 'Worked out from your meal plan' },
    { id: 'daily_dozen', label: 'Daily Dozen', hint: 'Food groups from your meal plan' },
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
          <p className="text-xs text-on-surface-variant">Each evening we total the calories on your meal plan and ask you to confirm.</p>
        </div>
      )}

      {type === 'daily_dozen' && (
        <div className="space-y-3">
          <p className="text-sm text-on-surface">Hit <span className="font-bold text-primary">{groups}</span> of the 12 Daily Dozen groups</p>
          <input type="range" min={1} max={12} value={groups} onChange={(e) => setGroups(Number(e.target.value))} className="w-full accent-primary" />
          <p className="text-xs text-on-surface-variant">Each evening we tick the groups your meal plan covers and ask you to confirm.</p>
        </div>
      )}

      <button disabled={!valid || save.isPending} onClick={submit} className={primaryBtn}>{save.isPending ? 'Saving…' : goal ? 'Save' : 'Add goal'}</button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StreaksPage() {
  const { data, isLoading, isError, refetch } = useStreaksQuery()
  const del = useDeleteGoalMutation()
  const [params, setParams] = useSearchParams()
  const [checkInDate, setCheckInDate] = useState<string | null>(null)
  const [editing, setEditing] = useState<StreakGoal | 'new' | null>(null)
  const [managing, setManaging] = useState(params.get('goals') === '1')

  useEffect(() => { if (params.get('goals') === '1') setManaging(true) }, [params])

  const closeManage = () => {
    setManaging(false)
    if (params.has('goals')) { params.delete('goals'); setParams(params, { replace: true }) }
  }

  // After the evening mark, nudge once per day if today still has unconfirmed goals.
  useEffect(() => {
    if (!data || data.goals.length === 0 || data.streak.todayDone) return
    const todayStats = data.history.find((d) => d.date === data.today)
    if (!todayStats || todayStats.done >= todayStats.total) return
    if (new Date().getHours() < EVENING_HOUR) return
    try {
      if (localStorage.getItem('mealio-streak-prompted') === data.today) return
      localStorage.setItem('mealio-streak-prompted', data.today)
    } catch { /* storage unavailable: prompt every visit */ }
    setCheckInDate(data.today)
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
  // Recent days (not today) with unconfirmed goals the user can still catch up on.
  const catchUp = data.history.slice(-4, -1).filter((d) => d.total > 0 && d.done < d.total).reverse()
  const todayPending = data.goals.some((g) => !checkinFor(g.id, data.today))

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Streaks" showAvatar />

      <div className="pt-topbar px-4 mt-2 space-y-6">
        <Hero data={data} />

        {data.goals.length > 0 && <HistoryStrip data={data} />}

        {data.goals.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-card text-center space-y-3">
            <p className="font-headline font-bold text-on-surface">What do you want to do every day?</p>
            <p className="text-sm text-on-surface-variant">Pick a calorie target, a Daily Dozen target or your own habit. We'll check in each evening and build your streak.</p>
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
                return (
                  <button key={g.id} onClick={() => setCheckInDate(data.today)}
                    className="w-full flex items-center gap-3 bg-surface-container-lowest rounded-2xl p-4 shadow-card text-left active:bg-surface-container-low">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${done ? (done.achieved ? 'bg-primary text-on-primary' : 'bg-error-container text-on-error-container') : 'bg-surface-container text-primary'}`}>
                      <span className="material-symbols-outlined text-[22px]">{done ? (done.achieved ? 'check' : 'close') : goalIcon[g.type]}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-headline font-bold text-on-surface truncate">{g.title}</span>
                      <span className="block text-xs text-on-surface-variant truncate">
                        {done ? (done.value != null ? `Confirmed: ${Math.round(done.value)}${g.type === 'calories' ? ' kcal' : '/12 groups'}` : done.achieved ? 'Done' : 'Missed') : goalSubtitle(g)}
                      </span>
                    </span>
                    <span className={`flex flex-col items-center flex-shrink-0 min-w-[44px] ${g.streak.current > 0 ? 'text-orange-500' : 'text-on-surface-variant/40'}`}>
                      <span className="flex items-center gap-0.5 text-lg font-extrabold font-headline leading-none">
                        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        {g.streak.current}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide">{g.streak.current === 1 ? 'day' : 'days'}</span>
                    </span>
                  </button>
                )
              })}
            </section>

            {todayPending ? (
              <button onClick={() => setCheckInDate(data.today)}
                className={`w-full py-4 rounded-full font-headline font-bold ${isEvening ? 'bg-primary text-on-primary shadow-card-md' : 'bg-secondary-container text-primary'}`}>
                {isEvening ? 'Time to check in for today' : 'Check in early'}
              </button>
            ) : (
              <button onClick={() => setCheckInDate(data.today)} className="w-full py-3 text-sm font-bold text-primary">Review today's check-in</button>
            )}

            {catchUp.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Catch up</p>
                {catchUp.map((d) => (
                  <button key={d.date} onClick={() => setCheckInDate(d.date)}
                    className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left">
                    <span className="text-sm font-medium text-amber-900 capitalize">Confirm {dayLabel(d.date, data.today)} · {d.done}/{d.total} done</span>
                    <span className="material-symbols-outlined text-amber-700 text-[20px]">chevron_right</span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <CheckInSheet data={data} date={checkInDate} onClose={() => setCheckInDate(null)} />

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
