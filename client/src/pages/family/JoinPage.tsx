import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import type { User } from '../../types'

export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { token: authToken, setAuth } = useAuthStore()
  const code = searchParams.get('code') ?? ''

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    if (!authToken) {
      // Not logged in — send to login, then come back
      navigate(`/login?next=${encodeURIComponent(`/join?code=${code}`)}`, { replace: true })
      return
    }
    // Logged in — auto-join
    setLoading(true)
    api.post<{ token: string; user: User }>('/family/join', { code })
      .then(({ data }) => {
        setAuth(data.token, data.user)
        navigate('/planner', { replace: true })
      })
      .catch((err) => {
        setError(getErrorMessage(err))
        setLoading(false)
      })
  }, [code, authToken])

  if (!code) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
        <p className="text-on-surface-variant">No invite code found in the link.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-primary font-bold">Go home</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      {loading && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-on-surface-variant">Joining family…</p>
        </div>
      )}
      {error && (
        <div className="space-y-4 text-center">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
          <button onClick={() => navigate('/family-setup')} className="text-primary font-bold text-sm">
            Set up family manually
          </button>
        </div>
      )}
    </div>
  )
}
