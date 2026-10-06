import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { useAuthSuccess } from '../../lib/useAuthSuccess'
import { AuthShell, Divider, FormError, inputClass, labelClass, primaryButtonClass } from '../../components/auth/AuthShell'
import { PasswordField } from '../../components/auth/PasswordField'
import { GoogleButton, GOOGLE_CLIENT_ID } from '../../components/auth/GoogleButton'
import type { User } from '../../types'

export function RegisterPage() {
  const { onAuthenticated, nextQuery } = useAuthSuccess()
  const [params] = useSearchParams()
  const authed = useAuthStore((s) => !!s.token)
  const [form, setForm] = useState({ name: '', email: params.get('email') ?? '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (authed && !loading) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/register', form)
      onAuthenticated(data.token, data.user)
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start planning meals with your family"
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${nextQuery}`} className="text-primary font-semibold underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton mode="signup" onSuccess={(d) => onAuthenticated(d.token, d.user)} onError={setError} />
      {GOOGLE_CLIENT_ID && <Divider label="or sign up with email" />}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>Your name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jane Smith"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          showStrength
        />

        <FormError message={error} />

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-xs text-on-surface-variant text-center">
          By continuing you agree to our{' '}
          <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  )
}
