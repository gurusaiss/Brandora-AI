'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Loader2,
  Trash2,
  Mail,
  LogOut,
  Users,
  Building2,
  UserCircle2,
  AlertTriangle,
  Share2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { teamApi, authApi, socialAccountsApi, toArray, getApiError } from '@/lib/api'
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

// ── Meta logo SVG ────────────────────────────────────────────────────────────
function MetaLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.04c-5.5 0-9.96 4.46-9.96 9.96 0 4.41 2.87 8.16 6.84 9.49.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85.004 1.7.114 2.5.336 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.02 10.02 0 0 0 21.96 12c0-5.5-4.46-9.96-9.96-9.96z" />
    </svg>
  )
}

// ── Platform icon components ─────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { label: string; color: string }> = {
    facebook_page: { label: 'Facebook Page', color: 'text-blue-500' },
    instagram:     { label: 'Instagram',     color: 'text-pink-500' },
    linkedin:      { label: 'LinkedIn',      color: 'text-sky-600'  },
    twitter:       { label: 'Twitter / X',   color: 'text-slate-700 dark:text-slate-300' },
  }
  const p = map[platform] ?? { label: platform, color: 'text-muted-foreground' }
  return (
    <span className={`text-xs font-semibold ${p.color}`}>{p.label}</span>
  )
}

// ── Connected Accounts section ───────────────────────────────────────────────
function ConnectedAccounts() {
  const queryClient = useQueryClient()
  const [connectingMeta, setConnectingMeta] = useState(false)

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await socialAccountsApi.list()
      return toArray<{
        id: string
        platform: string
        account_id: string
        account_name: string | null
        is_active: boolean
        token_expires_at: string | null
      }>(res.data)
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => socialAccountsApi.disconnect(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['social-accounts'] })
      const prev = queryClient.getQueryData(['social-accounts'])
      queryClient.setQueryData(['social-accounts'], (old: any[]) =>
        (old ?? []).filter((a) => a.id !== id),
      )
      return { prev }
    },
    onSuccess: () => toast.success('Account disconnected'),
    onError: (_e, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['social-accounts'], ctx.prev)
      toast.error('Failed to disconnect')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['social-accounts'] }),
  })

  const handleConnectMeta = async () => {
    setConnectingMeta(true)
    try {
      const res = await socialAccountsApi.connectMeta()
      const { auth_url } = res.data
      window.location.href = auth_url
    } catch (err: any) {
      toast.error(getApiError(err, 'Failed to start Meta OAuth. Check server configuration.'))
      setConnectingMeta(false)
    }
  }

  const metaAccounts = (accounts ?? []).filter(
    (a) => a.platform === 'facebook_page' || a.platform === 'instagram',
  )
  const hasMetaConnected = metaAccounts.length > 0

  return (
    <div className="space-y-5">
      {/* Meta connect card */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Meta "M" logo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg select-none">
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Meta (Facebook + Instagram)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasMetaConnected
                ? `${metaAccounts.length} account${metaAccounts.length > 1 ? 's' : ''} connected`
                : 'Connect to publish directly to your Page and Instagram'}
            </p>
          </div>
        </div>

        {hasMetaConnected ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">Connected</span>
            <button
              onClick={handleConnectMeta}
              disabled={connectingMeta}
              className="ml-2 text-xs text-primary hover:underline disabled:opacity-50"
            >
              Re-connect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnectMeta}
            disabled={connectingMeta}
            className="flex items-center gap-1.5 h-9 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {connectingMeta ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            {connectingMeta ? 'Redirecting…' : 'Connect'}
          </button>
        )}
      </div>

      {/* Connected accounts list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (accounts ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No social accounts connected yet.
        </p>
      ) : (
        <div className="space-y-2">
          {(accounts ?? []).map((acc) => {
            const expiresAt = acc.token_expires_at ? new Date(acc.token_expires_at) : null
            const isExpired = expiresAt ? expiresAt < new Date() : false
            const daysLeft = expiresAt
              ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
              : null

            return (
              <div
                key={acc.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isExpired ? 'bg-destructive' : 'bg-green-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PlatformBadge platform={acc.platform} />
                      <span className="text-sm text-foreground font-medium truncate max-w-[180px]">
                        {acc.account_name || acc.account_id}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isExpired
                        ? '⚠ Token expired — re-connect'
                        : daysLeft !== null
                        ? `Token valid for ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                        : 'Token active'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disconnectMutation.mutate(acc.id)}
                  disabled={disconnectMutation.isPending}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 flex-shrink-0"
                  title="Disconnect account"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Coming soon chips */}
      <div className="flex gap-2 flex-wrap pt-1">
        {['LinkedIn', 'Twitter / X'].map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground bg-muted/40"
          >
            {name}
            <span className="bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
              Coming soon
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { user, organization, logout: storeLogout } = useAuthStore()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')

  // Handle Meta OAuth callback redirects
  useEffect(() => {
    const metaConnected = searchParams.get('meta_connected')
    const metaError     = searchParams.get('meta_error')
    const count         = searchParams.get('count')

    if (metaConnected === 'true') {
      toast.success(
        count
          ? `${count} Meta account${Number(count) > 1 ? 's' : ''} connected successfully!`
          : 'Meta account connected!',
        { duration: 5000 },
      )
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
      // Clean up URL params
      router.replace('/settings')
    } else if (metaError) {
      const messages: Record<string, string> = {
        access_denied:        'Meta connection was cancelled.',
        token_exchange_failed:'Token exchange failed. Try again.',
        invalid_state:        'Security check failed. Try again.',
        no_org:               'No organisation found. Complete onboarding first.',
      }
      toast.error(messages[metaError] ?? `Meta error: ${metaError}`, { duration: 6000 })
      router.replace('/settings')
    }
  }, [searchParams, queryClient, router])

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await teamApi.list()
      return toArray<TeamMember>(res.data)
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
    try { await authApi.logout() } catch { /* ignore */ }
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
          Manage your account, organization, team and integrations
        </p>
      </div>

      {/* ── Account ─────────────────────────────────────────────────────── */}
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

      {/* ── Organization ────────────────────────────────────────────────── */}
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

      {/* ── Connected Accounts ───────────────────────────────────────────── */}
      <SectionCard icon={Share2} title="Connected Accounts">
        <ConnectedAccounts />
      </SectionCard>

      {/* ── Team Members ────────────────────────────────────────────────── */}
      <SectionCard icon={Users} title="Team Members">
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

      {/* ── Danger Zone ─────────────────────────────────────────────────── */}
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
