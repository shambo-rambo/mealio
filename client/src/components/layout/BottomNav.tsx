import { NavLink, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/planner', icon: 'calendar_today', label: 'Meal Plan' },
  { to: '/recipes', icon: 'restaurant_menu', label: 'Recipes' },
  { to: '/shopping', icon: 'shopping_basket', label: 'Shopping' },
  { to: '/family', icon: 'group', label: 'Family' },
] as const

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-[32px] shadow-nav-bottom overflow-hidden">
      <div className="glass-dark flex justify-around items-center h-20 px-4 pb-safe">
        {tabs.map(({ to, icon, label }) => {
          const active = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center justify-center gap-0.5 w-16 hover:scale-105 transition-transform"
            >
              <span
                className={`material-symbols-outlined text-[26px] ${active ? 'material-symbols-filled' : ''}`}
                style={{
                  fontVariationSettings: active
                    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                  color: active ? '#096430' : '#404940',
                  opacity: active ? 1 : 0.6,
                }}
              >
                {icon}
              </span>
              <span
                className="font-headline font-bold text-[10px] uppercase tracking-wider"
                style={{ color: active ? '#096430' : '#404940', opacity: active ? 1 : 0.6 }}
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
