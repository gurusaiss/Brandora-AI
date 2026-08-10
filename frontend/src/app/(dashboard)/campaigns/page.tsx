'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Plus, Target, Calendar, Pencil, Trash2, Loader2, Check,
  Zap, Pause, Play, Clock, Instagram, Facebook, RefreshCw,
  BarChart2, CheckCircle2, AlertCircle, ChevronRight, ArrowRight,
  Sparkles, Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { campaignApi, automationApi, socialAccountsApi, toArray, getApiError } from '@/lib/api'
import { EmptyState } from '@/components/shared/empty-state'
import { Modal } from '@/components/shared/modal'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { cn, formatDate, getPlatformIcon, getPlatformLabel } from '@/lib/utils'
import type { Campaign, Platform, AutomationCampaign } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutoCampaign {
  id: string
  name: string
  topic: string | null
  status: string
  is_scheduled: boolean
  frequency: string
  post_time: string
  post_days: string[] | null
  next_run_at: string | null
  last_run_at: string | null
  published_posts: number
  total_posts: number
  image_url: string | null
  social_account_platform: string | null
  social_account_name: string | null
  created_at: string
}

interface SocialAccountItem {
  id: string
  platform: string
  account_name: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'draft', 'active', 'completed'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  archived:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  paused:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Every day', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly',
}

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const
const DAY_LABELS: Record<string, string> = {
  mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun',
}

const CAMPAIGN_TYPES = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'event', label: 'Event' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'csr_report', label: 'CSR Report' },
]

