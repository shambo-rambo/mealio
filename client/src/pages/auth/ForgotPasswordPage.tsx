import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { AuthShell, FormError, inputClass, labelClass, primaryButtonClass } from '../../components/auth/AuthShell'

export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const back = (
    <Link to="/login" className="text-primary font-semibold underline underline-offset-2">
      Back to sign in
    </Link>
  )

  if (sent) {
    return (
      <AuthShell title="Check your email" footer={back}>
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-primary text-[48px]">mark_email_read</span>
          <p className="text-sm text-on-surface-variant">
            If an account exists for <span className="font-medium text-on-surface">{email}</span>, we've sent a link to reset your
            password. It expires in 1 hour.
          </p>
          <p className="text-xs text-on-surface-variant">
            Nothing there? Check spam, or{' '}
            <button type="button" onClick={() => setSent(false)} className="text-primary font-medium underline underline-offset-2">
              try again
            </button>
            .
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link" footer={back}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
        <FormError message={error} />
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  )
}
