import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { EmptyState } from '../../components/shared/EmptyState'
import { CategorySkeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { BarcodeScanner } from '../../components/shared/BarcodeScanner'
import {
  useItemsQuery, useListsQuery, useAddItemMutation, useToggleItemMutation,
  useUpdateItemMutation, useDeleteItemMutation, useItemSuggestions,
  useStoresQuery, useCreateStoreMutation, usePantryHistoryQuery, useDeletePantryItemMutation,
} from '../../hooks/useLists'
import { useMealPlanQuery, getWeekDates } from '../../hooks/usePlanner'
import { queryKeys } from '../../lib/queryKeys'
import type { ShoppingItem, Store, ItemHistorySuggestion, Recipe } from '../../types'
import { CATEGORIES } from '../../types'
import { api } from '../../lib/api'

// ── Sortable item list ────────────────────────────────────────────────────────

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
}: {
  items: ShoppingItem[]
  onToggle: (item: ShoppingItem) => void
  onEdit: (item: ShoppingItem) => void
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
        <div
          key={item.id}
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
              {item.packageSize && (
                <span className="text-sm text-on-surface-variant/50">{item.packageSize}</span>
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
      ))}
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!item) return
    if (item.id !== openedIdRef.current) {
      // Different item opened — full reset
      openedIdRef.current = item.id
      setForm({ ...item })
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
      await updateItem.mutateAsync({ itemId: item.id, ...form })
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Quantity</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.quantity ?? ''}
              onChange={(e) => setForm({ ...form, quantity: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Package size</label>
            <input
              value={form.packageSize ?? ''}
              onChange={(e) => setForm({ ...form, packageSize: e.target.value || null })}
              placeholder="e.g. 500g"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

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

// ── Swipe-to-delete row ───────────────────────────────────────────────────────

function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
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
    setDx(Math.max(-REVEAL * 1.5, Math.min(0, start.current.base + mx)))
  }
  const onTouchEnd = () => {
    setDragging(false)
    if (dx < -REVEAL * 1.2) onDelete()
    else setDx(dx < -REVEAL / 2 ? -REVEAL : 0)
    start.current = null
  }

  return (
    <div className="relative overflow-hidden">
      <button
        onClick={onDelete}
        aria-label="Delete from pantry"
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
  const activeNames = new Set(currentItems.filter((i) => !i.checked).map((i) => i.name.toLowerCase()))
  const deletePantryItem = useDeletePantryItemMutation()

  if (historyItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] opacity-30">shelves</span>
        <p className="text-sm">Your pantry is empty — add items to build your history.</p>
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
              const onList = activeNames.has(item.name.toLowerCase())
              return (
                <SwipeToDelete key={item.id} onDelete={() => deletePantryItem.mutate(item.id)}>
                <button
                  onClick={() => !onList && onAdd(item.name, item.category)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-surface-container ${onList ? 'cursor-default' : 'hover:bg-surface-container/40'}`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] flex-shrink-0 ${onList ? 'text-primary' : 'text-error'}`}
                    style={{ fontVariationSettings: onList ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    {onList ? 'check_circle' : 'add_circle'}
                  </span>
                  <span className={`font-medium flex-1 ${onList ? 'text-on-surface' : 'text-error'}`}>{item.name}</span>
                  {onList ? (
                    <span className="text-xs text-primary font-medium">On list</span>
                  ) : (
                    <span className="text-xs text-on-surface-variant">Tap if finished</span>
                  )}
                </button>
                </SwipeToDelete>
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

      <div className="fixed bottom-20 left-0 w-full px-4 z-40">
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
  if (!isLoading && loadKey !== lastLoadKey) {
    setLastLoadKey(loadKey)
    setSelectedKeys(new Set(ingredients.map(ingKey)))
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
        toAdd.map((ing) => addItem.mutateAsync({ name: ing.name, quantity: ing.totalQty }))
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
            {ingredients.map((ing) => {
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
                    <p className="font-medium text-on-surface">{ing.name}</p>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">
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
  const { data: stores = [] } = useStoresQuery()
  const { data: pantryHistory = [] } = usePantryHistoryQuery()
  const createStore = useCreateStoreMutation()
  const listName = lists.find((l) => l.id === listId)?.name ?? 'Shopping List'
  const toggleItem = useToggleItemMutation(listId!)
  const addItem = useAddItemMutation(listId!)

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

  const uncheckedItems = filteredItems.filter((i) => !i.checked)
  const checkedItems = filteredItems.filter((i) => i.checked)

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
      <TopBar title={listName} showAvatar />

      {/* Fixed nav container — holds both rows */}
      <div className="fixed top-16 w-full z-40 bg-surface/80 backdrop-blur-sm">

        {/* Nav 1: Shopping List · Shopping Plan · Pantry */}
        <div className="px-6 pt-2 pb-1">
          <div className="flex space-x-1 bg-surface-container-low p-1.5 rounded-full">
            {([
              { id: 'list', label: 'Shopping List' },
              { id: 'plan', label: 'Shop Plan' },
              { id: 'pantry', label: 'Pantry' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleChangePrimary(tab.id)}
                className={`flex-1 py-2 px-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all ${
                  primaryTab === tab.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nav 2: store tabs — only when not on Pantry */}
        {showStoreNav && (
          <div className="px-6 pt-1 pb-2">
            <div className="flex space-x-2 bg-surface-container-low p-1.5 rounded-full overflow-x-auto no-scrollbar items-center">
              <button
                onClick={() => setStoreTab('all')}
                className={`flex-shrink-0 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
                  storeTab === 'all'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                All
              </button>
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => setStoreTab(store.id)}
                  className={`flex-shrink-0 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
                    storeTab === store.id
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {store.name}
                </button>
              ))}
              <button
                onClick={() => setShowNewStore(true)}
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors ml-1"
                title="Add shop"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content — margin accounts for 1 or 2 nav rows */}
      <main className={`px-6 space-y-8 ${showStoreNav ? 'mt-[190px]' : 'mt-[136px]'}`}>
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
            <SortableItemList
              items={uncheckedItems}
              onToggle={handleToggle}
              onEdit={(item) => setEditingItemId(item.id)}
            />

            {checkedItems.length > 0 && (
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-3 px-1">
                  Completed
                </p>
                <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card divide-y divide-outline-variant/15 opacity-50">
                  {checkedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                      <button
                        onClick={() => handleToggle(item)}
                        className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center bg-primary border-2 border-primary active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-on-primary text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 20" }}>
                          check
                        </span>
                      </button>
                      <button onClick={() => setEditingItemId(item.id)} className="flex-1 min-w-0 text-left flex items-baseline gap-1.5">
                        <span className="font-semibold text-on-surface line-through text-on-surface-variant/60">
                          {item.name}
                        </span>
                        {item.packageSize && (
                          <span className="text-sm text-on-surface-variant/40">{item.packageSize}</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
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
