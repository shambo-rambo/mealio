import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { useAuthSuccess } from '../../lib/useAuthSuccess'
import { AuthShell, Divider, FormError, inputClass, labelClass, primaryButtonClass } from '../../components/auth/AuthShell'
import { PasswordField } from '../../components/auth/PasswordField'
import { GoogleButton, GOOGLE_CLIENT_ID } from '../../components/auth/GoogleButton'
import type { User } from '../../types'

export function LoginPage() {
  const { onAuthenticated, nextQuery } = useAuthSuccess()
  const authed = useAuthStore((s) => !!s.token)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authed && !loading) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/login', form)
      onAuthenticated(data.token, data.user)
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Food Prep account"
      footer={
        <>
          New to Food Prep?{' '}
          <Link to={`/register${nextQuery}`} className="text-primary font-semibold underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton mode="signin" onSuccess={(d) => onAuthenticated(d.token, d.user)} onError={setError} />
      {GOOGLE_CLIENT_ID && <Divider label="or sign in with email" />}

      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>

        <PasswordField
          value={form.password}
          onChange={(password) => setForm({ ...form, password })}
          autoComplete="current-password"
          placeholder="Your password"
          labelAside={
            <Link
              to={`/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ''}`}
              className="text-xs text-primary font-medium"
            >
              Forgot password?
            </Link>
          }
        />

        <FormError message={error} />

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
