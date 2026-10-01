import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { EmptyState } from '../../components/shared/EmptyState'
import { CategorySkeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { BarcodeScanner } from '../../components/shared/BarcodeScanner'
import {
  useItemsQuery, useListsQuery, useAddItemMutation, useToggleItemMutation,
  useUpdateItemMutation, useDeleteItemMutation, useItemSuggestions,
  useStoresQuery, useCreateStoreMutation, useItemLineMutations, usePantryHistoryQuery, useDeletePantryItemMutation,
} from '../../hooks/useLists'
import { useMealPlanQuery, getWeekDates } from '../../hooks/usePlanner'
import { queryKeys } from '../../lib/queryKeys'
import type { ShoppingItem, Store, ItemHistorySuggestion, Recipe } from '../../types'
import { CATEGORIES } from '../../types'
import { api } from '../../lib/api'
import { normalizeItemName, ingredientStatuses, STATUS_LABEL } from '../../lib/itemMatch'
import { describeNeed, normalizeUnit, summariseLines } from '../../lib/amounts'

// ── Sortable item list ────────────────────────────────────────────────────────

/** What to show next to an item's name: its ticked amounts, or the legacy package size. */
function itemAmount(item: ShoppingItem): string {
  return item.lines?.length ? summariseLines(item.lines) : (item.packageSize ?? '')
}

function sortByCategory(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) =>
    (a.category ?? 'Other').localeCompare(b.category ?? 'Other') ||
    a.name.localeCompare(b.name)
  )
}

function SortableItemList({
  items,
  onToggle,
  onEdit,
  onDelete,
}: {
  items: ShoppingItem[]
  onToggle: (item: ShoppingItem) => void
  onEdit: (item: ShoppingItem) => void
  onDelete: (item: ShoppingItem) => void
}) {
  const [order, setOrder] = useState<string[]>(() => sortByCategory(items).map((i) => i.id))
  const orderRef = useRef(order)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const isDragging = useRef(false)
  const itemEls = useRef<Map<string, HTMLDivElement>>(new Map())

  // Keep ref in sync with state (for use inside stable event listeners)
  useEffect(() => { orderRef.current = order }, [order])

  // Sync when items are added or removed, preserving existing order
  const itemIds = items.map((i) => i.id).join(',')
  useEffect(() => {
    setOrder((prev) => {
      const incoming = new Set(items.map((i) => i.id))
      const kept = prev.filter((id) => incoming.has(id))
      const added = sortByCategory(items.filter((i) => !prev.includes(i.id))).map((i) => i.id)
      return [...kept, ...added]
    })
  }, [itemIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = useCallback((id: string) => {
    isDragging.current = true
    setDraggingId(id)

    const handleMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      e.preventDefault()
      const y = e.touches[0].clientY
      let targetId: string | null = null
      itemEls.current.forEach((el, elId) => {
        const rect = el.getBoundingClientRect()
        if (y >= rect.top && y < rect.bottom) targetId = elId
      })
      if (targetId && targetId !== id) {
        const curr = orderRef.current
        const from = curr.indexOf(id)
        const to = curr.indexOf(targetId)
        if (from !== -1 && to !== -1) {
          const next = [...curr]
          next.splice(from, 1)
          next.splice(to, 0, id)
          setOrder(next)
        }
      }
    }

    const handleEnd = () => {
      isDragging.current = false
      setDraggingId(null)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }

    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }, [])

  const sorted = order
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ShoppingItem => i != null)

  return (
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card divide-y divide-outline-variant/15">
      {sorted.map((item) => (
        <SwipeRow key={item.id} onDelete={() => onDelete(item)} deleteLabel="Delete item">
        <div
          ref={(el) => { if (el) itemEls.current.set(item.id, el); else itemEls.current.delete(item.id) }}
          className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${draggingId === item.id ? 'bg-surface-container' : ''}`}
        >
          {/* Checkbox */}
          <button
            onClick={() => onToggle(item)}
            className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center border-2 transition-all active:scale-95 ${
              item.checked ? 'bg-primary border-primary' : 'border-outline-variant'
            }`}
          >
            {item.checked && (
              <span className="material-symbols-outlined text-on-primary text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 20" }}>
                check
              </span>
            )}
          </button>

          {/* Name + size — tap to edit */}
          <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`font-semibold text-on-surface ${item.checked ? 'line-through text-on-surface-variant/60' : ''}`}>
                {item.name}
              </span>
              {itemAmount(item) && (
                <span className="text-sm text-on-surface-variant/60">{itemAmount(item)}</span>
              )}
            </div>
            {(item.note || item.price != null) && (
              <div className="flex items-center gap-2 mt-0.5">
                {item.note && <span className="text-xs text-on-surface-variant italic truncate max-w-[180px]">{item.note}</span>}
                {item.price != null && <span className="text-xs text-on-surface-variant">${item.price.toFixed(2)}</span>}
              </div>
            )}
          </button>

          {/* Drag handle */}
          <div
            onTouchStart={() => startDrag(item.id)}
            className="px-1 py-2 touch-none select-none cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <span className="material-symbols-outlined text-outline-variant/50 text-[22px]">drag_indicator</span>
          </div>
        </div>
        </SwipeRow>
      ))}
    </div>
  )
}

