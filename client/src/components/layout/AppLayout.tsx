import { Navigate, Outlet } from 'react-router-dom'
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

  // Redirect new users who haven't set up a family yet
  if (user && !user.familyId) {
    return <Navigate to="/setup" replace />
  }

  return (
    <div className="min-h-screen bg-surface">
      <Outlet />
      <BottomNav />
      <Toaster />
    </div>
  )
}
