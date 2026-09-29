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
    <nav className="fixed bottom-0 left-0 w-full z-50 shadow-nav-bottom overflow-hidden">
      <div className="glass-dark flex justify-around items-center h-20 px-4 pb-safe">
        {tabs.map(({ to, icon, label }) => {
          const active = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center justify-center gap-0.5 w-16 hover:opacity-100 transition-opacity"
            >
              <span
                className={`material-symbols-outlined text-[26px]`}
                style={{
                  fontVariationSettings: active
                    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.45)',
                }}
              >
                {icon}
              </span>
              <span
                className="font-sans text-[10px] uppercase tracking-wider"
                style={{
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.45)',
                  fontWeight: active ? 500 : 400,
                }}
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