// ── Amounts ledger: the itemised "why is this on the list" behind an item ────

function AmountsLedger({ listId, item }: { listId: string; item: ShoppingItem }) {
  const lines = item.lines ?? []
  const { add, update, remove } = useItemLineMutations(listId)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const summary = summariseLines(lines)
  const hasCovered = lines.some((l) => !l.selected)

  const submit = () => {
    if (!draft.trim()) return
    add.mutate({ itemId: item.id, amount: draft.trim() })
    setDraft('')
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-xs font-medium text-on-surface-variant">Amounts</label>
        {summary && <span className="text-xs font-bold text-primary">Buying {summary}</span>}
      </div>

      {lines.length > 0 && (
        <div className="rounded-xl border border-outline-variant/40 divide-y divide-outline-variant/20 overflow-hidden mb-2">
          {lines.map((line) => (
            <div key={line.id} className={`flex items-center gap-3 px-3 py-2.5 ${line.selected ? '' : 'bg-surface-container-low'}`}>
              <button
                onClick={() => update.mutate({ itemId: item.id, lineId: line.id, selected: !line.selected })}
                aria-label={line.selected ? 'Leave this out' : 'Include this'}
                aria-pressed={line.selected}
                className="flex-shrink-0"
              >
                <span
                  className={`material-symbols-outlined text-[22px] ${line.selected ? 'text-primary' : 'text-outline'}`}
                  style={{ fontVariationSettings: line.selected ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  {line.selected ? 'check_box' : 'check_box_outline_blank'}
                </span>
              </button>
              <div className="flex-1 min-w-0">
                {editingId === line.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => {
                      if (editText.trim() && editText.trim() !== line.amount) {
                        update.mutate({ itemId: item.id, lineId: line.id, amount: editText.trim() })
                      }
                      setEditingId(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-full bg-transparent border-b border-primary text-sm font-semibold text-on-surface outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(line.id); setEditText(line.amount) }}
                    className={`text-sm font-semibold text-left ${line.selected ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}
                  >
                    {line.amount || 'As needed'}
                  </button>
                )}
                <p className="text-xs text-on-surface-variant truncate">
                  {line.source === 'recipe' ? line.sourceName : 'Usual buy'}
                  {!line.selected && line.source === 'recipe' && ' · probably covered'}
                </p>
              </div>
              <button
                onClick={() => remove.mutate({ itemId: item.id, lineId: line.id })}
                aria-label="Remove this amount"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant active:bg-surface-container flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {hasCovered && (
        <p className="text-xs text-on-surface-variant mb-2">Unticked amounts aren't counted. Tick one if you need to buy it as well.</p>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={lines.length ? 'Add another amount, e.g. 500 g' : 'How much? e.g. 1 kg'}
          className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || add.isPending}
          className="px-4 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Item detail sheet ────────────────────────────────────────────────────────

function ItemDetailSheet({
  item,
  listId,
  stores,
  onClose,
}: {
  item: ShoppingItem | null
  listId: string
  stores: Store[]
  onClose: () => void
}) {
  const updateItem = useUpdateItemMutation(listId)
  const deleteItem = useDeleteItemMutation(listId)
  const [form, setForm] = useState<Partial<ShoppingItem>>({})
  const [uploading, setUploading] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!item) return
    if (item.id !== openedIdRef.current) {
      // Different item opened — full reset
      openedIdRef.current = item.id
      setForm({ ...item })
      setShowMore(!!(item.note || item.price != null || item.imageUrl))
    } else if (item.category && !form.category) {
      // AI category arrived while sheet is open — merge it in without resetting other fields
      setForm((f) => ({ ...f, category: item.category }))
    }
  }, [item])

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post<{ url: string }>('/upload', fd)
      setForm((f) => ({ ...f, imageUrl: data.url }))
    } catch {
      toast.error('Could not upload photo')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!item) return
    try {
      const { lines: _lines, quantity: _q, packageSize: _p, ...fields } = form
      await updateItem.mutateAsync({ itemId: item.id, ...fields })
      toast.success('Item updated')
      onClose()
    } catch {
      toast.error('Could not update item')
    }
  }

  return (
    <BottomSheet open={!!item} onClose={onClose} title="Edit item" size="lg">
      <div className="space-y-4 pb-4">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Name</label>
          <input
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        {item && <AmountsLedger listId={listId} item={item} />}

        <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Category</label>
          <select
            value={form.category ?? ''}
            onChange={(e) => setForm({ ...form, category: e.target.value || null })}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">No category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Store</label>
          <select
            value={form.storeId ?? ''}
            onChange={(e) => setForm({ ...form, storeId: e.target.value || null })}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">No store assigned</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="w-full flex items-center justify-between text-sm font-bold text-on-surface-variant py-1"
        >
          More details
          <span className="material-symbols-outlined text-[20px]">{showMore ? 'expand_less' : 'expand_more'}</span>
        </button>
        {showMore && (
          <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Note</label>
          <input
            value={form.note ?? ''}
            onChange={(e) => setForm({ ...form, note: e.target.value || null })}
            placeholder="e.g. Get the no-added-salt version"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Price</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.price ?? ''}
              onChange={(e) => setForm({ ...form, price: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full pl-8 pr-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-2">Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
          />
          {form.imageUrl ? (
            <div className="relative w-24 h-24">
              <img src={form.imageUrl} alt="" className="w-24 h-24 rounded-xl object-cover" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40"
              >
                <span className="material-symbols-outlined text-white text-[20px]">edit</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-on-surface-variant text-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">{uploading ? 'hourglass_empty' : 'add_photo_alternate'}</span>
              {uploading ? 'Uploading…' : 'Add photo'}
            </button>
          )}
        </div>

          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={async () => {
              if (!item) return
              deleteItem.mutate(item.id)
              toast.success('Item removed')
              onClose()
            }}
            disabled={deleteItem.isPending}
            className="px-5 py-3.5 rounded-full border border-error text-error font-headline font-bold disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={save}
            disabled={updateItem.isPending}
            className="flex-1 py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
          >
            {updateItem.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ── Eye toggle: hide crossed-off / deselected rows (remembered per device) ─────

function useHideDone(storageKey: string) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })
  const toggle = () =>
    setHidden((h) => {
      try { localStorage.setItem(storageKey, h ? '0' : '1') } catch { /* private mode */ }
      return !h
    })
  return [hidden, toggle] as const
}

function EyeToggle({ hidden, onToggle, label }: { hidden: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
      aria-pressed={hidden}
      title={hidden ? `Show ${label}` : `Hide ${label}`}
      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        hidden ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{hidden ? 'visibility_off' : 'visibility'}</span>
    </button>
  )
}

// ── Swipe row (left = delete, right = add to list) ───────────────────────────

function SwipeRow({ onDelete, onAdd, deleteLabel = 'Delete from pantry', children }: { onDelete: () => void; onAdd?: () => void; deleteLabel?: string; children: React.ReactNode }) {
  const REVEAL = 88
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const locked = useRef<'h' | 'v' | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx }
    locked.current = null
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return
    const mx = e.touches[0].clientX - start.current.x
    const my = e.touches[0].clientY - start.current.y
    if (!locked.current && (Math.abs(mx) > 8 || Math.abs(my) > 8)) locked.current = Math.abs(mx) > Math.abs(my) ? 'h' : 'v'
    if (locked.current !== 'h') return
    setDragging(true)
    setDx(Math.max(-REVEAL * 1.5, Math.min(onAdd ? REVEAL * 1.5 : 0, start.current.base + mx)))
  }
  const onTouchEnd = () => {
    setDragging(false)
    if (dx < -REVEAL * 1.2) onDelete()
    else if (onAdd && dx > REVEAL * 1.2) { onAdd(); setDx(0) }
    else if (dx < -REVEAL / 2) setDx(-REVEAL)
    else if (onAdd && dx > REVEAL / 2) setDx(REVEAL)
    else setDx(0)
    start.current = null
  }

  return (
    <div className="relative overflow-hidden">
      {onAdd && (
        <button
          onClick={() => { onAdd(); setDx(0) }}
          aria-label="Add to shopping list"
          className="absolute inset-y-0 left-0 bg-primary text-on-primary flex items-center justify-center"
          style={{ width: REVEAL }}
        >
          <span className="material-symbols-outlined">add_shopping_cart</span>
        </button>
      )}
      <button
        onClick={onDelete}
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 bg-error text-on-error flex items-center justify-center"
        style={{ width: REVEAL }}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <div
        className="relative bg-surface-container-lowest"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

// ── Pantry view ───────────────────────────────────────────────────────────────

function PantryView({
  historyItems,
  currentItems,
  onAdd,
}: {
  historyItems: ItemHistorySuggestion[]
  currentItems: ShoppingItem[]
  onAdd: (name: string, category: string | null) => void
}) {
  const activeNames = new Set(currentItems.filter((i) => !i.checked).map((i) => normalizeItemName(i.name)))
  const deletePantryItem = useDeletePantryItemMutation()

  if (historyItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] opacity-30">shelves</span>
        <p className="text-sm">Your pantry is empty. Items you tick off the shopping list land here.</p>
      </div>
    )
  }

  // Group by category
  const groups: Record<string, ItemHistorySuggestion[]> = {}
  for (const item of historyItems) {
    const cat = item.category ?? 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  const categoryKeys = Object.keys(groups).sort()

  return (
    <div className="space-y-6">
      {categoryKeys.map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest">{cat}</h2>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card divide-y divide-outline-variant/20">
            {groups[cat].map((item) => {
              const onList = activeNames.has(normalizeItemName(item.name))
              return (
                <SwipeRow
                  key={item.id}
                  onDelete={() => deletePantryItem.mutate(item.id)}
                  onAdd={onList ? undefined : () => onAdd(item.name, item.category)}
                >
                  <div className="w-full flex items-center gap-3 px-4 py-3">
                    <span className={`font-medium flex-1 min-w-0 truncate ${onList ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{item.name}</span>
                    {onList && (
                      <span className="flex items-center gap-1 text-xs text-primary font-bold">
                        <span className="material-symbols-outlined text-[16px]"
                          style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}>shopping_cart</span>
                        On list
                      </span>
                    )}
                  </div>
                </SwipeRow>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Add item bar ─────────────────────────────────────────────────────────────

function AddItemBar({ listId, onNewItem }: { listId: string; onNewItem: (item: ShoppingItem) => void }) {
  const [value, setValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const addItem = useAddItemMutation(listId)
  const { data: suggestions } = useItemSuggestions(value)

  const submit = async (name: string, fromSuggestion = false) => {
    if (!name.trim()) return
    try {
      const item = await addItem.mutateAsync({ name: name.trim() })
      setValue('')
      setShowSuggestions(false)
      // Auto-open edit sheet only for brand-new items (not pulled from history)
      if (!fromSuggestion) onNewItem(item)
    } catch {
      toast.error('Could not add item')
    }
  }

  const handleBarcodeScan = (text: string) => {
    setShowScanner(false)
    setValue(text)
    setShowSuggestions(true)
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onDetect={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}

      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 w-full px-4 z-40">
        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions && suggestions.length > 0 && value.trim() && (
          <div className="mb-2 bg-surface-container-lowest rounded-2xl shadow-card-md overflow-hidden">
            {suggestions.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => submit(s.name, true)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">history</span>
                <span className="text-on-surface text-sm">{s.name}</span>
                {s.category && <span className="text-xs text-on-surface-variant ml-auto">{s.category}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="glass-dark rounded-full shadow-card-md flex items-center px-4 py-3 gap-3">
          <span className="material-symbols-outlined text-primary flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
            add_circle
          </span>
          <input
            value={value}
            onChange={(e) => { const v = e.target.value; setValue(v.length > 0 ? v.charAt(0).toUpperCase() + v.slice(1) : v); setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => e.key === 'Enter' && submit(value)}
            placeholder="Add an item…"
            className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 font-medium outline-none"
          />
          <button
            onClick={() => setShowScanner(true)}
            className="material-symbols-outlined text-on-surface-variant p-1 hover:bg-surface-container-high rounded-full transition-colors flex-shrink-0"
          >
            barcode_scanner
          </button>
        </div>
      </div>
    </>
  )
}

// ── Shop plan view ────────────────────────────────────────────────────────────

type AggIngredient = {
  name: string
  unit: string | null
  totalQty: number | null   // null if any source has no quantity
  count: number             // total meal-plan occurrences using this ingredient
  sources: string[]         // unique recipe titles
}

function fmtQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function ingKey(ing: AggIngredient): string {
  return `${ing.name.toLowerCase().trim()}|${ing.unit?.toLowerCase().trim() ?? ''}`
}

function ShopPlanView({ listId }: { listId: string }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDates = getWeekDates(weekOffset)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  const { data: entries = [], isLoading: planLoading } = useMealPlanQuery(weekStart, weekEnd)
  const addItem = useAddItemMutation(listId)
  const { data: listItems } = useItemsQuery(listId)
  const { data: pantry = [] } = usePantryHistoryQuery()
  const [hideDeselected, toggleHideDeselected] = useHideDone('mealio-plan-hide-deselected')

  // Count how many times each unique recipe appears this week
  const recipeCounts: Record<string, number> = {}
  for (const e of entries) {
    if (e.recipeId) recipeCounts[e.recipeId] = (recipeCounts[e.recipeId] ?? 0) + 1
  }
  const recipeIds = Object.keys(recipeCounts)

  // Batch-fetch full recipe details (ingredients not included in the plan query)
  const recipeQueries = useQueries({
    queries: recipeIds.map((id) => ({
      queryKey: queryKeys.recipes.detail(id),
      queryFn: () => api.get<{ recipe: Recipe }>(`/recipes/${id}`).then((r) => r.data.recipe),
    })),
  })

  const isLoading = planLoading || recipeQueries.some((q) => q.isLoading)

  // Aggregate ingredients across all recipes, merging by (name, unit)
  const agg = new Map<string, AggIngredient>()
  if (!isLoading) {
    for (const q of recipeQueries) {
      const recipe = q.data
      if (!recipe?.ingredients?.length) continue
      const n = recipeCounts[recipe.id] ?? 1

      for (const ing of recipe.ingredients) {
        const key = `${ing.name.toLowerCase().trim()}|${ing.unit?.toLowerCase().trim() ?? ''}`
        const existing = agg.get(key)
        if (existing) {
          existing.count += n
          if (existing.totalQty !== null && ing.quantity != null) {
            existing.totalQty += ing.quantity * n
          } else {
            existing.totalQty = null
          }
          if (!existing.sources.includes(recipe.title)) existing.sources.push(recipe.title)
        } else {
          agg.set(key, {
            name: ing.name,
            unit: ing.unit ?? null,
            totalQty: ing.quantity != null ? ing.quantity * n : null,
            count: n,
            sources: [recipe.title],
          })
        }
      }
    }
  }

  const ingredients = [...agg.values()]

  // Selection — auto-select all when the ingredient list first loads or week changes.
  // We detect a "new load" by comparing a fingerprint of weekOffset + ingredient names.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [lastLoadKey, setLastLoadKey] = useState('')
  const loadKey = `${weekOffset}|${isLoading ? '' : ingredients.map((i) => i.name).join(',')}`
  const statusOf = ingredientStatuses(listItems ?? [], pantry)
  // Only pre-select what needs buying: skip what's already on the list or in the pantry
  if (!isLoading && listItems && loadKey !== lastLoadKey) {
    setLastLoadKey(loadKey)
    setSelectedKeys(new Set(ingredients.filter((i) => statusOf(i.name) === 'new').map(ingKey)))
  }

  const [adding, setAdding] = useState(false)

  const allKeys = ingredients.map(ingKey)
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k))
  const selectedCount = allKeys.filter((k) => selectedKeys.has(k)).length

  const toggleKey = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })

  const handleSelectAll = () =>
    setSelectedKeys(allSelected ? new Set() : new Set(allKeys))

  const handleAddToList = async () => {
    const toAdd = ingredients.filter((ing) => selectedKeys.has(ingKey(ing)))
    if (!toAdd.length) return
    setAdding(true)
    try {
      await Promise.all(
        toAdd.map((ing) => addItem.mutateAsync({
          name: ing.name,
          recipe: {
            title: ing.sources.join(', '),
            amount: describeNeed(ing.name, ing.totalQty, normalizeUnit(ing.unit)),
            quantity: ing.totalQty,
            unit: normalizeUnit(ing.unit),
          },
        }))
      )
      toast.success(`${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} added to list`)
      setSelectedKeys(new Set())
    } catch {
      toast.error('Could not add items')
    } finally {
      setAdding(false)
    }
  }

  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`
  const mealsWithRecipes = entries.filter((e) => e.recipeId).length

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_left</span>
        </button>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekLabel}
          </p>
          {weekOffset !== 0 && (
            <p className="text-[10px] text-on-surface-variant/60 mt-0.5">{weekLabel}</p>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
        </button>
      </div>

      {isLoading ? (
        <CategorySkeleton />
      ) : mealsWithRecipes === 0 ? (
        <EmptyState
          icon="menu_book"
          title="No recipes planned"
          description="Add recipes to your meal plan for this week and their ingredients will appear here."
        />
      ) : (
        <>
          {/* Select all + add button */}
          <div className="flex items-center gap-3">
            <EyeToggle hidden={hideDeselected} onToggle={toggleHideDeselected} label="deselected items" />
            <button
              onClick={handleSelectAll}
              className="text-xs font-bold text-primary flex-shrink-0"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <button
              onClick={handleAddToList}
              disabled={selectedCount === 0 || adding}
              className="flex-1 py-2.5 rounded-full bg-primary text-on-primary text-sm font-headline font-bold disabled:opacity-40 transition-opacity"
            >
              {adding ? 'Adding…' : `Add ${selectedCount} to list`}
            </button>
          </div>

          {/* Ingredient checklist */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card divide-y divide-outline-variant/20">
            {ingredients.filter((ing) => !hideDeselected || selectedKeys.has(ingKey(ing))).map((ing) => {
              const key = ingKey(ing)
              const selected = selectedKeys.has(key)
              const qtyDisplay = ing.totalQty != null
                ? `${fmtQty(ing.totalQty)}${ing.unit ? ` ${ing.unit}` : ''}`
                : ing.unit ?? null

              return (
                <button
                  key={key}
                  onClick={() => toggleKey(key)}
                  className={`w-full flex items-center px-4 py-3 gap-3 text-left transition-colors ${
                    selected ? '' : 'opacity-40'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] flex-shrink-0 ${selected ? 'text-primary' : 'text-outline'}`}
                    style={{ fontVariationSettings: selected ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    {selected ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-on-surface ${selected ? '' : 'line-through'}`}>{ing.name}</p>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">
                      {STATUS_LABEL[statusOf(ing.name)] && (
                        <span className={`font-bold ${statusOf(ing.name) === 'on-list' ? 'text-primary' : ''}`}>
                          {STATUS_LABEL[statusOf(ing.name)]} ·{' '}
                        </span>
                      )}
                      {ing.sources.join(', ')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[52px]">
                    {qtyDisplay && (
                      <p className="text-sm font-semibold text-on-surface">{qtyDisplay}</p>
                    )}
                    {ing.count > 1 && (
                      <p className="text-xs text-on-surface-variant">×{ing.count}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ListDetailPage() {
  const { id: listId } = useParams<{ id: string }>()
  const { data: items, isLoading } = useItemsQuery(listId ?? null)
  const { data: lists = [] } = useListsQuery()
  const { data: stores = [], isSuccess: storesLoaded } = useStoresQuery()
  const { data: pantryHistory = [] } = usePantryHistoryQuery()
  const createStore = useCreateStoreMutation()
  const qc = useQueryClient()
  // One-off tidy: fold any duplicate rows (e.g. several "Carrots") into one
  useEffect(() => {
    if (!listId) return
    api.post<{ removed: number }>(`/lists/${listId}/merge-duplicates`, {})
      .then((r) => { if (r.data.removed > 0) qc.invalidateQueries({ queryKey: queryKeys.lists.items(listId) }) })
      .catch(() => {})
  }, [listId, qc])
  const listName = lists.find((l) => l.id === listId)?.name ?? 'Shopping List'
  const toggleItem = useToggleItemMutation(listId!)
  const addItem = useAddItemMutation(listId!)
  const deleteListItem = useDeleteItemMutation(listId!)

  // Nav 1: which section
  const [primaryTab, setPrimaryTab] = useState<'list' | 'plan' | 'pantry'>('list')
  // Nav 2: which store (only active when primaryTab !== 'pantry')
  const [storeTab, setStoreTab] = useState<string>('all')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showNewStore, setShowNewStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')

  // Derive from live query so AI-assigned category appears in the sheet without reopening
  const editingItem = (items ?? []).find((i) => i.id === editingItemId) ?? null

  // Shopping List = manually added items only; plan and pantry use their own views
  const baseItems = primaryTab === 'list'
    ? (items ?? []).filter((i) => i.recipeSourceId === null)
    : []

  const filteredItems = storeTab === 'all'
    ? baseItems
    : baseItems.filter((i) => i.storeId === storeTab)

  const [hideCompleted, toggleHideCompleted] = useHideDone('mealio-list-hide-completed')
  const visibleItems = hideCompleted ? filteredItems.filter((i) => !i.checked) : filteredItems

  const handleChangePrimary = (tab: 'list' | 'plan' | 'pantry') => {
    setPrimaryTab(tab)
    setStoreTab('all')
  }

  const handleToggle = (item: ShoppingItem) => {
    toggleItem.mutate({ itemId: item.id, checked: !item.checked })
  }

  const handleAddFromPantry = async (name: string, category: string | null) => {
    try {
      await addItem.mutateAsync({ name, category: category ?? undefined })
    } catch {
      toast.error('Could not add item')
    }
  }

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return
    try {
      await createStore.mutateAsync(newStoreName.trim())
      setNewStoreName('')
      setShowNewStore(false)
      toast.success('Shop added')
    } catch {
      toast.error('Could not add shop')
    }
  }

  // Store tabs only make sense for the Shopping List; plan has no per-store data
  const showStoreNav = primaryTab === 'list'

  return (
    <div className="min-h-screen bg-surface pb-40">
      <TopBar
        title={listName}
        showAvatar
        right={
          primaryTab === 'list' && storesLoaded && stores.length === 0 ? (
            <button
              onClick={() => setShowNewStore(true)}
              aria-label="Add shop"
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">storefront</span>
            </button>
          ) : undefined
        }
      />

      {/* Fixed nav container */}
      <div className="fixed top-[calc(4.25rem+env(safe-area-inset-top))] w-full z-40 bg-surface/90 backdrop-blur-sm border-b border-outline-variant/20">

        {/* Section tabs — quiet underline style */}
        <div className="flex px-6" role="tablist">
          {([
            { id: 'list', label: 'List' },
            { id: 'plan', label: 'Meal Plan List' },
            { id: 'pantry', label: 'Pantry' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={primaryTab === tab.id}
              onClick={() => handleChangePrimary(tab.id)}
              className={`flex-1 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                primaryTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Store filter + hide-completed eye (right) */}
        {showStoreNav && (
          <div className="px-6 py-2 flex gap-2 items-center">
            <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto no-scrollbar items-center">
              {stores.length > 0 && [{ id: 'all', name: 'All' }, ...stores].map((store) => (
                <button
                  key={store.id}
                  onClick={() => setStoreTab(store.id)}
                  className={`flex-shrink-0 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
                    storeTab === store.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {store.name}
                </button>
              ))}
            </div>
            <EyeToggle hidden={hideCompleted} onToggle={toggleHideCompleted} label="completed items" />
          </div>
        )}
      </div>

      {/* Main content — margin accounts for 1 or 2 nav rows */}
      <main className={`px-6 space-y-8 ${showStoreNav ? 'mt-[calc(174px+env(safe-area-inset-top))]' : 'mt-[calc(130px+env(safe-area-inset-top))]'}`}>
        {primaryTab === 'pantry' ? (
          <PantryView
            historyItems={pantryHistory}
            currentItems={items ?? []}
            onAdd={handleAddFromPantry}
          />
        ) : primaryTab === 'plan' ? (
          <ShopPlanView listId={listId!} />
        ) : isLoading ? (
          <div className="space-y-8">
            <CategorySkeleton />
            <CategorySkeleton />
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="shopping_basket"
            title="Nothing here yet"
            description="Tap the add bar below to add your first item."
          />
        ) : (
          <>
            {visibleItems.length === 0 ? (
              <p className="text-center text-sm text-on-surface-variant py-10">All done — completed items are hidden.</p>
            ) : (
              <SortableItemList
                items={visibleItems}
                onToggle={handleToggle}
                onEdit={(item) => setEditingItemId(item.id)}
                onDelete={(item) => deleteListItem.mutate(item.id)}
              />
            )}
          </>
        )}
      </main>

      <AddItemBar listId={listId!} onNewItem={(item) => setEditingItemId(item.id)} />

      <ItemDetailSheet
        item={editingItem}
        listId={listId!}
        stores={stores}
        onClose={() => setEditingItemId(null)}
      />

      <BottomSheet open={showNewStore} onClose={() => setShowNewStore(false)} title="Add shop" size="sm">
        <div className="space-y-4 py-2">
          <input
            type="text"
            autoFocus
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateStore()}
            placeholder="e.g. Woolworths"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleCreateStore}
            disabled={!newStoreName.trim() || createStore.isPending}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
          >
            {createStore.isPending ? 'Adding…' : 'Add shop'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
