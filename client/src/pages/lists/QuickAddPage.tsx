import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { toast } from '../../components/shared/Toast'

export function QuickAddPage() {
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [adding, setAdding] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const handleAdd = async () => {
    if (!name.trim() || !id) return
    setAdding(true)
    try {
      await api.post(`/public/lists/${id}/items`, {
        name: name.trim(),
        quantity: quantity ? Number(quantity) : null,
      })
      setAddedCount((n) => n + 1)
      setName('')
      setQuantity('')
      toast.success('Added to list!')
    } catch {
      toast.error('Could not add item — the list may not exist or may be private')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-on-primary text-[32px]">shopping_cart</span>
        </div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Add to list</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          {addedCount > 0 ? `${addedCount} item${addedCount === 1 ? '' : 's'} added` : 'Add items to a shared shopping list'}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Item name"
          className="w-full px-4 py-4 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-base"
        />
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Quantity (optional)"
          min={1}
          className="w-full px-4 py-4 rounded-2xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-base"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || adding}
          className="w-full py-4 rounded-full bg-primary text-on-primary font-headline font-bold text-lg shadow-fab disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add item'}
        </button>
      </div>

      <p className="mt-8 text-xs text-on-surface-variant text-center">
        Powered by{' '}
        <span className="font-bold text-primary">Mealio</span>
      </p>
    </div>
  )
}
