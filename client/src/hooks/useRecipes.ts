import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import type { Recipe, Collection, RecipeImportResult } from '../types'

export function useRecipesQuery(filters?: { search?: string; collection?: string; tag?: string }) {
  const params = new URLSearchParams()
  if (filters?.search) params.set('search', filters.search)
  if (filters?.collection) params.set('collection', filters.collection)
  if (filters?.tag) params.set('tag', filters.tag)

  return useQuery({
    queryKey: queryKeys.recipes.all(filters),
    queryFn: () =>
      api.get<{ recipes: Recipe[] }>(`/recipes?${params}`).then((r) => r.data.recipes),
  })
}

export function useRecipeQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.recipes.detail(id ?? ''),
    queryFn: () => api.get<{ recipe: Recipe }>(`/recipes/${id}`).then((r) => r.data.recipe),
    enabled: !!id,
  })
}

export function usePublicRecipeQuery(token: string | null) {
  return useQuery({
    queryKey: queryKeys.recipes.public(token ?? ''),
    queryFn: () => api.get<{ recipe: Recipe }>(`/public/recipes/${token}`).then((r) => r.data.recipe),
    enabled: !!token,
  })
}

export function useSaveRecipeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Recipe> & { title: string }) =>
      api.post<{ recipe: Recipe }>('/recipes', data).then((r) => r.data.recipe),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recipes.all() }),
  })
}

export function useUpdateRecipeMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Recipe>) =>
      api.patch<{ recipe: Recipe }>(`/recipes/${id}`, data).then((r) => r.data.recipe),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recipes.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.recipes.all() })
    },
  })
}

export function useDeleteRecipeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recipes.all() }),
  })
}

export function useImportRecipeMutation() {
  return useMutation({
    mutationFn: (data: { type: 'url' | 'text' | 'photo'; payload: string; mediaType?: string }) =>
      api.post<{ result: RecipeImportResult }>('/recipes/import', data).then((r) => r.data.result),
  })
}

export function useRateRecipeMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rating: number) =>
      api.post<{ averageRating: number; userRating: number }>(`/recipes/${id}/rate`, { rating }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recipes.detail(id) }),
  })
}

export function useCollectionsQuery() {
  return useQuery({
    queryKey: queryKeys.collections(),
    queryFn: () => api.get<{ collections: Collection[] }>('/collections').then((r) => r.data.collections),
  })
}

// Scaling logic
export function scaleIngredients(
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null; prepNote: string | null }>,
  fromServings: number,
  toServings: number,
) {
  const factor = toServings / fromServings
  return ingredients.map((ing) => {
    if (ing.quantity == null) return { ...ing, scaled: null, isRounded: false }
    const raw = ing.quantity * factor
    const rounded = parseFloat(raw.toFixed(2))
    const isRounded = Math.abs(raw - Math.round(raw * 8) / 8) > 0.01
    return { ...ing, scaled: rounded, isRounded }
  })
}
