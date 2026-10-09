import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthSuccess } from '../../lib/useAuthSuccess'
import { AuthShell, FormError, primaryButtonClass } from '../../components/auth/AuthShell'
import { PasswordField } from '../../components/auth/PasswordField'
import type { User } from '../../types'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { onAuthenticated } = useAuthSuccess()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/reset-password', { token, password })
      onAuthenticated(data.token, data.user) // password reset signs you straight in
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell title="Link not valid" footer={<Link to="/login" className="text-primary font-semibold underline underline-offset-2">Back to sign in</Link>}>
        <p className="text-center text-sm text-on-surface-variant">
          This reset link is incomplete.{' '}
          <Link to="/forgot-password" className="text-primary font-medium underline underline-offset-2">Request a new one</Link>.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed in right after">
      <form onSubmit={submit} className="space-y-4">
        <input type="text" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden readOnly />
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          showStrength
          autoFocus
        />
        <FormError message={error} />
        {error.includes('expired') && (
          <Link to="/forgot-password" className="block text-center text-sm text-primary font-medium underline underline-offset-2">
            Request a new link
          </Link>
        )}
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  )
}
