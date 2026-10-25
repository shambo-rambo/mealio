import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useNavFeatures } from '../../store/prefsStore'
import { featureForPath } from '../../lib/features'
import { useAuthStore } from '../../store/authStore'
import { BottomNav } from './BottomNav'
import { Toaster } from '../shared/Toast'

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const { pathname } = useLocation()
  const enabled = useNavFeatures()

  // Redirect new users who haven't set up a family yet
  if (user && !user.familyId) {
    return <Navigate to="/setup" replace />
  }

  // Send people away from features they've switched off.
  const feature = featureForPath(pathname)
  if (feature && !enabled.some((f) => f.id === feature.id)) {
    return <Navigate to={enabled[0].to} replace />
  }

  return (
    <div className="min-h-screen bg-surface">
      <main>
        <Outlet />
      </main>
      <BottomNav />
      <Toaster />
    </div>
  )
}
