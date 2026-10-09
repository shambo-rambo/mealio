import { useEffect, useRef, useState } from 'react'
import { api, getErrorMessage } from '../../lib/api'
import type { User } from '../../types'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface GoogleId {
  initialize: (cfg: Record<string, unknown>) => void
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

// google.accounts.id.initialize should run once per page; the callback reads the latest handlers.
let initialized = false
let endpoint = '/auth/google'
const latest: { onSuccess: (d: AuthResponse) => void; onError: (m: string) => void } = { onSuccess: () => {}, onError: () => {} }

let scriptPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export type AuthResponse = { token: string; user: User; isNew?: boolean }

/** Google's official "Sign in with Google" button; exchanges the ID token with our API. */
export function GoogleButton({
  mode,
  link,
  onSuccess,
  onError,
}: {
  mode: 'signin' | 'signup'
  /** Attach the chosen Google account to the signed-in user instead of signing in. */
  link?: boolean
  onSuccess: (data: AuthResponse) => void
  onError: (message: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  endpoint = link ? '/auth/google/link' : '/auth/google'
  latest.onSuccess = onSuccess
  latest.onError = onError

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        if (!initialized) {
          initialized = true
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            ux_mode: 'popup',
            use_fedcm_for_button: true,
            callback: async ({ credential }: { credential: string }) => {
              try {
                const { data } = await api.post<AuthResponse>(endpoint, { credential })
                latest.onSuccess(data)
              } catch (err) {
                latest.onError(getErrorMessage(err))
              }
            },
          })
        }
        const width = Math.min(ref.current.parentElement?.clientWidth ?? 320, 400)
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          logo_alignment: 'center',
          width,
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [mode])

  if (!GOOGLE_CLIENT_ID) return null
  if (failed) {
    return <p className="text-center text-xs text-on-surface-variant">Google sign-in is unavailable right now. Use email instead.</p>
  }
  return <div ref={ref} className="flex justify-center min-h-[44px]" />
}
