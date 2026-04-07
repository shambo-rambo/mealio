import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ListsState {
  activeListId: string | null
  activeView: 'all' | 'store'
  activeStoreId: string | null
  setActiveList: (id: string) => void
  setActiveView: (view: 'all' | 'store', storeId?: string) => void
}

export const useListsStore = create<ListsState>()(
  persist(
    (set) => ({
      activeListId: null,
      activeView: 'all',
      activeStoreId: null,

      setActiveList: (id) => set({ activeListId: id }),
      setActiveView: (view, storeId) =>
        set({ activeView: view, activeStoreId: storeId ?? null }),
    }),
    { name: 'mealio_lists' },
  ),
)
