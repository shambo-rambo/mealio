import { usePrefsStore } from '../../store/prefsStore'
import { ALLERGEN_LABELS, type Allergen } from '../../types'

/** Allergens in this recipe that the household has chosen to avoid. */
export function useAllergenHits(allergens: Allergen[] | undefined): Allergen[] {
  const avoid = usePrefsStore((s) => s.avoidAllergens)
  return (allergens ?? []).filter((a) => avoid.includes(a))
}

export function AllergenWarning({ allergens, compact = false }: { allergens: Allergen[] | undefined; compact?: boolean }) {
  const hits = useAllergenHits(allergens)
  if (hits.length === 0) return null
  const label = hits.map((a) => ALLERGEN_LABELS[a]).join(', ')

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-bold">
        <span className="material-symbols-outlined text-[13px]">warning</span>
        {label}
      </span>
    )
  }
  return (
    <div className="flex items-start gap-2 mt-3 px-4 py-3 rounded-2xl bg-error-container text-on-error-container">
      <span className="material-symbols-outlined text-[20px] flex-shrink-0">warning</span>
      <p className="text-sm font-medium">Contains {label.toLowerCase()} — something your household avoids.</p>
    </div>
  )
}
