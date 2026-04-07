import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import type { User } from '../../types'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/login', form)
      setAuth(data.token, data.user)
      const next = searchParams.get('next')
      navigate(next ?? (data.user.familyId ? '/shopping' : '/setup'), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-6 py-12">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="inline-flex w-16 h-16 rounded-3xl bg-primary items-center justify-center mb-4 shadow-fab">
          <span className="material-symbols-outlined text-on-primary text-[32px]"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 32" }}>
            restaurant_menu
          </span>
        </div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Welcome back</h1>
        <p className="text-on-surface-variant text-sm mt-1">Sign in to your Mealio account</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1.5">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold text-base shadow-fab disabled:opacity-60 transition-opacity mt-2"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-on-surface-variant mt-8">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary font-semibold">
          Create one
        </Link>
      </p>
    </div>
  )
}
