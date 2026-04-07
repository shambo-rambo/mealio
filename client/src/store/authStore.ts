import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => {
        localStorage.setItem('mealio_token', token)
        localStorage.setItem('mealio_user', JSON.stringify(user))
        set({ token, user })
      },

      clearAuth: () => {
        localStorage.removeItem('mealio_token')
        localStorage.removeItem('mealio_user')
        set({ token: null, user: null })
      },

      updateUser: (updates) => {
        const current = get().user
        if (!current) return
        const updated = { ...current, ...updates }
        localStorage.setItem('mealio_user', JSON.stringify(updated))
        set({ user: updated })
      },
    }),
    {
      name: 'mealio_auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)

export function getToken(): string | null {
  return localStorage.getItem('mealio_token')
}
