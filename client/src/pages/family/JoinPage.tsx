import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { AuthShell, FormError, primaryButtonClass } from '../../components/auth/AuthShell'
import type { Family, User } from '../../types'

interface Preview {
  familyName: string
  inviterName: string | null
  email: string
}

export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { token: authToken, setAuth } = useAuthStore()
  const invite = searchParams.get('invite') ?? ''
  const code = searchParams.get('code') ?? ''

  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const attempted = useRef(false)

  const here = invite ? `/join?invite=${invite}` : `/join?code=${code}`
  const next = encodeURIComponent(here)

  // Who invited you - shown on the landing card before you've signed in.
  useEffect(() => {
    if (!invite) return
    api
      .get<Preview>(`/public/invites/${invite}`)
      .then((r) => setPreview(r.data))
      .catch((err) => setError(getErrorMessage(err)))
  }, [invite])

  // Signed in: accept automatically. (Guarded so setAuth's token change doesn't re-submit a single-use invite.)
  useEffect(() => {
    if (!authToken || attempted.current || (!invite && !code)) return
    attempted.current = true
    setLoading(true)
    api
      .post<{ token: string; user: User; family: Family }>('/family/join', invite ? { invite } : { code })
      .then(({ data }) => {
        setAuth(data.token, data.user)
        navigate('/planner', { replace: true })
      })
      .catch((err) => {
        setError(getErrorMessage(err))
        setLoading(false)
      })
  }, [authToken, invite, code, navigate, setAuth])

  if (!invite && !code) {
    return (
      <AuthShell title="No invitation found" footer={<Link to="/" className="text-primary font-semibold">Go home</Link>}>
        <p className="text-center text-sm text-on-surface-variant">This link is missing its invite. Ask for a new one.</p>
      </AuthShell>
    )
  }

  if (authToken) {
    return (
      <AuthShell title={error ? "Couldn't join" : 'Joining family…'}>
        {loading && <div className="mx-auto w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />}
        {error && (
          <div className="space-y-4 text-center">
            <FormError message={error} />
            <Link to="/" className="text-primary font-semibold text-sm">Go to my account</Link>
          </div>
        )}
      </AuthShell>
    )
  }

  // Not signed in yet.
  const emailParam = preview ? `&email=${encodeURIComponent(preview.email)}` : ''
  return (
    <AuthShell
      title={preview ? `Join ${preview.familyName}` : 'Family invitation'}
      subtitle={preview ? `${preview.inviterName ?? 'Someone'} invited you to plan meals together` : undefined}
    >
      {error ? (
        <FormError message={error} />
      ) : (
        <div className="space-y-3">
          <Link to={`/register?next=${next}${emailParam}`} className={primaryButtonClass}>
            Create an account
          </Link>
          <Link
            to={`/login?next=${next}${emailParam}`}
            className="w-full py-3.5 rounded-lg border border-outline-variant text-on-surface font-medium text-sm flex items-center justify-center"
          >
            I already have an account
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
