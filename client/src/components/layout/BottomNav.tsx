import { NavLink, useLocation } from 'react-router-dom'
import { useNavFeatures } from '../../store/prefsStore'

export function BottomNav() {
  const location = useLocation()
  const tabs = useNavFeatures()

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-white/75 backdrop-blur-2xl backdrop-saturate-[1.8] shadow-nav-top [box-shadow:0_-1px_0_rgba(24,29,24,0.06),0_-12px_32px_-16px_rgba(26,26,26,0.12)]">
      <div className="flex justify-around items-center h-20 px-2 pb-safe">
        {tabs.map(({ to, icon, label }) => {
          const active = location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 group">
              <span
                className={`flex items-center justify-center h-8 w-14 rounded-full transition-all duration-200 ${
                  active ? 'bg-secondary-container text-primary' : 'text-on-surface-variant group-active:bg-surface-container'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={{ fontVariationSettings: `'FILL' ${active ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
                >
                  {icon}
                </span>
              </span>
              <span
                className={`text-[11px] tracking-[0.01em] transition-colors ${
                  active ? 'text-primary font-bold' : 'text-on-surface-variant font-medium'
                }`}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
