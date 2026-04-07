import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { EmptyState } from '../../components/shared/EmptyState'
import { CategorySkeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { BarcodeScanner } from '../../components/shared/BarcodeScanner'
import {
  useItemsQuery, useListsQuery, useAddItemMutation, useToggleItemMutation,
  useUpdateItemMutation, useDeleteItemMutation, useItemSuggestions,
  useStoresQuery,
} from '../../hooks/useLists'
import type { ShoppingItem, Store } from '../../types'
import { CATEGORIES } from '../../types'
import { api } from '../../lib/api'

// ── Category grouping ────────────────────────────────────────────────────────

function groupByCategory(items: ShoppingItem[]) {
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  const groups: Record<string, ShoppingItem[]> = {}
  for (const item of unchecked) {
    const cat = item.category ?? 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }

  return { groups, checked }
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [swiped, setSwiped] = useState(false)
  const startX = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = startX.current - e.changedTouches[0].clientX
    if (diff > 60) setSwiped(true)
    else if (diff < -30) setSwiped(false)
  }

  return (
    <div className="relative overflow-hidden">
      {/* Swipe actions */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button onClick={onEdit} className="px-4 bg-secondary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary text-[20px]">edit</span>
        </button>
        <button onClick={onDelete} className="px-4 bg-error-container flex items-center justify-center rounded-r-xl">
          <span className="material-symbols-outlined text-error text-[20px]">delete</span>
        </button>
      </div>

      {/* Item */}
      <div
        className="relative bg-surface-container-lowest flex items-center p-4 gap-4 transition-transform duration-200 cursor-pointer group"
        style={{ transform: swiped ? 'translateX(-112px)' : 'translateX(0)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!swiped) onToggle(); else setSwiped(false) }}
      >
        {/* Checkbox */}
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all border-2 ${
            item.checked
              ? 'bg-primary border-primary'
              : 'border-outline-variant group-active:scale-95'
          }`}
        >
          {item.checked && (
            <span className="material-symbols-outlined text-on-primary text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 20" }}>
              check
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span className={`font-medium text-on-surface ${item.checked ? 'line-through text-on-surface-variant' : ''}`}>
            {item.name}
          </span>
          {item.packageSize && (
            <p className="text-xs text-on-surface-variant mt-0.5">{item.packageSize}</p>
          )}
        </div>

        {/* Quantity badge */}
        {item.quantity != null && (
          <span className="text-sm font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full flex-shrink-0">
            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
          </span>
        )}
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
  const [form, setForm] = useState<Partial<ShoppingItem>>({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) setForm({ ...item })
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

        <button
          onClick={save}
          disabled={updateItem.isPending}
          className="w-full py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
        >
          {updateItem.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Add item bar ─────────────────────────────────────────────────────────────

function AddItemBar({ listId }: { listId: string }) {
  const [value, setValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const addItem = useAddItemMutation(listId)
  const { data: suggestions } = useItemSuggestions(value)

  const submit = async (name: string) => {
    if (!name.trim()) return
    try {
      await addItem.mutateAsync({ name: name.trim() })
      setValue('')
      setShowSuggestions(false)
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
                onClick={() => submit(s.name)}
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
            onChange={(e) => { setValue(e.target.value); setShowSuggestions(true) }}
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

// ── Main page ────────────────────────────────────────────────────────────────

export function ListDetailPage() {
  const { id: listId } = useParams<{ id: string }>()
  const { data: items, isLoading } = useItemsQuery(listId ?? null)
  const { data: lists = [] } = useListsQuery()
  const { data: stores = [] } = useStoresQuery()
  const listName = lists.find((l) => l.id === listId)?.name ?? 'Shopping List'
  const toggleItem = useToggleItemMutation(listId!)
  const deleteItem = useDeleteItemMutation(listId!)

  const [activeTab, setActiveTab] = useState<string>('all') // 'all' or storeId
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)

  const filteredItems = activeTab === 'all'
    ? (items ?? [])
    : (items ?? []).filter((i) => i.storeId === activeTab)

  const { groups, checked } = groupByCategory(filteredItems)
  const categoryKeys = Object.keys(groups).sort()

  const storesWithItems = stores.filter((s) =>
    (items ?? []).some((i) => i.storeId === s.id),
  )

  const handleToggle = (item: ShoppingItem) => {
    toggleItem.mutate({ itemId: item.id, checked: !item.checked })
  }

  const handleDelete = (itemId: string) => {
    deleteItem.mutate(itemId)
    toast.success('Item removed')
  }

  return (
    <div className="min-h-screen bg-surface pb-40">
      <TopBar title={listName} showBack showAvatar />

      {/* Store tabs */}
      {storesWithItems.length > 0 && (
        <nav className="fixed top-16 w-full z-40 px-6 pt-2 pb-2 bg-surface/80 backdrop-blur-sm">
          <div className="flex space-x-2 bg-surface-container-low p-1.5 rounded-full overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              All items
            </button>
            {storesWithItems.map((store) => (
              <button
                key={store.id}
                onClick={() => setActiveTab(store.id)}
                className={`flex-shrink-0 py-2 px-4 rounded-full text-sm font-bold transition-all ${
                  activeTab === store.id
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {store.name}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className={`px-6 space-y-8 ${storesWithItems.length > 0 ? 'mt-[108px]' : 'mt-20 pt-4'}`}>
        {isLoading ? (
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
            {/* Unchecked — grouped by category */}
            {categoryKeys.map((cat) => (
              <section key={cat} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest">
                    {cat}
                  </h2>
                  <span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">
                    {groups[cat].length} {groups[cat].length === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card divide-y divide-outline-variant/20">
                  {groups[cat].map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => handleToggle(item)}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Checked items */}
            {checked.length > 0 && (
              <section className="space-y-3 opacity-60">
                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
                  <h2 className="text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest">
                    Checked
                  </h2>
                  <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                    {checked.length} {checked.length === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-card divide-y divide-outline-variant/20">
                  {checked.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => handleToggle(item)}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <AddItemBar listId={listId!} />

      <ItemDetailSheet
        item={editingItem}
        listId={listId!}
        stores={stores}
        onClose={() => setEditingItem(null)}
      />
    </div>
  )
}
