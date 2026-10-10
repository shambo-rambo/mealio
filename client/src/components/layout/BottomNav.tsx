import { NavLink, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/streaks', icon: 'local_fire_department', label: 'Streaks' },
  { to: '/planner', icon: 'calendar_today', label: 'Meal Plan' },
  { to: '/recipes', icon: 'restaurant_menu', label: 'Recipes' },
  { to: '/shopping', icon: 'shopping_basket', label: 'Shopping' },
  { to: '/family', icon: 'group', label: 'Family' },
] as const

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-white/90 backdrop-blur-xl border-t border-outline-variant/40 shadow-nav-top">
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
                className={`text-[11px] tracking-wide transition-colors ${
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
