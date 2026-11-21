import { useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { EmptyState } from '../../components/shared/EmptyState'
import { Skeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { useItemsQuery, useAddItemMutation, useToggleItemMutation, useDeleteItemMutation, useUpdateItemMutation } from '../../hooks/useLists'
import { kindOf } from '../../lib/listKinds'
import type { ShoppingList } from '../../types'

/** A plain checklist: used for every list kind except shopping. */
export function ChecklistPage({ list }: { list: ShoppingList }) {
  const kind = kindOf(list.kind)
  const { data: items, isLoading } = useItemsQuery(list.id)
  const addItem = useAddItemMutation(list.id)
  const toggle = useToggleItemMutation(list.id)
  const remove = useDeleteItemMutation(list.id)
  const update = useUpdateItemMutation(list.id)
  const [value, setValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const open = (items ?? []).filter((i) => !i.checked)
  const done = (items ?? []).filter((i) => i.checked)

  const submit = () => {
    const name = value.trim()
    if (!name) return
    setValue('')
    addItem.mutate({ name }, { onError: () => toast.error('Could not add item') })
  }

  const saveEdit = (id: string, original: string) => {
    const name = editText.trim()
    setEditingId(null)
    if (name && name !== original) update.mutate({ itemId: id, name })
  }

  const clearDone = () => done.forEach((i) => remove.mutate(i.id))

  const row = (i: (typeof open)[number]) => (
    <div key={i.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl shadow-card px-4 py-3">
      <button
        onClick={() => toggle.mutate({ itemId: i.id, checked: !i.checked })}
        aria-label={i.checked ? 'Mark not done' : 'Mark done'}
        className="flex-shrink-0 flex"
      >
        <span
          className={`material-symbols-outlined text-[26px] ${i.checked ? 'text-primary' : 'text-outline'}`}
          style={{ fontVariationSettings: `'FILL' ${i.checked ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
        >
          {i.checked ? 'check_circle' : 'radio_button_unchecked'}
        </span>
      </button>
      {editingId === i.id ? (
        <input
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={() => saveEdit(i.id, i.name)}
          onKeyDown={(e) => e.key === 'Enter' && saveEdit(i.id, i.name)}
          className="flex-1 min-w-0 bg-transparent text-on-surface focus:outline-none"
        />
      ) : (
        <button
          onClick={() => { setEditingId(i.id); setEditText(i.name) }}
          className={`flex-1 min-w-0 text-left truncate ${i.checked ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}
        >
          {i.name}
        </button>
      )}
      <button
        onClick={() => remove.mutate(i.id)}
        aria-label="Delete item"
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface pb-40">
      <TopBar title={list.name} showBack showAvatar />
      <main className="pt-topbar px-6 mt-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((n) => <Skeleton key={n} className="h-14 rounded-2xl" />)
        ) : !items?.length ? (
          <EmptyState icon={kind.icon} title="Nothing here yet" description={kind.emptyHint} />
        ) : (
          <>
            <div className="space-y-2">{open.map(row)}</div>
            {done.length > 0 && (
              <>
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Done · {done.length}</p>
                  <button onClick={clearDone} className="text-xs font-bold text-primary">Clear done</button>
                </div>
                <div className="space-y-2">{done.map(row)}</div>
              </>
            )}
          </>
        )}
      </main>

      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 w-full px-4 z-40">
        <div className="flex items-center gap-2 bg-surface-container-lowest rounded-full shadow-card-md pl-5 pr-2 py-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={kind.emptyHint}
            className="flex-1 min-w-0 bg-transparent text-on-surface focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Add"
            className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[22px]">add</span>
          </button>
        </div>
      </div>
    </div>
  )
}
