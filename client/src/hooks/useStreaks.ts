import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { toLocalIso } from './usePlanner'

export type GoalType = 'custom' | 'calories' | 'daily_dozen'

export interface StreakGoal {
  id: string
  type: GoalType
  title: string
  target: number | null
  comparator: 'lte' | 'gte'
  sortOrder: number
  createdDate: string
  streak: { current: number; best: number }
}

export interface StreakDay {
  date: string
  total: number
  done: number
}

export interface StreakCheckin {
  goalId: string
  date: string
  achieved: boolean
  value: number | null
}

export interface StreaksData {
  today: string
  streak: { current: number; best: number; todayDone: boolean }
  goals: StreakGoal[]
  history: StreakDay[]
  checkins: StreakCheckin[]
}

export function useStreaksQuery() {
  const today = toLocalIso()
  return useQuery({
    queryKey: ['streaks', today],
    queryFn: () => api.get<StreaksData>(`/streaks?today=${today}`).then((r) => r.data),
  })
}

export interface GoalInput {
  type: GoalType
  title?: string
  target?: number | null
  comparator?: 'lte' | 'gte'
}

export function useSaveGoalMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...goal }: GoalInput & { id?: string }) =>
      id
        ? api.patch(`/streaks/goals/${id}`, { title: goal.title, target: goal.target ?? undefined, comparator: goal.comparator })
        : api.post('/streaks/goals', { ...goal, today: toLocalIso() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['streaks'] }),
  })
}

export function useDeleteGoalMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/streaks/goals/${id}?today=${toLocalIso()}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['streaks'] }),
  })
}

export interface CheckinEntry {
  goalId: string
  achieved?: boolean
  value?: number
}

export function useCheckinMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, entries }: { date: string; entries: CheckinEntry[] }) =>
      api.put('/streaks/checkins', { date, today: toLocalIso(), entries }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['streaks'] }),
  })
}

/** Does this goal's target get met by `value`? Mirrors the server's rule for instant feedback. */
export function meetsGoal(goal: Pick<StreakGoal, 'target' | 'comparator'>, value: number | null): boolean {
  if (value == null || goal.target == null) return false
  return goal.comparator === 'lte' ? value <= goal.target : value >= goal.target
}

export function goalSubtitle(g: Pick<StreakGoal, 'type' | 'target' | 'comparator'>): string {
  if (g.type === 'calories') return 'Totalled from your meal plan'
  if (g.type === 'daily_dozen') return 'Automatic from your meal plan'
  return 'Tap the circle when done'
}

export const goalIcon: Record<GoalType, string> = {
  custom: 'task_alt',
  calories: 'local_fire_department',
  daily_dozen: 'nutrition',
}
