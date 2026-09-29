import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface TopBarProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  right?: React.ReactNode
  showAvatar?: boolean
  transparent?: boolean
}

export function TopBar({
  title,
  showBack = false,
  onBack,
  right,
  showAvatar = false,
  transparent = false,
}: TopBarProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <header
      className={`fixed top-0 w-full z-50 ${transparent ? 'bg-transparent' : 'glass'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              className="material-symbols-outlined text-primary hover:opacity-70 transition-opacity flex-shrink-0"
            >
              arrow_back
            </button>
          )}
          <h1 className="font-headline font-bold text-lg text-primary truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {right}
          {showAvatar && user && (
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary-container bg-secondary-container flex items-center justify-center flex-shrink-0">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-headline font-bold text-sm text-primary-container">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
