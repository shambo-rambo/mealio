import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import type { User } from '../../types'

type Step = 'choose' | 'create' | 'join'

export function FamilySetupPage() {
  const navigate = useNavigate()
  const { user, setAuth } = useAuthStore()
  const [step, setStep] = useState<Step>('choose')
  const [familyName, setFamilyName] = useState(user ? `${user.name.split(' ')[0]}'s Family` : '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createFamily = async () => {
    if (!familyName.trim()) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/family', { name: familyName })
      setAuth(data.token, data.user)
      navigate('/shopping', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const joinFamily = async () => {
    if (code.length !== 6) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; user: User }>('/family/join', { code })
      setAuth(data.token, data.user)
      navigate('/shopping', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'create') {
    return (
      <div className="min-h-screen bg-surface flex flex-col px-6 py-12">
        <button onClick={() => setStep('choose')} className="material-symbols-outlined text-primary mb-8 self-start">
          arrow_back
        </button>
        <h1 className="font-headline font-bold text-2xl text-on-surface mb-2">Create your family</h1>
        <p className="text-on-surface-variant text-sm mb-8">Give your family group a name. You can change this later.</p>

        <input
          type="text"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          placeholder="e.g. The Smiths"
          className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          autoFocus
        />

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm mt-4">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <button
          onClick={createFamily}
          disabled={loading || !familyName.trim()}
          className="w-full py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold text-base shadow-fab disabled:opacity-60 mt-6"
        >
          {loading ? 'Creating…' : 'Create family'}
        </button>
      </div>
    )
  }

  if (step === 'join') {
    return (
      <div className="min-h-screen bg-surface flex flex-col px-6 py-12">
        <button onClick={() => setStep('choose')} className="material-symbols-outlined text-primary mb-8 self-start">
          arrow_back
        </button>
        <h1 className="font-headline font-bold text-2xl text-on-surface mb-2">Join a family</h1>
        <p className="text-on-surface-variant text-sm mb-8">Enter the 6-digit code from a family member.</p>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface text-center text-2xl font-headline font-bold tracking-[0.5em] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          autoFocus
        />

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm mt-4">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <button
          onClick={joinFamily}
          disabled={loading || code.length !== 6}
          className="w-full py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold text-base shadow-fab disabled:opacity-60 mt-6"
        >
          {loading ? 'Joining…' : 'Join family'}
        </button>
      </div>
    )
  }

  // Choose step
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex w-16 h-16 rounded-3xl bg-primary items-center justify-center mb-4 shadow-fab">
          <span className="material-symbols-outlined text-on-primary text-[32px]"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 32" }}>
            group
          </span>
        </div>
        <h1 className="font-headline font-bold text-2xl text-on-surface">Set up your family</h1>
        <p className="text-on-surface-variant text-sm mt-2">
          Create a new family group or join one that already exists.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setStep('create')}
          className="w-full p-5 rounded-2xl bg-surface-container-lowest border-2 border-primary/20 text-left hover:border-primary/50 transition-colors shadow-card"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary">add_circle</span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface">Create a family</p>
              <p className="text-sm text-on-surface-variant mt-0.5">Start fresh and invite your family</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant ml-auto">chevron_right</span>
          </div>
        </button>

        <button
          onClick={() => setStep('join')}
          className="w-full p-5 rounded-2xl bg-surface-container-lowest border-2 border-outline-variant text-left hover:border-primary/30 transition-colors shadow-card"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container/50 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-secondary">group_add</span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface">Join a family</p>
              <p className="text-sm text-on-surface-variant mt-0.5">Enter a 6-digit invite code</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant ml-auto">chevron_right</span>
          </div>
        </button>
      </div>
    </div>
  )
}
