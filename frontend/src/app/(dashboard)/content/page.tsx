'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Sparkles,
  History,
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react'
import { Send } from 'lucide-react'
import { contentApi, campaignApi, socialAccountsApi, toArray } from '@/lib/api'
import {
  cn,
  getPlatformLabel,
  getPlatformColor,
  getPlatformIcon,
  truncate,
  formatRelativeTime,
  getQualityLabel,
} from '@/lib/utils'
import type {
  Platform,
  Tone,
  Language,
  ContentGeneration,
  ContentGenerateRequest,
  ContentHistoryFilters,
  PaginatedResponse,
  Campaign,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'reel_script', label: 'Reel Script' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'csr_story', label: 'CSR Story' },
  { value: 'founder_post', label: 'Founder Post' },
]

const TONES: Array<{ value: Tone; label: string }> = [
  { value: 'professional', label: 'Professional' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational', label: 'Educational' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'conversational', label: 'Conversational' },
]

const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'kn', label: 'Kannada' },
]

const CONTENT_KEYS = {
  all: ['content'] as const,
  history: (filters: ContentHistoryFilters) =>
    ['content', 'history', filters] as const,
}

// ─── Quality Badge ────────────────────────────────────────────────────────────

function QualityBadge({ score }: { score?: number }) {
  if (score == null) return null
  const colorClass =
    score >= 75
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : score >= 50
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', colorClass)}>
      {getQualityLabel(score)} {score}
    </span>
  )
}

// ─── Campaign Status Badge ────────────────────────────────────────────────────

