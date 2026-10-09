import { useQueries } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { classifyDay, type DailyDozenId } from '../lib/dailyDozen'
import { useMealPlanQuery, groupByDate } from './usePlanner'
import type { Recipe } from '../types'

export interface DayPlan {
  categories: Set<DailyDozenId>
  /** Sum of per-serving calories of planned recipes (one serving each). */
  calories: number
  /** Planned meals we couldn't put a calorie figure on (notes, or recipes without nutrition). */
  uncounted: number
  meals: number
}

/** What the meal plan says each day in [start, end] adds up to, for pre-filling a streak check-in. */
export function useDayPlans(start: string, end: string, enabled = true) {
  const { data: entries = [], isLoading } = useMealPlanQuery(enabled ? start : '', enabled ? end : '')
  const ids = [...new Set(entries.filter((e) => e.recipeId).map((e) => e.recipeId!))]
  const recipeQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.recipes.detail(id),
      queryFn: () => api.get<{ recipe: Recipe }>(`/recipes/${id}`).then((r) => r.data.recipe),
      staleTime: 5 * 60_000,
    })),
  })
  const recipes: Record<string, Recipe> = {}
  for (const q of recipeQueries) if (q.data) recipes[q.data.id] = q.data

  const plans: Record<string, DayPlan> = {}
  for (const [date, dayEntries] of Object.entries(groupByDate(entries))) {
    let calories = 0
    let uncounted = 0
    for (const e of dayEntries) {
      const kcal = e.recipeId ? recipes[e.recipeId]?.nutrition?.calories : null
      if (kcal != null) calories += kcal
      else uncounted++
    }
    plans[date] = {
      categories: classifyDay(
        dayEntries.map((e) => ({
          recipeTitle: e.recipe?.title,
          ingredients: e.recipeId
            ? (recipes[e.recipeId]?.ingredients?.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })) ?? [])
            : [],
          noteText: e.noteText,
          dayNote: e.dayNote,
        })),
      ),
      calories: Math.round(calories),
      uncounted,
      meals: dayEntries.length,
    }
  }

  return { plans, loading: enabled && (isLoading || recipeQueries.some((q) => q.isLoading)) }
}
