import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { toast } from '../../components/shared/Toast'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()

  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const { permission, subscribing, subscribe, unsubscribe } = usePushNotifications()

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === user?.name) return
    setSaving(true)
    try {
      const res = await api.patch<{ user: typeof user }>('/auth/profile', { name: name.trim() })
      if (res.data.user) updateUser(res.data.user)
      toast.success('Name updated')
    } catch {
      toast.error('Could not update name')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return
    setChangingPassword(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      toast.success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      toast.error('Could not change password — check your current password')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Account settings" showBack onBack={() => navigate(-1)} />

      <div className="pt-20 px-4 mt-2 space-y-6">

        {/* Profile */}
        <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-card space-y-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Profile</p>

          <div>
            <label className="text-xs text-on-surface-variant font-medium">Display name</label>
            <div className="flex gap-2 mt-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
              />
              <button
                onClick={handleSaveName}
                disabled={saving || name.trim() === user?.name}
                className="px-4 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-40"
              >
                {saving ? '…' : 'Save'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-on-surface-variant font-medium">Email</label>
            <p className="mt-1 px-4 py-3 rounded-xl bg-surface-container-low text-on-surface-variant text-sm">
              {user?.email}
            </p>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-card space-y-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Security</p>

          <div>
            <label className="text-xs text-on-surface-variant font-medium">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-on-surface-variant font-medium">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-40"
          >
            {changingPassword ? 'Changing…' : 'Change password'}
          </button>
        </div>

        {/* Notifications */}
        {permission !== 'unsupported' && (
          <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-card space-y-4">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Notifications</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-on-surface">Push notifications</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {permission === 'granted' ? 'Enabled — you will be notified when family members update the shopping list.' : 'Get notified when family members check off items or make changes.'}
                </p>
              </div>
              {permission === 'granted' ? (
                <button
                  onClick={unsubscribe}
                  className="px-4 py-2 rounded-full border border-outline text-sm font-bold text-on-surface whitespace-nowrap"
                >
                  Turn off
                </button>
              ) : (
                <button
                  onClick={subscribe}
                  disabled={subscribing || permission === 'denied'}
                  className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold disabled:opacity-40 whitespace-nowrap"
                >
                  {subscribing ? '…' : permission === 'denied' ? 'Blocked' : 'Enable'}
                </button>
              )}
            </div>
            {permission === 'denied' && (
              <p className="text-xs text-error">Notifications are blocked. Enable them in your browser settings.</p>
            )}
          </div>
        )}

        {/* App info */}
        <div className="text-center text-xs text-on-surface-variant py-4">
          <p className="font-headline font-bold text-on-surface mb-1">Mealio</p>
          <p>Version 1.0.0</p>
        </div>
      </div>
    </div>
  )
}
