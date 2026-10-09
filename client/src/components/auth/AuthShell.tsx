import type { ReactNode } from 'react'
import { BrandMark } from '../shared/BrandMark'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandMark />
          <h1 className="font-headline text-2xl text-on-surface">{title}</h1>
          {subtitle && <p className="text-on-surface-variant text-sm mt-1">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="text-center text-sm text-on-surface-variant mt-8">{footer}</div>}
        <p className="text-center text-xs text-on-surface-variant/70 mt-8">
          <a href="/privacy" className="underline underline-offset-2">Privacy</a>
        </p>
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return <div aria-live="polite" />
  return (
    <div role="alert" aria-live="polite" className="flex items-start gap-2 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-sm">
      <span className="material-symbols-outlined text-[18px] mt-px">error</span>
      <span>{message}</span>
    </div>
  )
}

export function Divider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-6 text-xs uppercase tracking-widest text-on-surface-variant/70">
      <div className="flex-1 h-px bg-outline-variant" />
      {label}
      <div className="flex-1 h-px bg-outline-variant" />
    </div>
  )
}

export const inputClass =
  'w-full px-4 py-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-base'

export const labelClass = 'block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1.5'

export const primaryButtonClass =
  'w-full py-3.5 rounded-lg bg-primary text-on-primary font-sans font-medium text-sm tracking-wide disabled:opacity-60 transition-opacity hover:bg-primary-container flex items-center justify-center gap-2'
