import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import type { User } from '../../types'

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/register', form)
      setAuth(data.token, data.user)
      navigate('/setup', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-10">
        <img
          src="/logo.png"
          alt="Cook"
          className="w-20 h-20 object-contain mx-auto mb-5"
        />
        <h1 className="font-headline text-2xl text-on-surface">Create your account</h1>
        <p className="text-on-surface-variant text-sm mt-1">Start planning meals with your family</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1.5">Your name</label>
          <input
            type="text"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jane Smith"
            className="w-full px-4 py-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1.5">Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1.5">Password</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
            className="w-full px-4 py-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded bg-primary text-on-primary font-sans font-medium text-sm tracking-wide disabled:opacity-60 transition-opacity mt-2 hover:bg-primary-container"
        >
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
      </form>

      <p className="text-center text-sm text-on-surface-variant mt-8">
        Already have an account?{' '}
        <Link to="/login" className="text-on-surface font-medium underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  )
}
