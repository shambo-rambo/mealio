import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'

function Avatar({ size, className = '' }: { size: number; className?: string }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return (
    <div
      className={`rounded-full overflow-hidden bg-secondary-container flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {user.avatar ? (
        <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
      ) : (
        <span className="font-headline font-bold text-primary-container" style={{ fontSize: size * 0.4 }}>
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

/** Avatar button in the top bar that opens the account menu. */
export function AccountMenu() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }
  const signOut = () => {
    setOpen(false)
    clearAuth()
    qc.clear()
    navigate('/login', { replace: true })
  }

  const item = 'w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-on-surface hover:bg-surface-container-low active:bg-surface-container-low transition-colors'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full border-2 border-primary-container block"
      >
        <Avatar size={36} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface-container-lowest shadow-card border border-outline-variant/40 overflow-hidden z-50"
        >
          <div className="flex items-center gap-3 px-4 py-4 border-b border-outline-variant/40">
            <Avatar size={44} />
            <div className="min-w-0">
              <p className="font-headline font-bold text-on-surface truncate">{user.name}</p>
              <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
              <p className="text-[11px] text-primary font-semibold capitalize mt-0.5">{user.role}</p>
            </div>
          </div>

          <button role="menuitem" onClick={() => go('/family')} className={item}>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">group</span>
            Family members &amp; invites
          </button>
          <button role="menuitem" onClick={() => go('/stores')} className={item}>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">store</span>
            Manage stores
          </button>
          <button role="menuitem" onClick={() => go('/settings')} className={item}>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">settings</span>
            Account settings
          </button>
          <button role="menuitem" onClick={signOut} className={`${item} border-t border-outline-variant/40 !text-error`}>
            <span className="material-symbols-outlined text-[20px] text-error">logout</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
