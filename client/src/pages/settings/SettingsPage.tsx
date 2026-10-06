import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { toast } from '../../components/shared/Toast'
import { useAuthStore } from '../../store/authStore'
import { usePrefsStore } from '../../store/prefsStore'
import { api, getErrorMessage } from '../../lib/api'
import { GoogleButton } from '../../components/auth/GoogleButton'
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
  const { dailyDozenEnabled, setDailyDozenEnabled } = usePrefsStore()

  const hasPassword = user?.hasPassword !== false

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
    if ((hasPassword && !currentPassword) || !newPassword) return
    setChangingPassword(true)
    try {
      await api.post('/auth/change-password', { currentPassword: hasPassword ? currentPassword : undefined, newPassword })
      toast.success(hasPassword ? 'Password changed' : 'Password set')
      updateUser({ hasPassword: true })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Account settings" showBack onBack={() => navigate(-1)} />

      <div className="pt-topbar px-4 mt-2 space-y-6">

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

          {user?.googleLinked ? (
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
              Google account connected
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-on-surface-variant">Connect Google to sign in with one tap, even if its email differs from this account's.</p>
              <GoogleButton
                mode="signin"
                link
                onSuccess={(d) => {
                  updateUser(d.user)
                  toast.success('Google account connected')
                }}
                onError={(m) => toast.error(m)}
              />
            </div>
          )}

          {hasPassword ? (
            <div>
              <label className="text-xs text-on-surface-variant font-medium">Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
              />
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">You sign in with Google. Add a password to also sign in with your email.</p>
          )}

          <div>
            <label className="text-xs text-on-surface-variant font-medium">{hasPassword ? 'New password' : 'Password'} (8+ characters)</label>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword || (hasPassword && !currentPassword) || newPassword.length < 8}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-40"
          >
            {changingPassword ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
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

        {/* Meal planner */}
        <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-card space-y-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Meal planner</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-on-surface">Daily Dozen tracking</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Show Dr Greger's Daily Dozen food-group tracker on each day.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={dailyDozenEnabled}
              onClick={() => setDailyDozenEnabled(!dailyDozenEnabled)}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                dailyDozenEnabled ? 'bg-primary' : 'bg-outline-variant'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  dailyDozenEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* App info */}
        <div className="text-center text-xs text-on-surface-variant py-4">
          <p className="font-headline font-bold text-on-surface mb-1">Food Prep</p>
          <p>Version 1.0.0</p>
        </div>
      </div>
    </div>
  )
}
