import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { MealPlanEntry, SuggestTurnRequest, SuggestTurnResponse } from '../types'

export function useMealPlanQuery(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.mealPlan(start, end),
    queryFn: () =>
      api.get<{ entries: MealPlanEntry[] }>(`/meal-plan?start=${start}&end=${end}`)
        .then((r) => r.data.entries),
    enabled: !!start && !!end,
  })
}

export function useAddMealMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      date: string
      mealLabel: 'breakfast' | 'lunch' | 'dinner'
      recipeId?: string | null
      noteText?: string | null
      isRecurring?: boolean
      recurrenceRule?: string | null
    }) => api.post<{ entry: MealPlanEntry }>('/meal-plan', data).then((r) => r.data.entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan'] }),
  })
}

export function useUpdateMealMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scope, ...data }: Partial<MealPlanEntry> & { id: string; scope?: string }) =>
      api.patch<{ entry: MealPlanEntry }>(`/meal-plan/${id}?scope=${scope ?? 'one'}`, data).then((r) => r.data.entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan'] }),
  })
}

export function useDeleteMealMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: string }) =>
      api.delete(`/meal-plan/${id}?scope=${scope ?? 'one'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan'] }),
  })
}

export function useSuggestMealMutation() {
  return useMutation({
    mutationFn: (req: SuggestTurnRequest) =>
      api.post<SuggestTurnResponse>('/meal-plan/suggest', req).then((r) => r.data),
  })
}

// Group entries by date
export function groupByDate(entries: MealPlanEntry[]): Record<string, MealPlanEntry[]> {
  const grouped: Record<string, MealPlanEntry[]> = {}
  for (const entry of entries) {
    if (!grouped[entry.date]) grouped[entry.date] = []
    grouped[entry.date].push(entry)
  }
  // Sort each day: breakfast, lunch, dinner
  const order = { breakfast: 0, lunch: 1, dinner: 2 }
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => order[a.mealLabel] - order[b.mealLabel])
  }
  return grouped
}

/** YYYY-MM-DD in the user's local timezone (toISOString() would shift days in non-UTC zones). */
export function toLocalIso(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function getWeekDates(weekOffset = 0): string[] {
  const today = new Date()
  // European week: Mon=0 … Sun=6. JS getDay(): Sun=0, Mon=1 … Sat=6
  const dayOfWeek = today.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toLocalIso(d)
  })
}

export function formatDate(iso: string): { day: string; date: number; isToday: boolean } {
  const d = new Date(`${iso}T00:00:00`)
  const today = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    day: days[d.getDay()],
    date: d.getDate(),
    isToday: iso === toLocalIso(today),
  }
}
