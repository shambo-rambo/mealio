import type { MealLabel } from '../types'

const key = (label: MealLabel) => `mealio-share-${label}`

/**
 * Whether a new meal in this slot is shared with the family by default.
 * Dinner is the family meal; everything else starts private. Remembers the last choice per slot.
 */
export function defaultShared(label: MealLabel): boolean {
  try {
    const v = localStorage.getItem(key(label))
    if (v === '1') return true
    if (v === '0') return false
  } catch { /* storage unavailable */ }
  return label === 'dinner'
}

export function rememberShared(label: MealLabel, shared: boolean) {
  try { localStorage.setItem(key(label), shared ? '1' : '0') } catch { /* ignore */ }
}
