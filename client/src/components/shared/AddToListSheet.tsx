import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { toast } from './Toast'
import { useRecipeQuery } from '../../hooks/useRecipes'
import { useListsQuery, useAddItemMutation } from '../../hooks/useLists'
import type { Ingredient } from '../../types'

const fmtQty = (q: number) => String(Math.round(q * 10) / 10)

/** Pick a recipe's ingredients (scaled to a serving count) and add them to a shopping list. */
export function AddToListSheet({
  recipeId,
  open,
  onClose,
  defaultServings,
}: {
  recipeId: string | null
  open: boolean
  onClose: () => void
  defaultServings?: number
}) {
  const { data: recipe } = useRecipeQuery(open ? recipeId : null)
  const { data: lists = [] } = useListsQuery()
  const [selectedListId, setSelectedListId] = useState('')
  const [servings, setServings] = useState(defaultServings ?? 1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)

  const ingredients: Ingredient[] = recipe?.ingredients ?? []
  const baseServings = recipe?.servings ?? 1

  // Fresh state each time the sheet opens
  useEffect(() => {
    if (open) {
      setServings(defaultServings ?? 1)
      setSelectedListId('')
      setSelected(new Set())
    }
  }, [open, recipeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select everything once the ingredients load
  useEffect(() => {
    if (open && ingredients.length > 0) setSelected(new Set(ingredients.map((_, i) => i)))
  }, [open, recipe?.id, ingredients.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveListId = selectedListId || (lists.length === 1 ? lists[0].id : '')
  const addItem = useAddItemMutation(effectiveListId)

  const factor = servings / baseServings
  const scaled = (ing: Ingredient) => (ing.quantity != null ? Math.round(ing.quantity * factor * 10) / 10 : null)
  const allSelected = ingredients.length > 0 && selected.size === ingredients.length

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })

  const handleAdd = async () => {
    if (!effectiveListId || selected.size === 0) return
    setAdding(true)
    try {
      await Promise.all(
        [...selected].map((i) => addItem.mutateAsync({ name: ingredients[i].name, quantity: scaled(ingredients[i]) })),
      )
      toast.success(`${selected.size} ingredient${selected.size === 1 ? '' : 's'} added`)
      onClose()
    } catch {
      toast.error('Could not add ingredients')
    } finally {
      setAdding(false)
    }
  }

  if (!open) return null

  return (
    <BottomSheet open={open} onClose={onClose} title="Add to shopping list" size="lg">
      <div className="space-y-4 pb-4">
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Shopping list</p>
          {lists.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No lists yet — create one first.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedListId(l.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                    effectiveListId === l.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex-1">Servings</p>
          <button onClick={() => setServings(Math.max(1, servings - 1))}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center" aria-label="Fewer servings">
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="font-headline font-bold text-on-surface w-6 text-center">{servings}</span>
          <button onClick={() => setServings(servings + 1)}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center" aria-label="More servings">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Ingredients ({selected.size}/{ingredients.length})
            </p>
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(ingredients.map((_, i) => i)))}
              className="text-xs text-primary font-bold"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto no-scrollbar">
            {ingredients.map((ing, i) => {
              const qty = scaled(ing)
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                    selected.has(i) ? 'bg-primary/10' : 'bg-surface-container-low opacity-50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${selected.has(i) ? 'text-primary' : 'text-outline'}`}>
                    {selected.has(i) ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  <span className="text-sm font-medium text-primary min-w-[4rem]">
                    {qty != null ? `${fmtQty(qty)} ${ing.unit ?? ''}`.trim() : ing.unit ?? ''}
                  </span>
                  <span className="text-sm text-on-surface flex-1">{ing.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={adding || selected.size === 0 || !effectiveListId}
          className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
        >
          {adding ? 'Adding…' : `Add ${selected.size} ingredient${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>
    </BottomSheet>
  )
}
