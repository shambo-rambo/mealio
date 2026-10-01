import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'
import { normalizeItemName } from '../lib/itemMatch'
import type { ShoppingList, ShoppingItem, ItemHistorySuggestion } from '../types'

// ── Lists ──────────────────────────────────────────────────────────────────

export function useListsQuery() {
  return useQuery({
    queryKey: queryKeys.lists.all(),
    queryFn: () => api.get<{ lists: ShoppingList[] }>('/lists').then((r) => r.data.lists),
  })
}

export function useCreateListMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ list: ShoppingList }>('/lists', { name }).then((r) => r.data.list),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists.all() }),
  })
}

export function useDeleteListMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/lists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists.all() }),
  })
}

// ── Items ──────────────────────────────────────────────────────────────────

/** A recipe asking for some of an item. Recorded as its own line, never summed into the item. */
export interface RecipeNeed {
  id?: string | null
  title: string
  amount: string
  quantity?: number | null
  unit?: string | null
}

export function useItemsQuery(listId: string | null) {
  return useQuery({
    queryKey: queryKeys.lists.items(listId ?? ''),
    queryFn: () =>
      api.get<{ items: ShoppingItem[] }>(`/lists/${listId}/items`).then((r) => r.data.items),
    enabled: !!listId,
  })
}

export function useAddItemMutation(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ShoppingItem> & { name: string; amount?: string | null; recipe?: RecipeNeed | null }) =>
      api.post<{ item: ShoppingItem }>(`/lists/${listId}/items`, data).then((r) => r.data.item),
    onMutate: async (newItem) => {
      await qc.cancelQueries({ queryKey: queryKeys.lists.items(listId) })
      const prev = qc.getQueryData<ShoppingItem[]>(queryKeys.lists.items(listId))
      // Already have this product? Re-open it rather than showing a second row.
      const key = normalizeItemName(newItem.name)
      const match = prev?.find((i) => normalizeItemName(i.name) === key)
      if (match) {
        qc.setQueryData<ShoppingItem[]>(queryKeys.lists.items(listId), (old) =>
          old?.map((i) => (i.id === match.id ? { ...i, checked: false } : i)) ?? [],
        )
        return { prev }
      }
      const optimistic: ShoppingItem = {
        id: `temp_${Date.now()}`,
        listId,
        name: newItem.name,
        quantity: newItem.quantity ?? null,
        packageSize: null,
        category: newItem.category ?? null,
        storeId: newItem.storeId ?? null,
        price: null,
        imageUrl: null,
        note: null,
        checked: false,
        recipeSourceId: null,
        createdBy: null,
        updatedAt: new Date().toISOString(),
      }
      qc.setQueryData<ShoppingItem[]>(queryKeys.lists.items(listId), (old) => [
        ...(old ?? []),
        optimistic,
      ])
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.lists.items(listId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lists.items(listId) })
      qc.invalidateQueries({ queryKey: queryKeys.lists.all() })
    },
  })
}

export function useToggleItemMutation(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      api.patch<{ item: ShoppingItem }>(`/lists/${listId}/items/${itemId}`, { checked }).then((r) => r.data.item),
    onMutate: async ({ itemId, checked }) => {
      await qc.cancelQueries({ queryKey: queryKeys.lists.items(listId) })
      const prev = qc.getQueryData<ShoppingItem[]>(queryKeys.lists.items(listId))
      qc.setQueryData<ShoppingItem[]>(queryKeys.lists.items(listId), (old) =>
        old?.map((i) => (i.id === itemId ? { ...i, checked } : i)) ?? [],
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.lists.items(listId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lists.items(listId) })
      qc.invalidateQueries({ queryKey: queryKeys.lists.all() })
      qc.invalidateQueries({ queryKey: ['pantry', 'history'] })
    },
  })
}

export function useUpdateItemMutation(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...data }: Partial<ShoppingItem> & { itemId: string }) =>
      api.patch<{ item: ShoppingItem }>(`/lists/${listId}/items/${itemId}`, data).then((r) => r.data.item),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lists.items(listId) })
    },
  })
}

