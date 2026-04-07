import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { toast } from '../../components/shared/Toast'
import { useStoresQuery, useCreateStoreMutation, useDeleteStoreMutation } from '../../hooks/useLists'

export function StoresPage() {
  const navigate = useNavigate()
  const { data: stores = [], isLoading } = useStoresQuery()
  const createStore = useCreateStoreMutation()
  const deleteStore = useDeleteStoreMutation()
  const [newName, setNewName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createStore.mutateAsync(newName.trim())
      setNewName('')
      toast.success('Store added')
    } catch {
      toast.error('Could not add store')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStore.mutateAsync(id)
      toast.success('Store removed')
    } catch {
      toast.error('Could not remove store')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Stores" showBack onBack={() => navigate(-1)} />

      <div className="pt-20 px-4 mt-2 space-y-4">
        {/* Add store */}
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Store name (e.g. Woolworths)"
            className="flex-1 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createStore.isPending}
            className="px-4 py-3 rounded-xl bg-primary text-on-primary font-headline font-bold text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Store list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-surface-container-low animate-pulse" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant">store</span>
            <p className="font-headline font-bold text-on-surface mt-2">No stores yet</p>
            <p className="text-sm text-on-surface-variant mt-1">Add stores to organise your shopping lists by location.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stores.map((store) => (
              <div key={store.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-card">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">store</span>
                <p className="flex-1 font-medium text-on-surface">{store.name}</p>
                {deletingId === store.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(store.id)}
                      className="px-3 py-1 rounded-full bg-error text-on-error text-xs font-bold"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1 rounded-full bg-surface-container text-on-surface text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(store.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
