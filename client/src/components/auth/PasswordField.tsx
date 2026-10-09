import { useState } from 'react'
import { inputClass, labelClass } from './AuthShell'

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  else if (/\d|[^A-Za-z0-9]/.test(pw) && pw.length >= 10) score++
  const s = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
  return { score: pw.length < 8 ? 1 : s, label: pw.length < 8 ? 'Too short' : ['', 'Weak', 'Fair', 'Good', 'Strong'][s] || 'Weak' }
}

export function PasswordField({
  label = 'Password',
  value,
  onChange,
  autoComplete,
  placeholder,
  showStrength,
  autoFocus,
  labelAside,
  id = 'password',
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  placeholder?: string
  showStrength?: boolean
  autoFocus?: boolean
  labelAside?: React.ReactNode
  id?: string
}) {
  const [show, setShow] = useState(false)
  const { score, label: strengthLabel } = passwordStrength(value)
  const colors = ['bg-outline-variant', 'bg-error', 'bg-tertiary', 'bg-primary-container', 'bg-primary']

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className={labelClass}>{label}</label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          minLength={autoComplete === 'new-password' ? 8 : undefined}
          maxLength={72}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-[20px]">{show ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? colors[score] : 'bg-outline-variant'}`} />
            ))}
          </div>
          <p className="text-xs text-on-surface-variant mt-1">{strengthLabel}</p>
        </div>
      )}
    </div>
  )
}
