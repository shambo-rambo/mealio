import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Allergen } from '../types'
import { DEFAULT_NAV_ORDER, FEATURE_BY_ID, type FeatureId } from '../lib/features'

interface PrefsState {
  /** Features shown in the nav bar, in display order. Never empty. */
  navOrder: FeatureId[]
  /** Features switched off (hidden from the nav and inaccessible). */
  navHidden: FeatureId[]
  setFeatureEnabled: (id: FeatureId, enabled: boolean) => void
  moveFeature: (id: FeatureId, dir: -1 | 1) => void
  resetNav: () => void
  dailyDozenEnabled: boolean
  setDailyDozenEnabled: (v: boolean) => void
  /** Allergens this household avoids; recipes containing them get a warning. */
  avoidAllergens: Allergen[]
  toggleAvoidAllergen: (a: Allergen) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      navOrder: DEFAULT_NAV_ORDER,
      navHidden: [],
      setFeatureEnabled: (id, enabled) =>
        set((s) => {
          const hidden = enabled ? s.navHidden.filter((x) => x !== id) : [...s.navHidden, id]
          // Always keep at least one feature on.
          if (hidden.length >= DEFAULT_NAV_ORDER.length) return s
          return { navHidden: hidden }
        }),
      moveFeature: (id, dir) =>
        set((s) => {
          const i = s.navOrder.indexOf(id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= s.navOrder.length) return s
          const next = [...s.navOrder]
          ;[next[i], next[j]] = [next[j], next[i]]
          return { navOrder: next }
        }),
      resetNav: () => set({ navOrder: DEFAULT_NAV_ORDER, navHidden: [] }),
      dailyDozenEnabled: true,
      setDailyDozenEnabled: (v) => set({ dailyDozenEnabled: v }),
      avoidAllergens: [],
      toggleAvoidAllergen: (a) =>
        set((s) => ({
          avoidAllergens: s.avoidAllergens.includes(a)
            ? s.avoidAllergens.filter((x) => x !== a)
            : [...s.avoidAllergens, a],
        })),
    }),
    {
      name: 'mealio-prefs',
      // Keep stored nav order valid if features are added or removed in a later version.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PrefsState>
        const order = (p.navOrder ?? []).filter((id) => id in FEATURE_BY_ID)
        const missing = DEFAULT_NAV_ORDER.filter((id) => !order.includes(id))
        return { ...current, ...p, navOrder: [...order, ...missing] }
      },
    },
  ),
)

/** Enabled features in the user's chosen order. */
export function useNavFeatures() {
  const navOrder = usePrefsStore((s) => s.navOrder)
  const navHidden = usePrefsStore((s) => s.navHidden)
  return navOrder.filter((id) => !navHidden.includes(id)).map((id) => FEATURE_BY_ID[id])
}
