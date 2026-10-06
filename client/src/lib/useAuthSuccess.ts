import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types'

/** Only follow same-app relative redirects (blocks `?next=https://evil.com` and `//evil.com`). */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

export function useAuthSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const next = safeNext(params.get('next'))
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ''

  const onAuthenticated = (token: string, user: User) => {
    setAuth(token, user)
    navigate(user.familyId ? (next ?? '/shopping') : next?.startsWith('/join') ? next : '/setup', { replace: true })
  }
  return { onAuthenticated, nextQuery }
}
