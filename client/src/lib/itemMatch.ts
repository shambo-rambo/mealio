import type { ShoppingItem, ItemHistorySuggestion } from '../types'

/** Same product? Ignores case, spacing and simple plurals ("Carrots" = "carrot"). Mirrors the server. */
export function normalizeItemName(name: string): string {
  const n = name.toLowerCase().trim().replace(/\s+/g, ' ')
  if (n.length <= 3 || /(ss|us)$/.test(n)) return n
  if (/ies$/.test(n)) return n.replace(/ies$/, 'y')
  if (/(oes|ches|shes|xes|sses)$/.test(n)) return n.replace(/es$/, '')
  return n.replace(/s$/, '')
}

export type IngredientStatus = 'on-list' | 'in-pantry' | 'new'

/**
 * Where does an ingredient stand?
 *  - on-list:   already an open item on the list (don't add again)
 *  - in-pantry: bought before and not currently needed, so assume it's in stock
 *  - new:       never seen before
 */
export function ingredientStatuses(
  items: ShoppingItem[],
  pantry: ItemHistorySuggestion[],
): (name: string) => IngredientStatus {
  const open = new Set(items.filter((i) => !i.checked).map((i) => normalizeItemName(i.name)))
  const known = new Set([
    ...items.filter((i) => i.checked).map((i) => normalizeItemName(i.name)),
    ...pantry.map((p) => normalizeItemName(p.name)),
  ])
  return (name) => {
    const k = normalizeItemName(name)
    if (open.has(k)) return 'on-list'
    if (known.has(k)) return 'in-pantry'
    return 'new'
  }
}

export const STATUS_LABEL: Record<IngredientStatus, string | null> = {
  'on-list': 'Already on list',
  'in-pantry': 'In pantry',
  new: null,
}
