import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { EmptyState } from '../../components/shared/EmptyState'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { Skeleton } from '../../components/shared/Skeleton'
import { useListsQuery, useCreateListMutation, useDeleteListMutation } from '../../hooks/useLists'
import { toast } from '../../components/shared/Toast'

export function ListsPage() {
  const navigate = useNavigate()
  const { data: lists, isLoading } = useListsQuery()
  const createList = useCreateListMutation()
  const deleteList = useDeleteListMutation()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (!isLoading && lists && lists.length === 1) {
    return <Navigate to={`/shopping/${lists[0].id}`} replace />
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const list = await createList.mutateAsync(newName.trim())
      setNewName('')
      setShowNew(false)
      navigate(`/shopping/${list.id}`)
    } catch {
      toast.error('Could not create list')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteList.mutateAsync(id)
      toast.success('List deleted')
    } catch {
      toast.error('Could not delete list')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Shopping" showAvatar right={
        <button
          onClick={() => setShowNew(true)}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-fab"
        >
          <span className="material-symbols-outlined text-on-primary text-[20px]">add</span>
        </button>
      } />

      <main className="pt-topbar px-6 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : !lists?.length ? (
          <EmptyState
            icon="shopping_basket"
            title="No lists yet"
            description="Create your first shopping list to get started."
            action={{ label: 'New list', onClick: () => setShowNew(true) }}
          />
        ) : (
          <div className="space-y-3">
            {lists.map((list) => (
              <div
                key={list.id}
                onClick={() => navigate(`/shopping/${list.id}`)}
                className="w-full bg-surface-container-lowest rounded-2xl shadow-card p-4 flex items-center gap-4 text-left hover:shadow-card-md transition-shadow cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary"
                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                    shopping_basket
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-on-surface truncate">{list.name}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {list.uncheckedCount ?? 0} item{list.uncheckedCount !== 1 ? 's' : ''} remaining
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(list.id) }}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">more_vert</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New list sheet */}
      <BottomSheet open={showNew} onClose={() => setShowNew(false)} title="New list" size="sm">
        <div className="space-y-4 py-2">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Weekly Shop"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createList.isPending}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
          >
            {createList.isPending ? 'Creating…' : 'Create list'}
          </button>
        </div>
      </BottomSheet>

      {/* Delete confirm sheet */}
      <BottomSheet open={!!deletingId} onClose={() => setDeletingId(null)} title="Delete list?" size="sm">
        <div className="space-y-4 py-2">
          <p className="text-on-surface-variant text-sm">
            This will permanently delete the list and all its items.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeletingId(null)}
              className="flex-1 py-3 rounded-full bg-surface-container font-headline font-bold text-on-surface"
            >
              Cancel
            </button>
            <button
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={deleteList.isPending}
              className="flex-1 py-3 rounded-full bg-error text-on-error font-headline font-bold disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
