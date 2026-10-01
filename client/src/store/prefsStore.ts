import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrefsState {
  dailyDozenEnabled: boolean
  setDailyDozenEnabled: (v: boolean) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      dailyDozenEnabled: true,
      setDailyDozenEnabled: (v) => set({ dailyDozenEnabled: v }),
    }),
    { name: 'mealio-prefs' },
  ),
)
