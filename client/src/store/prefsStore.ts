import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Allergen } from '../types'

interface PrefsState {
  dailyDozenEnabled: boolean
  setDailyDozenEnabled: (v: boolean) => void
  /** Allergens this household avoids; recipes containing them get a warning. */
  avoidAllergens: Allergen[]
  toggleAvoidAllergen: (a: Allergen) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
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
    { name: 'mealio-prefs' },
  ),
)
