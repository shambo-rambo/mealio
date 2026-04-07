import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { toast } from '../../components/shared/Toast'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../lib/api'
import type { FamilyMember } from '../../types'

function useFamilyQuery() {
  return useQuery({
    queryKey: ['family'],
    queryFn: () => api.get<{ family: { id: string; name: string; ownerId: string }; members: FamilyMember[] }>('/family').then((r) => r.data),
  })
}

function useInviteCodeMutation() {
  return useMutation({
    mutationFn: () => api.post<{ code: string; expiresAt: string }>('/family/invite').then((r) => r.data),
  })
}

function useRemoveMemberMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/family/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] }),
  })
}

function useChangRoleMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/family/members/${userId}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] }),
  })
}

function useRenameFamilyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.patch('/family', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family'] }),
  })
}

// ── Invite Sheet ──────────────────────────────────────────────────────────────

function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteCodeMutation()
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const generate = async () => {
    try {
      const data = await invite.mutateAsync()
      setCode(data.code)
      setExpiresAt(data.expiresAt)
    } catch {
      toast.error('Could not generate invite code')
    }
  }

  const handleClose = () => {
    setCode(null)
    setExpiresAt(null)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Invite to family" size="md">
      <div className="space-y-4 pb-4">
        {code ? (
          <>
            <p className="text-on-surface-variant text-sm text-center">Share this code with your family member</p>
            <div className="bg-surface-container-low rounded-2xl p-6 text-center">
              <p className="font-headline font-bold text-4xl tracking-[0.3em] text-primary">{code}</p>
              {expiresAt && (
                <p className="text-xs text-on-surface-variant mt-2">
                  Expires {new Date(expiresAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(code); toast.success('Code copied!') }}
              className="w-full py-3 rounded-full bg-surface-container text-on-surface font-headline font-bold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Copy code
            </button>
          </>
        ) : (
          <>
            <p className="text-on-surface-variant text-sm text-center">Generate a 6-digit code that your family member can enter to join.</p>
            <button
              onClick={generate}
              disabled={invite.isPending}
              className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
            >
              {invite.isPending ? 'Generating…' : 'Generate invite code'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isCurrentUser,
  canManage,
  onRemove,
  onChangeRole,
}: {
  member: FamilyMember
  isCurrentUser: boolean
  canManage: boolean
  onRemove: () => void
  onChangeRole: (role: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const roleColors: Record<string, string> = {
    owner: 'bg-primary/10 text-primary',
    admin: 'bg-amber-100 text-amber-800',
    member: 'bg-surface-container text-on-surface-variant',
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-2xl shadow-card relative">
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        {member.avatar ? (
          <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <span className="font-headline font-bold text-primary text-sm">
            {member.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-on-surface truncate">
          {member.name}{isCurrentUser ? ' (You)' : ''}
        </p>
        <p className="text-xs text-on-surface-variant truncate">{member.email}</p>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${roleColors[member.role] ?? roleColors.member}`}>
        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
      </span>
      {canManage && !isCurrentUser && member.role !== 'owner' && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">more_vert</span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden w-44">
                {member.role !== 'admin' && (
                  <button
                    onClick={() => { onChangeRole('admin'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    Make admin
                  </button>
                )}
                {member.role === 'admin' && (
                  <button
                    onClick={() => { onChangeRole('member'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    Remove admin
                  </button>
                )}
                <button
                  onClick={() => { onRemove(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[18px]">person_remove</span>
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function FamilyPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading } = useFamilyQuery()
  const removeMember = useRemoveMemberMutation()
  const changeRole = useChangRoleMutation()
  const renameFamily = useRenameFamilyMutation()

  const [showInvite, setShowInvite] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [familyName, setFamilyName] = useState('')

  const canManage = user?.role === 'owner' || user?.role === 'admin'

  const handleRename = async () => {
    if (!familyName.trim()) return
    try {
      await renameFamily.mutateAsync(familyName.trim())
      toast.success('Family renamed')
      setEditingName(false)
    } catch {
      toast.error('Could not rename family')
    }
  }

  const handleRemove = async (memberId: string) => {
    try {
      await removeMember.mutateAsync(memberId)
      toast.success('Member removed')
    } catch {
      toast.error('Could not remove member')
    }
  }

  const handleChangeRole = async (memberId: string, role: string) => {
    try {
      await changeRole.mutateAsync({ userId: memberId, role })
      toast.success('Role updated')
    } catch {
      toast.error('Could not update role')
    }
  }

  const handleSignOut = () => {
    clearAuth()
    qc.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar title="Family" showAvatar />

      <div className="pt-20 px-4 mt-2 space-y-6">

        {/* Family name */}
        <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-card">
          {editingName ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false) }}
                className="flex-1 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
              />
              <button onClick={handleRename} className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold">Save</button>
              <button onClick={() => setEditingName(false)} className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant text-sm">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-on-primary text-[24px]">home</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-on-surface-variant font-medium">Family name</p>
                <p className="font-headline font-bold text-lg text-on-surface">{data?.family?.name ?? '…'}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => { setFamilyName(data?.family?.name ?? ''); setEditingName(true) }}
                  className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Members ({data?.members?.length ?? 0})
            </p>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Invite
            </button>
          </div>
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-surface-container-low animate-pulse" />
              ))
            ) : (
              data?.members?.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isCurrentUser={m.id === user?.id}
                  canManage={canManage}
                  onRemove={() => handleRemove(m.id)}
                  onChangeRole={(role) => handleChangeRole(m.id, role)}
                />
              ))
            )}
          </div>
        </div>

        {/* Settings quick links */}
        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-card">
          <button
            onClick={() => navigate('/stores')}
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-container-low transition-colors border-b border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">store</span>
            <span className="flex-1 text-left text-sm font-medium text-on-surface">Manage stores</span>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-container-low transition-colors border-b border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">settings</span>
            <span className="flex-1 text-left text-sm font-medium text-on-surface">Account settings</span>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-error">logout</span>
            <span className="flex-1 text-left text-sm font-medium text-error">Sign out</span>
          </button>
        </div>

      </div>

      <InviteSheet open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  )
}