/** Add / tick / edit / remove the itemised amounts behind one item. */
export function useItemLineMutations(listId: string) {
  const qc = useQueryClient()
  const done = (item: ShoppingItem) =>
    qc.setQueryData<ShoppingItem[]>(queryKeys.lists.items(listId), (old) => old?.map((i) => (i.id === item.id ? { ...i, ...item } : i)) ?? [])
  const base = (itemId: string) => `/lists/${listId}/items/${itemId}/lines`
  return {
    add: useMutation({
      mutationFn: ({ itemId, amount }: { itemId: string; amount: string }) =>
        api.post<{ item: ShoppingItem }>(base(itemId), { amount }).then((r) => r.data.item),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ itemId, lineId, ...data }: { itemId: string; lineId: string; amount?: string; selected?: boolean }) =>
        api.patch<{ item: ShoppingItem }>(`${base(itemId)}/${lineId}`, data).then((r) => r.data.item),
      onMutate: async ({ itemId, lineId, selected }) => {
        if (selected === undefined) return
        qc.setQueryData<ShoppingItem[]>(queryKeys.lists.items(listId), (old) =>
          old?.map((i) => i.id === itemId ? { ...i, lines: i.lines?.map((l) => (l.id === lineId ? { ...l, selected } : l)) } : i) ?? [])
      },
      onSuccess: done,
      onError: () => qc.invalidateQueries({ queryKey: queryKeys.lists.items(listId) }),
    }),
    remove: useMutation({
      mutationFn: ({ itemId, lineId }: { itemId: string; lineId: string }) =>
        api.delete<{ item: ShoppingItem }>(`${base(itemId)}/${lineId}`).then((r) => r.data.item),
      onSuccess: done,
    }),
  }
}

export function useDeleteItemMutation(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api.delete(`/lists/${listId}/items/${itemId}`),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: queryKeys.lists.items(listId) })
      const prev = qc.getQueryData<ShoppingItem[]>(queryKeys.lists.items(listId))
      qc.setQueryData<ShoppingItem[]>(queryKeys.lists.items(listId), (old) =>
        old?.filter((i) => i.id !== itemId) ?? [],
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.lists.items(listId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lists.items(listId) })
      qc.invalidateQueries({ queryKey: queryKeys.lists.all() })
    },
  })
}

// ── Suggestions ─────────────────────────────────────────────────────────────

export function useItemSuggestions(query: string) {
  return useQuery({
    queryKey: queryKeys.itemHistory(query),
    queryFn: () =>
      api.get<{ suggestions: ItemHistorySuggestion[] }>(`/lists/suggestions?q=${encodeURIComponent(query)}`).then((r) => r.data.suggestions),
    enabled: query.trim().length > 0,
    staleTime: 10_000,
  })
}

export function usePantryHistoryQuery() {
  return useQuery({
    queryKey: ['pantry', 'history'],
    queryFn: () =>
      api.get<{ suggestions: ItemHistorySuggestion[] }>('/lists/suggestions?q=').then((r) => r.data.suggestions),
    staleTime: 30_000,
  })
}

export function useDeletePantryItemMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/lists/suggestions/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['pantry', 'history'] })
      const prev = qc.getQueryData<ItemHistorySuggestion[]>(['pantry', 'history'])
      qc.setQueryData<ItemHistorySuggestion[]>(['pantry', 'history'], (old) => (old ?? []).filter((i) => i.id !== id))
      return { prev }
    },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(['pantry', 'history'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['pantry', 'history'] }),
  })
}

// ── Stores ────────────────────────────────────────────────────────────────

import type { Store } from '../types'

export function useStoresQuery() {
  return useQuery({
    queryKey: queryKeys.stores(),
    queryFn: () => api.get<{ stores: Store[] }>('/stores').then((r) => r.data.stores),
  })
}

export function useCreateStoreMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<{ store: Store }>('/stores', { name }).then((r) => r.data.store),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores() }),
  })
}

export function useDeleteStoreMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/stores/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stores() }),
  })
}