function CampaignStatusBadge({ status }: { status: Campaign['status'] }) {
  const colorClass =
    status === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : status === 'draft'
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
        : status === 'completed'
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full capitalize', colorClass)}>
      {status}
    </span>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl p-4 animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
            <div className="h-6 w-16 bg-muted rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  historyFilters,
  onRegenerate,
}: {
  result: ContentGeneration
  historyFilters: ContentHistoryFilters
  onRegenerate: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(result.is_saved)
  const [feedback, setFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(
    result.feedback ?? null,
  )
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleDateTime, setScheduleDateTime] = useState('')
  const [showCampaignSelector, setShowCampaignSelector] = useState(false)
  const [showMetaPublish, setShowMetaPublish] = useState(false)
  const [metaAccountId, setMetaAccountId] = useState('')
  const [metaImageUrl, setMetaImageUrl] = useState('')
  const queryClient = useQueryClient()

  // Fetch connected Meta accounts (facebook_page + instagram)
  const metaAccountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await socialAccountsApi.list()
      return toArray<any>(res.data).filter(
        (a) => a.platform === 'facebook_page' || a.platform === 'instagram',
      )
    },
    enabled: showMetaPublish,
    staleTime: 60_000,
  })
  const metaAccounts: any[] = metaAccountsQuery.data ?? []

  const metaPostMutation = useMutation({
    mutationFn: ({ accountId, message, imageUrl }: { accountId: string; message: string; imageUrl?: string }) =>
      socialAccountsApi.metaPost({ account_id: accountId, message, image_url: imageUrl || undefined }),
    onSuccess: () => {
      setShowMetaPublish(false)
      setMetaAccountId('')
      setMetaImageUrl('')
      toast.success('Published to Meta!')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to publish to Meta')
    },
  })

  // Campaigns query — cached, fetched lazily when selector is opened
  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await campaignApi.list()
      return response.data as { items?: Campaign[] } | Campaign[]
    },
    enabled: showCampaignSelector,
    staleTime: 60_000,
  })

  const campaigns: Campaign[] = Array.isArray(campaignsQuery.data)
    ? campaignsQuery.data
    : (campaignsQuery.data as { items?: Campaign[] })?.items ?? []

  // Save mutation — with optimistic update
  const saveMutation = useMutation({
    mutationFn: (id: string) => contentApi.save(id),
    onMutate: async (id: string) => {
      if (result?.id === id) setIsSaved((prev) => !prev)
      const key = CONTENT_KEYS.history(historyFilters)
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old: any) => ({
        ...old,
        items: (old?.items ?? []).map((item: any) =>
          item.id === id ? { ...item, is_saved: !item.is_saved } : item,
        ),
      }))
      return { previous, key }
    },
    onError: (_err: any, id: any, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous)
      if (result?.id === id) setIsSaved((prev) => !prev)
      toast.error('Failed to save content')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['content', 'history'] }),
    onSuccess: (_data: any, id: any) => {
      toast.success(result?.id === id && isSaved ? 'Removed from saved' : 'Content saved!')
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: (fb: 'thumbs_up' | 'thumbs_down') =>
      contentApi.feedback(result.id, fb),
    onSuccess: (_, fb) => {
      setFeedback(fb)
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all })
    },
    onError: () => toast.error('Failed to submit feedback'),
  })

  const schedulePostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { scheduled_at: string; platform?: string } }) =>
      contentApi.schedulePost(id, data).then((r) => r.data),
    onSuccess: () => {
      setShowScheduleForm(false)
      setScheduleDateTime('')
      toast.success('Post scheduled!')
    },
    onError: () => toast.error('Failed to schedule post'),
  })

  const useInCampaignMutation = useMutation({
    mutationFn: ({ id, campaignId }: { id: string; campaignId: string }) =>
      contentApi.useInCampaign(id, { campaign_id: campaignId }).then((r) => r.data),
    onSuccess: () => {
      setShowCampaignSelector(false)
      toast.success('Added to campaign!')
    },
    onError: () => toast.error('Failed to add to campaign'),
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.generated_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleScheduleSubmit = () => {
    if (!scheduleDateTime) return
    schedulePostMutation.mutate({
      id: result.id,
      data: { scheduled_at: scheduleDateTime, platform: result.platform },
    })
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              getPlatformColor(result.platform),
            )}
          >
            {getPlatformIcon(result.platform)} {getPlatformLabel(result.platform)}
          </span>
          <QualityBadge score={result.quality_score} />
        </div>
        <span className="text-xs text-muted-foreground">{result.ai_model_used}</span>
      </div>

      {/* Generated content */}
      <div className="relative">
        <textarea
          readOnly
          value={result.generated_content}
          rows={10}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 h-8 px-3 bg-card border border-border hover:bg-muted rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Hashtags */}
      {result.hashtags && result.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800"
            >
              {tag.startsWith('#') ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap border-t border-border pt-3">
        <button
          onClick={() => saveMutation.mutate(result.id)}
          disabled={saveMutation.isPending}
          className={cn(
            'h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors',
            isSaved
              ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
              : 'bg-background text-foreground border-border hover:bg-muted',
          )}
        >
          {isSaved ? (
            <BookmarkCheck className="w-3.5 h-3.5" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
          {isSaved ? 'Saved' : 'Save'}
        </button>

        <button
          onClick={() => feedbackMutation.mutate('thumbs_up')}
          disabled={feedbackMutation.isPending}
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center border transition-colors',
            feedback === 'thumbs_up'
              ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
              : 'bg-background text-foreground border-border hover:bg-muted',
          )}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => feedbackMutation.mutate('thumbs_down')}
          disabled={feedbackMutation.isPending}
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center border transition-colors',
            feedback === 'thumbs_down'
              ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
              : 'bg-background text-foreground border-border hover:bg-muted',
          )}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onRegenerate}
          className="ml-auto h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border bg-background hover:bg-muted text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>

      {/* ── Use This Content ──────────────────────────────────────────────────── */}
      <div className="border-t border-border pt-3 space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Use This Content</p>

        <div className="flex flex-wrap gap-2">
          {/* Schedule Post button */}
          <button
            onClick={() => {
              setShowScheduleForm((prev) => !prev)
              setShowCampaignSelector(false)
              setShowMetaPublish(false)
            }}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors',
              showScheduleForm
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Schedule Post
            {showScheduleForm ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {/* Publish to Meta button */}
          <button
            onClick={() => {
              setShowMetaPublish((prev) => !prev)
              setShowScheduleForm(false)
              setShowCampaignSelector(false)
            }}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors',
              showMetaPublish
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
          >
            <Send className="w-3.5 h-3.5" />
            Publish to Meta
            {showMetaPublish ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Add to Campaign button */}
          <button
            onClick={() => {
              setShowCampaignSelector((prev) => !prev)
              setShowScheduleForm(false)
              setShowMetaPublish(false)
            }}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors',
              showCampaignSelector
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Add to Campaign
            {showCampaignSelector ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Schedule form */}
        {showScheduleForm && (
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-foreground">Schedule date &amp; time</p>
            <input
              type="datetime-local"
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleScheduleSubmit}
                disabled={!scheduleDateTime || schedulePostMutation.isPending}
                className="h-8 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {schedulePostMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Calendar className="w-3.5 h-3.5" />
                )}
                Confirm Schedule
              </button>
              <button
                onClick={() => setShowScheduleForm(false)}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Meta publish panel */}
        {showMetaPublish && (
          <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              Publish to Facebook / Instagram
            </p>

            {metaAccountsQuery.isLoading && (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading connected accounts…</span>
              </div>
            )}

            {!metaAccountsQuery.isLoading && metaAccounts.length === 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">No Meta accounts connected yet.</p>
                <a
                  href="/settings"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  → Go to Settings → Connected Accounts
                </a>
              </div>
            )}

            {metaAccounts.length > 0 && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Select account</label>
                  <select
                    value={metaAccountId}
                    onChange={(e) => setMetaAccountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Choose account…</option>
                    {metaAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.platform === 'facebook_page' ? '📘' : '📸'}{' '}
                        {a.account_name || a.account_id} ({a.platform === 'facebook_page' ? 'Facebook Page' : 'Instagram'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional image URL — required for Instagram */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Image URL{' '}
                    <span className="text-muted-foreground font-normal">
                      (required for Instagram, optional for Facebook)
                    </span>
                  </label>
                  <input
                    type="url"
                    value={metaImageUrl}
                    onChange={(e) => setMetaImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      metaPostMutation.mutate({
                        accountId: metaAccountId,
                        message:   result.generated_content,
                        imageUrl:  metaImageUrl || undefined,
                      })
                    }
                    disabled={!metaAccountId || metaPostMutation.isPending}
                    className="h-8 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {metaPostMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Publish Now
                  </button>
                  <button
                    onClick={() => setShowMetaPublish(false)}
                    className="h-8 px-3 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Campaign selector */}
        {showCampaignSelector && (
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-foreground">Select a campaign</p>
            {campaignsQuery.isLoading && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading campaigns...</span>
              </div>
            )}
            {campaignsQuery.isError && (
              <p className="text-xs text-destructive">Failed to load campaigns.</p>
            )}
            {!campaignsQuery.isLoading && campaigns.length === 0 && (
              <p className="text-xs text-muted-foreground">No campaigns found.</p>
            )}
            {campaigns.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() =>
                      useInCampaignMutation.mutate({ id: result.id, campaignId: campaign.id })
                    }
                    disabled={useInCampaignMutation.isPending}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-left transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm text-foreground font-medium truncate">
                      {campaign.name}
                    </span>
                    <CampaignStatusBadge status={campaign.status} />
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowCampaignSelector(false)}
              className="h-7 px-3 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  // Generate tab state
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [language, setLanguage] = useState<Language>('en')
  const [context, setContext] = useState('')
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [result, setResult] = useState<ContentGeneration | null>(null)

  // History tab state
  const [historyFilters, setHistoryFilters] = useState<ContentHistoryFilters>({
    page: 1,
  })

  // History card expanded content state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const queryClient = useQueryClient()

  // Pre-fill generate form from a history item and switch to generate tab
  const regenerateFromHistory = (item: ContentGeneration) => {
    setTopic(item.input_topic)
    setPlatform(item.platform as Platform)
    if ((item as any).tone) setTone((item as any).tone as Tone)
    setActiveTab('generate')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Toggle expanded full content for history cards
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: (data: ContentGenerateRequest) =>
      contentApi.generate(data).then((r) => r.data as ContentGeneration),
    onSuccess: (data) => {
      setResult(data)
      toast.success('Content generated successfully!')
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      const message = error?.response?.data?.detail || 'Failed to generate content'
      toast.error(message)
    },
  })

  // History query — only enabled when on history tab
  const historyQuery = useQuery({
    queryKey: CONTENT_KEYS.history(historyFilters),
    queryFn: async () => {
      const params: ContentHistoryFilters = {
        ...historyFilters,
        platform: historyFilters.platform || undefined,
      }
      const response = await contentApi.getHistory(params)
      return response.data as PaginatedResponse<ContentGeneration>
    },
    enabled: activeTab === 'history',
    staleTime: 30_000,
  })

  // Delete mutation — with optimistic update
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onMutate: async (deletedId: string) => {
      const key = CONTENT_KEYS.history(historyFilters)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old: any) => ({
        ...old,
        items: (old?.items ?? []).filter((item: any) => item.id !== deletedId),
        total: Math.max(0, (old?.total ?? 1) - 1),
      }))
      return { previous, key }
    },
    onError: (_err: any, _id: any, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous)
      toast.error('Failed to delete')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['content', 'history'] }),
    onSuccess: () => toast.success('Content deleted'),
  })

  const topicTooShort = topic.trim().length < 10
  const canGenerate = !topicTooShort && !generateMutation.isPending

  const handleGenerate = () => {
    if (!canGenerate) return
    generateMutation.mutate({
      topic: topic.trim(),
      platform,
      tone,
      language,
      context: context.trim() || undefined,
      include_hashtags: includeHashtags,
    })
  }

  const historyItems = historyQuery.data?.items ?? []
  const historyTotal = historyQuery.data?.total ?? 0
  const historyPageSize = historyQuery.data?.page_size ?? 10
  const currentPage = historyFilters.page ?? 1
  const totalPages = Math.ceil(historyTotal / historyPageSize)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Content Studio</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Generate AI-powered social media content for your campaigns
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab('generate')}
          className={cn(
            'flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'generate'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sparkles className="w-4 h-4" />
          Generate
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'history'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* ── GENERATE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: form */}
          <div className="xl:col-span-2 space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              {/* Platform selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={cn(
                        'h-9 px-3 rounded-lg text-xs font-medium transition-colors border text-left',
                        platform === p.value
                          ? 'ring-2 ring-primary bg-primary-50 dark:bg-primary-900/20 border-primary text-primary-700 dark:text-primary-300'
                          : 'bg-background text-foreground border-border hover:bg-muted',
                      )}
                    >
                      {getPlatformIcon(p.value)} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">
                  Topic
                  <span className="text-destructive ml-1">*</span>
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What do you want to post about? (minimum 10 characters)"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                {topic.length > 0 && topicTooShort && (
                  <p className="text-xs text-destructive">
                    Minimum 10 characters ({topic.trim().length}/10)
                  </p>
                )}
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Context (optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">
                  Additional Context{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Campaign brief, key stats, target audience, specific messages..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

              {/* Include hashtags */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm font-medium text-foreground group-hover:text-foreground/80">
                  Include hashtags
                </span>
              </label>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm shadow-sm"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Content
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: result */}
          <div className="xl:col-span-3">
            {generateMutation.isPending && (
              <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary-600 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl border-2 border-primary-400 animate-ping opacity-30" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">
                    AI is crafting your content...
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Analysing topic, optimising for {getPlatformLabel(platform)}, applying brand voice
                  </p>
                </div>
              </div>
            )}

            {!generateMutation.isPending && result && (
              <ResultCard
                result={result}
                historyFilters={historyFilters}
                onRegenerate={handleGenerate}
              />
            )}

            {!generateMutation.isPending && !result && (
              <div className="bg-card border border-border rounded-2xl min-h-[400px] flex flex-col items-center justify-center gap-3 text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">Ready to create?</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Fill in your topic on the left, choose a platform and tone, then click Generate. Your AI-powered content will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">
                Platform
              </label>
              <select
                value={historyFilters.platform ?? ''}
                onChange={(e) =>
                  setHistoryFilters((prev) => ({
                    ...prev,
                    platform: (e.target.value as Platform) || undefined,
                    page: 1,
                  }))
                }
                className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="">All platforms</option>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={historyFilters.is_saved === true}
                onChange={(e) =>
                  setHistoryFilters((prev) => ({
                    ...prev,
                    is_saved: e.target.checked ? true : undefined,
                    page: 1,
                  }))
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm font-medium text-foreground">Saved only</span>
            </label>

            {historyTotal > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {historyTotal} item{historyTotal !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* List */}
          {historyQuery.isLoading && <HistorySkeleton />}

          {historyQuery.isError && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-sm text-destructive">Failed to load history. Please try again.</p>
            </div>
          )}

          {!historyQuery.isLoading && !historyQuery.isError && historyItems.length === 0 && (
            <div className="bg-card border border-border rounded-2xl min-h-[300px] flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <History className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No content yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {historyFilters.platform || historyFilters.is_saved
                  ? 'No items match the current filters.'
                  : 'Generate your first piece of content to see it here.'}
              </p>
            </div>
          )}

          {!historyQuery.isLoading && historyItems.length > 0 && (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onDelete={() => deleteMutation.mutate(item.id)}
                  isDeleting={deleteMutation.isPending}
                  isExpanded={expandedIds.has(item.id)}
                  onToggleExpand={() => toggleExpanded(item.id)}
                  onUseAgain={() => regenerateFromHistory(item)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                disabled={currentPage <= 1}
                onClick={() =>
                  setHistoryFilters((prev) => ({
                    ...prev,
                    page: (prev.page ?? 1) - 1,
                  }))
                }
                className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setHistoryFilters((prev) => ({
                    ...prev,
                    page: (prev.page ?? 1) + 1,
                  }))
                }
                className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onDelete,
  isDeleting,
  isExpanded,
  onToggleExpand,
  onUseAgain,
}: {
  item: ContentGeneration
  onDelete: () => void
  isDeleting: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onUseAgain: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.generated_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">
            {getPlatformIcon(item.platform)}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground truncate">
              {truncate(item.input_topic, 70)}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  getPlatformColor(item.platform),
                )}
              >
                {getPlatformLabel(item.platform)}
              </span>
              <QualityBadge score={item.quality_score} />
              {item.is_saved && (
                <span className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
                  Saved
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(item.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Use Again */}
          <button
            onClick={onUseAgain}
            title="Use Again"
            className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted flex items-center gap-1 text-xs font-medium text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Use Again
          </button>

          {/* View Full */}
          <button
            onClick={onToggleExpand}
            title={isExpanded ? 'Collapse' : 'View Full'}
            className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted flex items-center gap-1 text-xs font-medium text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {isExpanded ? 'Collapse' : 'View Full'}
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy content"
            className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete"
            className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded full content */}
      {isExpanded && (
        <div className="pt-1">
          <pre className="w-full whitespace-pre-wrap break-words text-sm text-foreground bg-muted/40 border border-border rounded-xl px-4 py-3 max-h-80 overflow-y-auto font-sans">
            {item.generated_content}
          </pre>
        </div>
      )}
    </div>
  )
}
