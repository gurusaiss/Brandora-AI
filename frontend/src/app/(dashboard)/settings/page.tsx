'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import toast from 'react-hot-toast'
import {
  Building2,
  Users,
  CreditCard,
  Key,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Copy,
  Mail,
  Shield,
  Zap,
  Check,
} from 'lucide-react'
import { teamApi, apiKeyApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { cn, copyToClipboard, formatDate, getSubscriptionBadge } from '@/lib/utils'
import type { TeamMember, ApiKey } from '@/types'

const PLAN_FEATURES = {
  free: {
    name: 'Free',
    price: '₹0',
    period: '/month',
    generations: 50,
    features: ['50 AI generations/month', '1 user', 'Basic platforms', 'Email support'],
  },
  pro: {
    name: 'Pro',
    price: '₹2,999',
    period: '/month',
    generations: 500,
    features: ['500 AI generations/month', '5 users', 'All platforms', 'Priority support', 'Advanced analytics'],
  },
  growth: {
    name: 'Growth',
    price: '₹7,999',
    period: '/month',
    generations: 2000,
    features: ['2,000 AI generations/month', '15 users', 'All platforms + API', 'Dedicated support', 'Custom brand voice'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    generations: -1,
    features: ['Unlimited generations', 'Unlimited users', 'Custom AI training', 'SLA + dedicated CSM', 'On-premise options'],
  },
}

export default function SettingsPage() {
  const { organization } = useAuthStore()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await teamApi.list()
      return res.data as TeamMember[]
    },
  })

  const { data: apiKeys, isLoading: keysLoading, refetch: refetchKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await apiKeyApi.list()
      return res.data as ApiKey[]
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () => teamApi.invite({ email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
    },
    onError: () => toast.error('Failed to send invitation'),
  })

  const createKeyMutation = useMutation({
    mutationFn: () => apiKeyApi.create(newKeyName),
    onSuccess: (res) => {
      setGeneratedKey(res.data.key)
      setNewKeyName('')
      refetchKeys()
    },
    onError: () => toast.error('Failed to create API key'),
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => {
      toast.success('API key revoked')
      refetchKeys()
    },
  })

  const currentPlan = organization?.subscription_tier || 'free'
  const badge = getSubscriptionBadge(currentPlan)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your organization, team, and account settings
        </p>
      </div>

      <Tabs.Root defaultValue="org">
        <Tabs.List className="flex gap-1 bg-muted p-1 rounded-xl mb-6 overflow-x-auto">
          {[
            { value: 'org', label: 'Organization', icon: Building2 },
            { value: 'team', label: 'Team', icon: Users },
            { value: 'billing', label: 'Billing', icon: CreditCard },
            { value: 'api', label: 'API Keys', icon: Key },
            { value: 'integrations', label: 'Integrations', icon: Link2 },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 flex-shrink-0 h-9 px-3 text-sm font-medium rounded-lg transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground"
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        {/* Organization */}
        <Tabs.Content value="org" className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-foreground">Organization Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Organization Name</label>
              <input
                defaultValue={organization?.name}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Slug</label>
              <input
                defaultValue={organization?.slug}
                className="w-full h-10 px-3 rounded-xl border border-border bg-muted text-muted-foreground text-sm focus:outline-none cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sector</label>
              <input
                defaultValue={organization?.sector}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <button className="flex items-center gap-2 h-10 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Save Changes
          </button>
        </Tabs.Content>

        {/* Team */}
        <Tabs.Content value="team" className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <h3 className="font-semibold text-foreground">Team Management</h3>

          {/* Invite */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Invite team member</p>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@organization.org"
                className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                disabled={!inviteEmail || inviteMutation.isPending}
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

          {/* Members list */}
          {membersLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-xl shimmer-bg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(members || []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
                    {member.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                      member.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
                    )}>
                      {member.role}
                    </span>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => teamApi.remove(member.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!members?.length && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No team members yet. Invite someone above!
                </p>
              )}
            </div>
          )}
        </Tabs.Content>

        {/* Billing */}
        <Tabs.Content value="billing" className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Current Plan</h3>
              <span className={cn('text-sm font-semibold px-3 py-1 rounded-full', badge.color)}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {PLAN_FEATURES[currentPlan as keyof typeof PLAN_FEATURES]?.price}
                  <span className="text-sm font-normal text-muted-foreground">
                    {PLAN_FEATURES[currentPlan as keyof typeof PLAN_FEATURES]?.period}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">AI Generations</p>
                <p className="font-semibold text-foreground">
                  {organization?.ai_generations_used} / {organization?.ai_generations_limit}
                </p>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-primary-500 rounded-full"
                style={{
                  width: `${Math.min(((organization?.ai_generations_used ?? 0) / (organization?.ai_generations_limit ?? 50)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(PLAN_FEATURES).map(([key, plan]) => (
              <div
                key={key}
                className={cn(
                  'bg-card border-2 rounded-2xl p-5 transition-all',
                  currentPlan === key
                    ? 'border-primary-500 shadow-glow'
                    : 'border-border hover:border-primary-300',
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-foreground">{plan.name}</h4>
                  {currentPlan === key && (
                    <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full font-medium">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-foreground mb-1">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
                </p>
                <ul className="space-y-1.5 mt-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {currentPlan !== key && (
                  <button className="w-full mt-4 h-9 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Upgrade to {plan.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Tabs.Content>

        {/* API Keys */}
        <Tabs.Content value="api" className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-foreground">API Keys</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use API keys to integrate Brandora AI into your own apps.
              </p>
            </div>
          </div>

          {/* Create new key */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Create new API key</p>
            <div className="flex gap-2">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production App)"
                className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={() => createKeyMutation.mutate()}
                disabled={!newKeyName || createKeyMutation.isPending}
                className="flex items-center gap-1.5 h-10 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {createKeyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create
              </button>
            </div>
          </div>

          {/* Generated key display */}
          {generatedKey && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Copy your key now — it won&apos;t be shown again!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-2 rounded-lg font-mono break-all">
                  {generatedKey}
                </code>
                <button
                  onClick={() => {
                    copyToClipboard(generatedKey)
                    toast.success('Copied!')
                  }}
                  className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4 text-green-600" />
                </button>
              </div>
            </div>
          )}

          {/* Existing keys */}
          {keysLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-xl shimmer-bg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(apiKeys || []).map((key) => (
                <div
                  key={key.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border"
                >
                  <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.key_preview}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(key.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeKeyMutation.mutate(key.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!apiKeys?.length && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No API keys yet.
                </p>
              )}
            </div>
          )}
        </Tabs.Content>

        {/* Integrations */}
        <Tabs.Content value="integrations" className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-foreground">Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Connect your social media accounts for direct publishing (coming soon).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: 'LinkedIn', desc: 'Publish posts directly', emoji: '💼', soon: true },
              { name: 'Instagram', desc: 'Schedule reels & posts', emoji: '📸', soon: true },
              { name: 'Twitter / X', desc: 'Auto-tweet content', emoji: '🐦', soon: true },
              { name: 'Buffer', desc: 'Use with Buffer scheduler', emoji: '📅', soon: true },
            ].map((int) => (
              <div
                key={int.name}
                className="flex items-center gap-3 p-4 border border-border rounded-xl"
              >
                <span className="text-2xl">{int.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{int.name}</p>
                  <p className="text-xs text-muted-foreground">{int.desc}</p>
                </div>
                {int.soon ? (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-lg">
                    Soon
                  </span>
                ) : (
                  <button className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium">
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
