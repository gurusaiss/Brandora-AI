'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, RefreshCw, Play, Pause, Trash2, Edit3, Check, X,
  Loader2, ImageIcon, Clock, CheckCircle2, AlertCircle, Zap,
  Calendar, Target, Users, Hash, ChevronDown, ChevronUp, BarChart2,
} from 'lucide-react'
import { automationApi, getApiError, toArray } from '@/lib/api'
import { socialAccountsApi } from '@/lib/api'
import type { AutomationCampaign, AutomationPost, PostStatus } from '@/types'
import { getPlatformIcon } from '@/lib/utils'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string; dot: string }> = {
  scheduled:  { label: 'Scheduled',  color: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500'   },
  generating: { label: 'Generating', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  publishing: { label: 'Publishing', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500'  },
  published:  { label: 'Published',  color: 'text-green-600 dark:text-green-400', dot: 'bg-green-500'  },
  failed:     { label: 'Failed',     color: 'text-red-600 dark:text-red-400',     dot: 'bg-red-500'    },
  retrying:   { label: 'Retrying',   color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
}

function StatusBadge({ status }: { status: PostStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {cfg.label}
    </span>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ── Analytics bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-2 rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  campaignId,
  onRegenerate,
}: {
  post: AutomationPost
  campaignId: string
  onRegenerate: (postId: string) => void
}) {
  const [expanded, setExpanded]     = useState(false)
  const [editing, setEditing]       = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: () => automationApi.updatePost(campaignId, post.id, { content: editContent }),
    onSuccess: () => {
      toast.success('Post updated')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['campaign-detail', campaignId] })
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const cfg = STATUS_CONFIG[post.status as PostStatus] ?? STATUS_CONFIG.scheduled
  const hasContent = post.content && post.content.trim().length > 0

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-lg">{getPlatformIcon(post.platform)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={post.status as PostStatus} />
            <span className="text-xs text-muted-foreground">
              {post.scheduled_at ? fmtDate(post.scheduled_at) : 'No schedule'}
            </span>
            {post.retry_count > 0 && (
              <span className="text-xs text-orange-500">Retry {post.retry_count}/{post.max_retries ?? 3}</span>
            )}
          </div>
          {hasContent && !expanded && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{post.content.slice(0, 80)}…</p>
          )}
          {!hasContent && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">Content pending generation…</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {post.status === 'scheduled' && (
            <button
              onClick={e => { e.stopPropagation(); onRegenerate(post.id) }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Regenerate content"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-background">
          {post.failure_reason && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">Failure reason</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{post.failure_reason}</p>
            </div>
          )}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 h-8 px-3 bg-primary text-primary-foreground text-xs font-medium rounded-lg"
                >
                  {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
                <button onClick={() => { setEditing(false); setEditContent(post.content) }}
                  className="flex items-center gap-1.5 h-8 px-3 border border-border text-xs text-muted-foreground rounded-lg hover:bg-muted">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {hasContent ? (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {post.content}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">Content will be generated ~4 hours before publish time.</p>
              )}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.hashtags.map(h => (
                    <span key={h} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{h}</span>
                  ))}
                </div>
              )}
              {post.image_url && (
                <img src={post.image_url} alt="Post image" className="rounded-lg max-h-48 object-cover" />
              )}
              {hasContent && post.status === 'scheduled' && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit3 className="w-3 h-3" /> Edit content
                </button>
              )}
              {post.platform_post_id && (
                <p className="text-xs text-muted-foreground">Post ID: {post.platform_post_id}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params    = useParams()
  const router    = useRouter()
  const id        = params.id as string
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<PostStatus | 'all'>('all')

  const { data: campaign, isLoading, error } = useQuery<AutomationCampaign>({
    queryKey: ['campaign-detail', id],
    queryFn:  async () => {
      const res = await automationApi.detail(id)
      return res.data
    },
    refetchInterval: 30_000,
  })

  const toggleMutation = useMutation({
    mutationFn: () => automationApi.toggle(id),
    onSuccess:  () => { toast.success('Campaign updated'); queryClient.invalidateQueries({ queryKey: ['campaign-detail', id] }) },
    onError:    (e) => toast.error(getApiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => automationApi.delete(id),
    onSuccess:  () => { toast.success('Campaign deleted'); router.push('/campaigns') },
    onError:    (e) => toast.error(getApiError(e)),
  })

  const regenMutation = useMutation({
    mutationFn: (postId: string) => automationApi.regeneratePost(id, postId),
    onSuccess:  () => { toast.success('Content regenerated'); queryClient.invalidateQueries({ queryKey: ['campaign-detail', id] }) },
    onError:    (e) => toast.error(getApiError(e)),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (error || !campaign) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">Campaign not found.</p>
      <button onClick={() => router.push('/campaigns')} className="mt-3 text-sm text-primary underline">Back to campaigns</button>
    </div>
  )

  const posts = campaign.posts ?? []
  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(p => p.status === filter)

  const stats = [
    { label: 'Total',      value: campaign.total_posts,       icon: Calendar,     color: 'text-foreground'  },
    { label: 'Scheduled',  value: campaign.posts_scheduled,   icon: Clock,        color: 'text-blue-500'    },
    { label: 'Published',  value: campaign.posts_published,   icon: CheckCircle2, color: 'text-green-500'   },
    { label: 'Failed',     value: campaign.posts_failed,      icon: AlertCircle,  color: 'text-red-500'     },
    { label: 'Remaining',  value: campaign.posts_remaining,   icon: Target,       color: 'text-amber-500'   },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/campaigns')}
          className="mt-1 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{campaign.campaign_goal}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className="flex items-center gap-1.5 h-9 px-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            {toggleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
              campaign.status === 'active' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
          </button>
          <button
            onClick={() => { if (confirm('Delete this campaign?')) deleteMutation.mutate() }}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 h-9 px-3 border border-red-200 dark:border-red-800 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" /> Campaign Progress
          </span>
          <span className="text-sm font-semibold text-primary">{campaign.progress_pct}%</span>
        </div>
        <ProgressBar pct={campaign.progress_pct} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{campaign.start_date ?? '—'}</span>
          <span>{campaign.end_date ?? '—'}</span>
        </div>
      </div>

      {/* Campaign info */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Campaign Details</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            ['Platform', campaign.social_account_platform ?? '—'],
            ['Account',  campaign.social_account_name ?? '—'],
            ['Frequency', campaign.frequency],
            ['Post time', `${campaign.post_time} IST`],
            ['Tone', campaign.tone],
            ['Images', campaign.generate_images ? 'Enabled (AI)' : 'Disabled'],
            ['Audience', campaign.target_audience ?? '—'],
            ['CTA', campaign.cta ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-muted-foreground w-24 flex-shrink-0">{k}</span>
              <span className="text-foreground font-medium truncate">{v}</span>
            </div>
          ))}
        </div>
        {campaign.keywords && campaign.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {campaign.keywords.map(kw => (
              <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{kw}</span>
            ))}
          </div>
        )}
      </div>

      {/* Posts list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">
            Posts Schedule
            <span className="ml-2 text-xs text-muted-foreground">({posts.length} total)</span>
          </h3>
          {/* Filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'scheduled', 'published', 'failed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {f === 'all' ? `All (${posts.length})` :
                  f === 'scheduled' ? `Scheduled (${campaign.posts_scheduled})` :
                  f === 'published' ? `Published (${campaign.posts_published})` :
                  `Failed (${campaign.posts_failed})`}
              </button>
            ))}
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No {filter === 'all' ? '' : filter} posts yet.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                campaignId={id}
                onRegenerate={(postId) => regenMutation.mutate(postId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