const ALL_PLATFORMS: Platform[] = [
  'linkedin','instagram','twitter','reel_script','carousel','csr_story','founder_post',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNextRun(next: string | null): string {
  if (!next) return '—'
  const d = new Date(next)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'Overdue'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Tomorrow ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function PlatformIcon({ platform }: { platform: string | null }) {
  if (platform === 'instagram') return <Instagram className="w-3.5 h-3.5 text-pink-500" />
  if (platform === 'facebook_page') return <Facebook className="w-3.5 h-3.5 text-blue-500" />
  return <span className="w-3.5 h-3.5" />
}

// ─── Auto Campaign Card ───────────────────────────────────────────────────────

function AutoCampaignCard({
  campaign,
  onToggle,
  onDeleteRequest,
  toggling,
}: {
  campaign: AutoCampaign
  onToggle: (id: string) => void
  onDeleteRequest: (id: string) => void
  toggling: boolean
}) {
  const isActive = campaign.status === 'active'

  return (
    <div className={cn(
      'bg-card border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow',
      isActive ? 'border-green-200 dark:border-green-800' : 'border-border',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-green-500' : 'text-muted-foreground')} />
            <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
            {campaign.topic || '—'}
          </p>
        </div>
        <span className={cn(
          'text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 capitalize',
          isActive ? STATUS_COLORS.active : STATUS_COLORS.draft,
        )}>
          {isActive ? 'Active' : 'Paused'}
        </span>
      </div>

      {/* Platform + Frequency */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <PlatformIcon platform={campaign.social_account_platform} />
          <span className="truncate max-w-[120px]">
            {campaign.social_account_name || campaign.social_account_platform || '—'}
          </span>
        </div>
        <span className="text-border">·</span>
        <div className="flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          <span>{FREQ_LABELS[campaign.frequency] || campaign.frequency}</span>
        </div>
        <span className="text-border">·</span>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{campaign.post_time}</span>
        </div>
      </div>

      {/* Next run */}
      <div className={cn(
        'text-xs px-3 py-2 rounded-lg',
        isActive ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                 : 'bg-muted text-muted-foreground',
      )}>
        {isActive ? (
          <span>⏰ Next post: <strong>{formatNextRun(campaign.next_run_at)}</strong></span>
        ) : (
          <span>Paused — resume to continue posting</span>
        )}
      </div>

      {/* Posts count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{campaign.published_posts} post{campaign.published_posts !== 1 ? 's' : ''} published</span>
        {campaign.last_run_at && (
          <span>Last: {new Date(campaign.last_run_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 pt-1 border-t border-border">
        <button
          onClick={() => onToggle(campaign.id)}
          disabled={toggling}
          className={cn(
            'flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-colors',
            isActive
              ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30'
              : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30',
          )}
        >
          {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> :
            isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {isActive ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={() => onDeleteRequest(campaign.id)}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Auto Campaign Create Form ────────────────────────────────────────────────

function AutoCampaignForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]         = useState('')
  const [topic, setTopic]       = useState('')
  const [accountId, setAccount] = useState('')
  const [frequency, setFreq]    = useState('daily')
  const [postTime, setTime]     = useState('09:00')
  const [postDays, setDays]     = useState<string[]>(['mon', 'wed', 'fri'])
  const [imageUrl, setImage]    = useState('')

  const { data: accounts } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await socialAccountsApi.list()
      return toArray<SocialAccountItem>(res.data)
    },
  })

  const createMutation = useMutation({
    mutationFn: () => campaignApi.createAuto({
      name,
      topic,
      social_account_id: accountId,
      frequency,
      post_time: postTime,
      post_days: frequency === 'weekly' ? postDays : [],
      image_url: imageUrl || undefined,
    }),
    onSuccess: () => {
      toast.success('Auto campaign started! First post will go out at ' + postTime + ' IST.')
      onCreated()
    },
    onError: (err) => toast.error(getApiError(err, 'Failed to create campaign')),
  })

  const selectedAccount = accounts?.find(a => a.id === accountId)
  const needsImage = selectedAccount?.platform === 'instagram'

  const canSubmit = name.trim() && topic.trim() && accountId &&
    (!needsImage || imageUrl.trim()) &&
    (frequency !== 'weekly' || postDays.length > 0) &&
    !createMutation.isPending

  return (
    <div className="space-y-4">
      {/* Campaign name */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Campaign name <span className="text-destructive">*</span>
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Sanitation Awareness Drive"
          autoFocus
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Topic */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Topic <span className="text-destructive">*</span>
        </label>
        <textarea
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Importance of handwashing to prevent disease in rural communities"
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          AI will generate a different post on this topic each time it runs.
        </p>
      </div>

      {/* Platform account */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Post to <span className="text-destructive">*</span>
        </label>
        {!accounts?.length ? (
          <p className="text-sm text-muted-foreground py-2">
            No connected accounts. Go to Settings → Connected Accounts first.
          </p>
        ) : (
          <select
            value={accountId}
            onChange={e => setAccount(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Choose account…</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.platform === 'facebook_page' ? '📘 ' : '📸 '}
                {a.account_name || a.platform}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Frequency + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">Frequency</label>
          <select
            value={frequency}
            onChange={e => setFreq(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">Post time (IST)</label>
          <input
            type="time"
            value={postTime}
            onChange={e => setTime(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Days (weekly only) */}
      {frequency === 'weekly' && (
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">Post on days</label>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setDays(prev =>
                  prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                )}
                className={cn(
                  'h-8 w-12 rounded-lg text-xs font-medium transition-colors',
                  postDays.includes(day)
                    ? 'bg-primary-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image URL */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Image URL {needsImage && <span className="text-destructive">* (required for Instagram)</span>}
          {!needsImage && <span className="text-muted-foreground font-normal"> (optional)</span>}
        </label>
        <input
          value={imageUrl}
          onChange={e => setImage(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {needsImage && (
          <p className="text-xs text-muted-foreground mt-1">
            Instagram requires a public image URL for every post.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!canSubmit}
          className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Zap className="w-4 h-4" />
          Start Campaign
        </button>
      </div>
    </div>
  )
}

// ─── Automation Campaign Card ─────────────────────────────────────────────────

const STATUS_COLORS_AUTO: Record<string, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  paused:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function AutomationCampaignCard({ campaign, onDelete }: { campaign: AutomationCampaign; onDelete: (id: string) => void }) {
  const router = useRouter()
  const isActive = campaign.status === 'active'

  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
          </div>
          {campaign.campaign_goal && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6 line-clamp-2">{campaign.campaign_goal}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full capitalize', STATUS_COLORS_AUTO[campaign.status] ?? STATUS_COLORS_AUTO.draft)}>
            {campaign.status}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total',    value: campaign.total_posts,     color: 'text-foreground'   },
          { label: 'Done',     value: campaign.posts_published, color: 'text-green-500'    },
          { label: 'Queued',   value: campaign.posts_scheduled, color: 'text-blue-500'     },
          { label: 'Failed',   value: campaign.posts_failed,    color: 'text-red-500'      },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center bg-muted/50 rounded-lg py-1.5">
            <p className={`text-base font-semibold ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{campaign.frequency} · {campaign.post_time} IST</span>
          <span>{campaign.progress_pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${campaign.progress_pct}%` }} />
        </div>
      </div>

      {/* Platform + dates */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {campaign.social_account_platform === 'instagram' ? '📸' : campaign.social_account_platform === 'facebook_page' ? '📘' : '🔗'}
          {campaign.social_account_name ?? campaign.social_account_platform ?? '—'}
        </span>
        <span>{campaign.start_date ? `${campaign.start_date} → ${campaign.end_date ?? '…'}` : '—'}</span>
      </div>

      {/* Delete button (stop propagation) */}
      <div className="flex justify-end pt-1 border-t border-border">
        <button
          onClick={e => { e.stopPropagation(); onDelete(campaign.id) }}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Automation Create Form (multi-step) ──────────────────────────────────────

const TONES = ['professional', 'inspirational', 'educational', 'urgent', 'conversational']
const FREQS = [
  { value: 'daily',          label: 'Daily' },
  { value: 'alternate_days', label: 'Every 2 days' },
  { value: 'weekly',         label: 'Weekly' },
  { value: 'monthly',        label: 'Monthly' },
]

function AutomationCreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', campaign_goal: '', description: '', topic: '',
    target_audience: '', tone: 'professional',
    keywords: '', target_hashtags: '', cta: '',
    start_date: '', end_date: '', frequency: 'weekly',
    post_time: '09:00', post_days: ['mon', 'wed', 'fri'] as string[],
    social_account_id: '', generate_images: false,
  })

  const { data: accounts } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await socialAccountsApi.list()
      return toArray<{ id: string; platform: string; account_name: string | null }>(res.data)
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const selectedAccount = (accounts ?? []).find(a => a.id === form.social_account_id)
      const platforms = selectedAccount ? [selectedAccount.platform as import('@/types').Platform] : []
      return automationApi.create({
        name: form.name,
        campaign_goal: form.campaign_goal || form.name,
        description: form.description || undefined,
        topic: form.topic || form.campaign_goal || form.name,
        target_audience: form.target_audience,
        tone: form.tone,
        keywords: form.keywords ? form.keywords.split(',').map(s => s.trim()).filter(Boolean) : [],
        target_hashtags: form.target_hashtags ? form.target_hashtags.split(',').map(s => s.trim()).filter(Boolean) : [],
        cta: form.cta || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        frequency: form.frequency,
        post_time: form.post_time,
        post_days: ['weekly', 'alternate_days'].includes(form.frequency) ? form.post_days : [],
        social_account_id: form.social_account_id,
        generate_images: form.generate_images,
        platforms,
      })
    },
    onSuccess: () => {
      toast.success('Campaign engine started! Posts will be auto-generated and published on schedule.')
      onCreated()
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const toggleDay = (day: string) => set('post_days',
    form.post_days.includes(day) ? form.post_days.filter(d => d !== day) : [...form.post_days, day])

  const canGoNext = step === 1
    ? form.name.trim() && form.campaign_goal.trim()
    : step === 2
    ? form.target_audience.trim()
    : step === 3
    ? form.start_date && form.end_date
    : form.social_account_id

  const fieldCls = 'w-full px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {[1,2,3,4].map(s => (
          <div key={s} className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            s <= step ? 'bg-primary' : 'bg-muted',
          )} />
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground text-sm">Campaign basics</h4>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Campaign name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. World Toilet Day 2026" autoFocus
              className={cn(fieldCls, 'h-10')} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Campaign goal *</label>
            <input value={form.campaign_goal} onChange={e => set('campaign_goal', e.target.value)}
              placeholder="e.g. Raise awareness about sanitation access in rural India"
              className={cn(fieldCls, 'h-10')} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Topic / brief (optional)</label>
            <textarea value={form.topic} onChange={e => set('topic', e.target.value)}
              placeholder="Extra context the AI should know when writing posts…"
              rows={2} className={cn(fieldCls, 'py-2 resize-none')} />
          </div>
        </div>
      )}

      {/* Step 2: Audience & tone */}
      {step === 2 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground text-sm">Audience & content style</h4>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Target audience *</label>
            <input value={form.target_audience} onChange={e => set('target_audience', e.target.value)}
              placeholder="e.g. NGO workers, CSR professionals, rural health advocates"
              className={cn(fieldCls, 'h-10')} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t} type="button" onClick={() => set('tone', t)}
                  className={cn('h-8 px-3 rounded-xl text-sm font-medium transition-colors capitalize',
                    form.tone === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Keywords (comma-separated)</label>
            <input value={form.keywords} onChange={e => set('keywords', e.target.value)}
              placeholder="WASH, sanitation, hygiene, clean water"
              className={cn(fieldCls, 'h-10')} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hashtags (comma-separated)</label>
            <input value={form.target_hashtags} onChange={e => set('target_hashtags', e.target.value)}
              placeholder="#WorldToiletDay, #Sanitation2026, #WASH"
              className={cn(fieldCls, 'h-10')} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Call to action (optional)</label>
            <input value={form.cta} onChange={e => set('cta', e.target.value)}
              placeholder="e.g. Visit our website, Donate now, Follow for updates"
              className={cn(fieldCls, 'h-10')} />
          </div>
        </div>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground text-sm">Posting schedule</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start date *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                className={cn(fieldCls, 'h-10')} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End date *</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                className={cn(fieldCls, 'h-10')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
              <select value={form.frequency} onChange={e => set('frequency', e.target.value)}
                className={cn(fieldCls, 'h-10')}>
                {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Post time (IST)</label>
              <input type="time" value={form.post_time} onChange={e => set('post_time', e.target.value)}
                className={cn(fieldCls, 'h-10')} />
            </div>
          </div>
          {['weekly', 'alternate_days'].includes(form.frequency) && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Post on days</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['mon','tue','wed','thu','fri','sat','sun'] as const).map(day => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={cn('h-8 w-12 rounded-lg text-xs font-medium transition-colors capitalize',
                      form.post_days.includes(day) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Platform */}
      {step === 4 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground text-sm">Platform & options</h4>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Social account *</label>
            {!accounts?.length ? (
              <p className="text-sm text-muted-foreground py-2">No connected accounts. Go to Settings → Connected Accounts first.</p>
            ) : (
              <select value={form.social_account_id} onChange={e => set('social_account_id', e.target.value)}
                className={cn(fieldCls, 'h-10')}>
                <option value="">Choose account…</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.platform === 'facebook_page' ? '📘 ' : '📸 '}{a.account_name || a.platform}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">AI-generated images</p>
              <p className="text-xs text-muted-foreground mt-0.5">Generate a unique image for every post (DALL-E 3 or free Pollinations.ai)</p>
            </div>
            <button type="button" onClick={() => set('generate_images', !form.generate_images)}
              className={cn('w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
                form.generate_images ? 'bg-primary' : 'bg-muted border border-border')}>
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                form.generate_images ? 'translate-x-4' : 'translate-x-0.5')} />
            </button>
          </div>
          {form.generate_images && (
            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              Images are generated ~4 hours before publish time and stored in Supabase. Instagram requires images — this will be used automatically.
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
          {step === 1 ? 'Cancel' : '← Back'}
        </button>
        {step < 4 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canGoNext}
            className="flex-1 h-10 bg-primary text-primary-foreground disabled:opacity-50 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={() => createMutation.mutate()} disabled={!canGoNext || createMutation.isPending}
            className="flex-1 h-10 bg-primary text-primary-foreground disabled:opacity-50 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Launch Campaign
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Manual Campaign Card ─────────────────────────────────────────────────────

interface CampaignForm {
  name: string; description: string; campaign_type: string
  start_date: string; end_date: string; platforms: Platform[]
}
const EMPTY_FORM: CampaignForm = {
  name: '', description: '', campaign_type: 'awareness', start_date: '', end_date: '', platforms: [],
}

function CampaignCard({
  campaign, onEdit, onDeleteRequest,
}: {
  campaign: Campaign
  onEdit: (c: Campaign) => void
  onDeleteRequest: (id: string) => void
}) {
  const pct = campaign.total_posts > 0
    ? Math.round((campaign.published_posts / campaign.total_posts) * 100) : 0

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{campaign.description}</p>
          )}
        </div>
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 capitalize',
          STATUS_COLORS[campaign.status] || STATUS_COLORS.draft)}>
          {campaign.status}
        </span>
      </div>

      {(campaign.platforms?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(campaign.platforms ?? []).slice(0, 5).map(p => (
            <span key={p} className="text-sm bg-muted rounded-lg px-2 py-0.5 text-muted-foreground">
              {getPlatformIcon(p)} {getPlatformLabel(p)}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>{campaign.start_date ? formatDate(campaign.start_date) : 'No start date'}</span>
        {campaign.end_date && <span>— {formatDate(campaign.end_date)}</span>}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Posts published</span>
          <span className="font-medium">{campaign.published_posts} / {campaign.total_posts}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex justify-end gap-1 pt-1">
        <button onClick={() => onEdit(campaign)}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDeleteRequest(campaign.id)}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab]                   = useState<'engine' | 'auto' | 'manual'>('engine')
  const [showEngineForm, setShowEngineForm] = useState(false)
  const [showAutoForm, setShowAutoForm] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal]     = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [deleteConfirmId, setDeleteConfirmId]   = useState<string | null>(null)
  const [togglingId, setTogglingId]             = useState<string | null>(null)
  const [statusFilter, setStatusFilter]         = useState<StatusTab>('all')
  const [createForm, setCreateForm] = useState<CampaignForm>(EMPTY_FORM)
  const [editForm, setEditForm]     = useState<CampaignForm>(EMPTY_FORM)

  // ── Automation Engine campaigns query ─────────────────────────────────────
  const { data: engineCampaigns = [], isLoading: engineLoading } = useQuery<AutomationCampaign[]>({
    queryKey: ['campaigns-engine'],
    queryFn: async () => {
      const res = await automationApi.list()
      return toArray<AutomationCampaign>(res.data)
    },
  })

  const deleteEngineMutation = useMutation({
    mutationFn: (id: string) => automationApi.delete(id),
    onSuccess: () => {
      toast.success('Campaign deleted')
      queryClient.invalidateQueries({ queryKey: ['campaigns-engine'] })
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  // ── Auto campaigns query ──────────────────────────────────────────────────
  const { data: autoCampaigns = [], isLoading: autoLoading } = useQuery({
    queryKey: ['campaigns-auto'],
    queryFn: async () => {
      const res = await campaignApi.listAuto()
      return toArray<AutoCampaign>(res.data)
    },
  })

  // ── Manual campaigns query ────────────────────────────────────────────────
  const { data: manualData, isLoading: manualLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await campaignApi.list()
      return res.data as { items: Campaign[]; total: number }
    },
  })
  const campaigns = manualData?.items ?? []
  const filtered  = statusFilter === 'all'
    ? campaigns.filter(c => !c.is_scheduled)
    : campaigns.filter(c => c.status === statusFilter && !c.is_scheduled)

  // ── Toggle auto campaign ──────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (id: string) => campaignApi.toggle(id),
    onMutate: (id) => setTogglingId(id),
    onSuccess: (res) => {
      const c = res.data as AutoCampaign
      toast.success(c.status === 'active' ? 'Campaign resumed ▶' : 'Campaign paused ⏸')
      queryClient.invalidateQueries({ queryKey: ['campaigns-auto'] })
    },
    onError: (err) => toast.error(getApiError(err, 'Failed to toggle campaign')),
    onSettled: () => setTogglingId(null),
  })

  // ── Create manual mutation ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => campaignApi.create({
      name: createForm.name,
      description: createForm.description,
      campaign_type: createForm.campaign_type,
      start_date: createForm.start_date || undefined,
      end_date: createForm.end_date || undefined,
      platforms: createForm.platforms,
    }),
    onSuccess: () => {
      setShowCreateModal(false); setCreateForm(EMPTY_FORM)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign created!')
    },
    onError: () => toast.error('Failed to create campaign'),
  })

  // ── Update manual mutation ────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedCampaign) throw new Error('No campaign selected')
      return campaignApi.update(selectedCampaign.id, {
        name: editForm.name, description: editForm.description,
        campaign_type: editForm.campaign_type,
        start_date: editForm.start_date || undefined,
        end_date: editForm.end_date || undefined,
        platforms: editForm.platforms,
      })
    },
    onSuccess: () => {
      setShowEditModal(false); setSelectedCampaign(null)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign updated!')
    },
    onError: () => toast.error('Failed to update campaign'),
  })

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => campaignApi.delete(id),
    onSuccess: () => {
      setDeleteConfirmId(null)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns-auto'] })
      toast.success('Campaign deleted')
    },
    onError: () => toast.error('Failed to delete campaign'),
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Auto-schedule AI-generated posts or plan manual content campaigns
          </p>
        </div>
        <button
          onClick={() => tab === 'engine' ? setShowEngineForm(true) : tab === 'auto' ? setShowAutoForm(true) : setShowCreateModal(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground hover:opacity-90 font-semibold rounded-xl transition-opacity text-sm"
        >
          {tab === 'engine' ? <Sparkles className="w-4 h-4" /> : tab === 'auto' ? <Zap className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {tab === 'engine' ? 'New Automation' : tab === 'auto' ? 'New Auto Campaign' : 'New Campaign'}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {([
          { key: 'engine', label: '✨ Campaign Engine' },
          { key: 'auto',   label: '⚡ Auto Scheduled' },
          { key: 'manual', label: '📋 Manual' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('h-8 px-4 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
              tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ENGINE TAB ───────────────────────────────────────────────────── */}
      {tab === 'engine' && (
        <>
          {/* Create form modal */}
          <Modal isOpen={showEngineForm} onClose={() => setShowEngineForm(false)} title="Create Automation Campaign" size="md">
            <AutomationCreateForm
              onClose={() => setShowEngineForm(false)}
              onCreated={() => {
                setShowEngineForm(false)
                queryClient.invalidateQueries({ queryKey: ['campaigns-engine'] })
              }}
            />
          </Modal>

          {engineLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-52 bg-card border border-border rounded-2xl animate-pulse" />)}
            </div>
          ) : engineCampaigns.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-8 h-8" />}
              title="No automation campaigns yet"
              description="Create a campaign once — the engine auto-generates unique AI content for every slot and publishes on schedule."
              action={{ label: 'Create Automation Campaign', onClick: () => setShowEngineForm(true) }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {engineCampaigns.map(c => (
                <AutomationCampaignCard
                  key={c.id}
                  campaign={c}
                  onDelete={(id) => deleteEngineMutation.mutate(id)}
                />
              ))}
            </div>
          )}

          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 text-sm text-purple-800 dark:text-purple-300">
            <strong>How Campaign Engine works:</strong> You define the goal, audience, tone, and schedule.
            The engine generates the full posting calendar upfront, then auto-creates unique AI content per post ~4 hours before publish time — and publishes automatically.
          </div>
        </>
      )}

      {/* ── AUTO TAB ─────────────────────────────────────────────────────── */}
      {tab === 'auto' && (
        <>
          {showAutoForm && (
            <div className="bg-card border border-primary/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">New Auto Campaign</h3>
              </div>
              <AutoCampaignForm
                onClose={() => setShowAutoForm(false)}
                onCreated={() => {
                  setShowAutoForm(false)
                  queryClient.invalidateQueries({ queryKey: ['campaigns-auto'] })
                }}
              />
            </div>
          )}

          {autoLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-56 bg-card border border-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : autoCampaigns.length === 0 ? (
            <EmptyState
              icon={<Zap className="w-8 h-8" />}
              title="No auto campaigns yet"
              description="Create an auto campaign and AI will generate + post content on your schedule — daily, weekly, or monthly."
              action={{ label: 'Create auto campaign', onClick: () => setShowAutoForm(true) }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {autoCampaigns.map(c => (
                <AutoCampaignCard
                  key={c.id}
                  campaign={c}
                  onToggle={(id) => toggleMutation.mutate(id)}
                  onDeleteRequest={setDeleteConfirmId}
                  toggling={togglingId === c.id}
                />
              ))}
            </div>
          )}

          {/* Info banner */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            <strong>How it works:</strong> Every 5 minutes, the scheduler checks for due campaigns.
            When it's time, Groq AI generates a fresh post on your topic and publishes it automatically to your connected account.
          </div>
        </>
      )}

      {/* ── MANUAL TAB ───────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <>
          <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
            {(['all', 'draft', 'active', 'completed'] as StatusTab[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('h-8 px-3 text-sm font-medium rounded-lg transition-colors capitalize',
                  statusFilter === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {manualLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-56 bg-card border border-border rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Target className="w-8 h-8" />}
              title="No campaigns yet"
              description="Create a campaign to plan multi-platform content at scale."
              action={{ label: 'Create campaign', onClick: () => setShowCreateModal(true) }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(c => (
                <CampaignCard key={c.id} campaign={c}
                  onEdit={camp => { setSelectedCampaign(camp); setEditForm({ name: camp.name, description: camp.description ?? '', campaign_type: camp.campaign_type, start_date: camp.start_date ?? '', end_date: camp.end_date ?? '', platforms: camp.platforms }); setShowEditModal(true) }}
                  onDeleteRequest={setDeleteConfirmId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create manual modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Campaign" size="md">
        <div className="space-y-4">
          {/* name */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Campaign name *</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Menstrual Hygiene Day 2026" autoFocus
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Description</label>
            <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreateModal(false)}
              className="flex-1 h-10 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={() => { if (!createForm.name.trim()) { toast.error('Name required'); return; } createMutation.mutate() }}
              disabled={!createForm.name.trim() || createMutation.isPending}
              className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedCampaign(null) }} title="Edit Campaign" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Campaign name</label>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowEditModal(false); setSelectedCampaign(null) }}
              className="flex-1 h-10 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
              className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
        title="Delete Campaign"
        message="This campaign will be permanently deleted."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
