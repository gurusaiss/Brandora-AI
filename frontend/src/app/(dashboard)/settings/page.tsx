'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, Trash2, Mail, LogOut, Users, Building2, UserCircle2, AlertTriangle } from 'lucide-react'
import { teamApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import type { TeamMember } from '@/types'

const inputClass =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, organization, logout: storeLogout } = useAuthStore()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await teamApi.list()
      return res.data as TeamMember[]
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () => teamApi.invite({ email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: () => toast.error('Failed to send invitation'),
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => teamApi.remove(memberId),
    onMutate: async (memberId: string) => {
      await queryClient.cancelQueries({ queryKey: ['team-members'] })
      const previous = queryClient.getQueryData(['team-members'])
      queryClient.setQueryData(['team-members'], (old: any) => {
        if (!old) return old
        if (Array.isArray(old)) return old.filter((m: any) => m.id !== memberId)
        return {
          ...old,
          members: (old?.members ?? []).filter((m: any) => m.id !== memberId),
        }
      })
      return { previous }
    },
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
    onError: (_err: any, _id: any, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['team-members'], ctx.previous)
      toast.error('Failed to remove member')
    },
  })

  const handleSignOut = async () => {
    try {
      await authApi.logout()
    } catch {
      // proceed even if API call fails
    }
    storeLogout()
    router.push('/login')
  }

  const usedPct = Math.min(
    ((organization?.ai_generations_used ?? 0) / (organization?.ai_generations_limit ?? 20)) * 100,
    100,
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-10">
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your account, organization, and team
        </p>
      </div>

      {/* Section 1: Account */}
      <SectionCard icon={UserCircle2} title="Account">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Full Name</label>
            <input
              value={user?.full_name ?? 'User'}
              readOnly
              className={`${inputClass} bg-muted cursor-not-allowed`}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              value={user?.email ?? ''}
              readOnly
              className={`${inputClass} bg-muted cursor-not-allowed`}
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 2: Organization */}
      <SectionCard icon={Building2} title="Organization">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="sm:col-span-2">
            <label className={labelClass}>Organization Name</label>
            <input
              value={organization?.name ?? 'Your Organization'}
              readOnly
              className={`${inputClass} bg-muted cursor-not-allowed`}
            />
          </div>
          <div>
            <label className={labelClass}>Sector</label>
            <input
              value={organization?.sector || ''}
              readOnly
              className={`${inputClass} bg-muted cursor-not-allowed`}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={`${labelClass} mb-0`}>Subscription</label>
            <span className="text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              {organization?.subscription_tier || 'free'}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>AI Generations used</span>
              <span>
                {organization?.ai_generations_used ?? 0} / {organization?.ai_generations_limit ?? 20}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Section 3: Team Members */}
      <SectionCard icon={Users} title="Team Members">
        {/* Members list */}
        {membersLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Role</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(members ?? []).map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">
                      {member.full_name}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{member.email}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          member.role === 'owner'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : member.role === 'admin'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => removeMutation.mutate(member.id)}
                          disabled={removeMutation.isPending}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="Remove member"
                        >
                          {removeMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!(members ?? []).length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No team members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Invite form */}
        <div className="border-t border-border pt-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Invite a team member</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@organization.org"
              className={`flex-1 ${inputClass}`}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              className="flex items-center gap-1.5 h-10 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {inviteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Invite
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Section 4: Danger Zone */}
      <div className="bg-card border border-destructive/40 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="font-semibold text-foreground">Danger Zone</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Sign out</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You will be redirected to the login page.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 h-10 px-4 border border-destructive text-destructive hover:bg-destructive hover:text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
