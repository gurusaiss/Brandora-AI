'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Sparkles, History, Loader2, Copy, Check, ThumbsUp, ThumbsDown,
  Bookmark, BookmarkCheck, RefreshCw, Trash2, ChevronLeft, ChevronRight,
  Calendar, FolderPlus, ChevronDown, ChevronUp, RotateCcw, Send,
  Zap, Clock, Star,
} from 'lucide-react'
import { contentApi, campaignApi, socialAccountsApi, toArray } from '@/lib/api'
import {
  cn, getPlatformLabel, getPlatformColor, getPlatformIcon,
  truncate, formatRelativeTime, getQualityLabel,
} from '@/lib/utils'
import type {
  Platform, Tone, Language, ContentGeneration,
  ContentGenerateRequest, ContentHistoryFilters, PaginatedResponse, Campaign,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: Array<{ value: Platform; label: string; emoji: string; hint: string }> = [
  { value: 'linkedin',     label: 'LinkedIn',     emoji: '💼', hint: 'Professional post' },
  { value: 'instagram',    label: 'Instagram',    emoji: '📸', hint: 'Visual caption' },
  { value: 'twitter',      label: 'Twitter / X',  emoji: '🐦', hint: 'Short & punchy' },
  { value: 'reel_script',  label: 'Reel Script',  emoji: '🎬', hint: 'Video narration' },
  { value: 'carousel',     label: 'Carousel',     emoji: '🖼️', hint: 'Slide content' },
  { value: 'csr_story',    label: 'CSR Story',    emoji: '🌱', hint: 'Impact narrative' },
  { value: 'founder_post', label: 'Founder Post', emoji: '🎯', hint: 'Personal brand' },
]

const TONES: Array<{ value: Tone; label: string; emoji: string }> = [
  { value: 'professional',   label: 'Professional',   emoji: '🎩' },
  { value: 'inspirational',  label: 'Inspirational',  emoji: '✨' },
  { value: 'educational',    label: 'Educational',    emoji: '📚' },
  { value: 'urgent',         label: 'Urgent',         emoji: '🔥' },
  { value: 'conversational', label: 'Conversational', emoji: '💬' },
]

const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'hi', label: '🇮🇳 Hindi' },
  { value: 'bn', label: '🇧🇩 Bengali' },
  { value: 'ta', label: '🇮🇳 Tamil' },
  { value: 'kn', label: '🇮🇳 Kannada' },
]

const CONTENT_KEYS = {
  all: ['content'] as const,
  history: (filters: ContentHistoryFilters) => ['content', 'history', filters] as const,
  historyAll: ['content', 'history'] as const,
}

// ─── Quality Badge ─────────────────────────────────────────────────────────────

function QualityBadge({ score }: { score?: number }) {
  if (score == null) return null
  const cls =
    score >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : score >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cls)}>
      <Star className="w-2.5 h-2.5" />
      {score}
    </span>
  )
}

// ─── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({
  result, historyFilters, onRegenerate,
}: {
  result: ContentGeneration
  historyFilters: ContentHistoryFilters
  onRegenerate: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(result.is_saved)
  const [feedback, setFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(result.feedback ?? null)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleDateTime, setScheduleDateTime] = useState('')
  const [showCampaignSelector, setShowCampaignSelector] = useState(false)
  const [showMetaPublish, setShowMetaPublish] = useState(false)
  const [metaAccountId, setMetaAccountId] = useState('')
  const [metaImageUrl, setMetaImageUrl] = useState('')
  const queryClient = useQueryClient()

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
      setShowMetaPublish(false); setMetaAccountId(''); setMetaImageUrl('')
      toast.success('Published to Meta! 🎉')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to publish to Meta'),
  })

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await campaignApi.list()
      return res.data as { items?: Campaign[] } | Campaign[]
    },
    enabled: showCampaignSelector,
    staleTime: 60_000,
  })
  const campaigns: Campaign[] = Array.isArray(campaignsQuery.data)
    ? campaignsQuery.data
    : (campaignsQuery.data as { items?: Campaign[] })?.items ?? []

  const saveMutation = useMutation({
    mutationFn: (id: string) => contentApi.save(id),
    onMutate: async (id: string) => {
      const wasAlreadySaved = result?.id === id ? isSaved : undefined
      if (result?.id === id) setIsSaved((prev) => !prev)
      const key = CONTENT_KEYS.history(historyFilters)
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old: any) => ({
        ...old,
        items: (old?.items ?? []).map((item: any) =>
          item.id === id ? { ...item, is_saved: !item.is_saved } : item,
        ),
      }))
      return { previous, key, wasAlreadySaved }
    },
    onError: (_err: any, id: any, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous)
      if (result?.id === id) setIsSaved((prev) => !prev)
      toast.error('Failed to save content')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.historyAll }),
    onSuccess: (_data: any, id: any, ctx: any) =>
      toast.success(result?.id === id && ctx?.wasAlreadySaved ? 'Removed from saved' : 'Saved! ✓'),
  })

  const feedbackMutation = useMutation({
    mutationFn: (fb: 'thumbs_up' | 'thumbs_down') => contentApi.feedback(result.id, fb),
    onSuccess: (_, fb) => { setFeedback(fb); queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all }) },
    onError: () => toast.error('Failed to submit feedback'),
  })

  const schedulePostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { scheduled_at: string; platform?: string } }) =>
      contentApi.schedulePost(id, data).then((r) => r.data),
    onSuccess: () => { setShowScheduleForm(false); setScheduleDateTime(''); toast.success('Post scheduled! 📅') },
    onError: () => toast.error('Failed to schedule post'),
  })

  const useInCampaignMutation = useMutation({
    mutationFn: ({ id, campaignId }: { id: string; campaignId: string }) =>
      contentApi.useInCampaign(id, { campaign_id: campaignId }).then((r) => r.data),
    onSuccess: () => { setShowCampaignSelector(false); toast.success('Added to campaign!') },
    onError: () => toast.error('Failed to add to campaign'),
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.generated_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeAll = () => { setShowScheduleForm(false); setShowCampaignSelector(false); setShowMetaPublish(false) }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', getPlatformColor(result.platform))}>
            {getPlatformIcon(result.platform)} {getPlatformLabel(result.platform)}
          </span>
          <QualityBadge score={result.quality_score} />
          {isSaved && (
            <span className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800 font-medium">
              Saved
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{result.ai_model_used}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Content display */}
        <div className="relative group">
          <div className="min-h-[180px] max-h-[400px] overflow-y-auto px-4 py-3 rounded-xl border border-border bg-background/50 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {result.generated_content}
          </div>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 h-8 px-3 bg-card border border-border hover:bg-muted rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
          >
            {copied ? <><Check className="w-3.5 h-3.5 text-green-500" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
          </button>
        </div>

        {/* Always-visible copy button for mobile */}
        <button
          onClick={handleCopy}
          className="sm:hidden w-full h-9 border border-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors"
        >
          {copied ? <><Check className="w-4 h-4 text-green-500" />Copied!</> : <><Copy className="w-4 h-4" />Copy Content</>}
        </button>

        {/* Hashtags */}
        {result.hashtags && result.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.hashtags.map((tag) => (
              <span key={tag} className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Primary actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
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
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            {isSaved ? 'Saved' : 'Save'}
          </button>

          <button
            onClick={() => feedbackMutation.mutate('thumbs_up')} disabled={feedbackMutation.isPending}
            className={cn('h-8 w-8 rounded-lg flex items-center justify-center border transition-colors',
              feedback === 'thumbs_up' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300' : 'bg-background border-border hover:bg-muted')}
            title="Good content"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => feedbackMutation.mutate('thumbs_down')} disabled={feedbackMutation.isPending}
            className={cn('h-8 w-8 rounded-lg flex items-center justify-center border transition-colors',
              feedback === 'thumbs_down' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300' : 'bg-background border-border hover:bg-muted')}
            title="Poor content"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>

          <button onClick={handleCopy} className="hidden sm:flex h-8 px-3 rounded-lg text-xs font-medium items-center gap-1.5 border border-border bg-background hover:bg-muted transition-colors">
            {copied ? <><Check className="w-3.5 h-3.5 text-green-500" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
          </button>

          <button
            onClick={onRegenerate}
            className="ml-auto h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border bg-background hover:bg-muted text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />Regenerate
          </button>
        </div>

        {/* Publish / Schedule / Campaign */}
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Use This Content</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'schedule', icon: Calendar, label: 'Schedule Post', active: showScheduleForm },
              { key: 'meta',     icon: Send,     label: 'Publish to Meta', active: showMetaPublish },
              { key: 'campaign', icon: FolderPlus, label: 'Add to Campaign', active: showCampaignSelector },
            ].map(({ key, icon: Icon, label, active }) => (
              <button
                key={key}
                onClick={() => {
                  if (key === 'schedule') { closeAll(); setShowScheduleForm((p) => !p) }
                  else if (key === 'meta') { closeAll(); setShowMetaPublish((p) => !p) }
                  else { closeAll(); setShowCampaignSelector((p) => !p) }
                }}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors',
                  active
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {active ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            ))}
          </div>

          {/* Schedule panel */}
          {showScheduleForm && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Pick date &amp; time</p>
              <input
                type="datetime-local" value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => schedulePostMutation.mutate({ id: result.id, data: { scheduled_at: scheduleDateTime, platform: result.platform } })}
                  disabled={!scheduleDateTime || schedulePostMutation.isPending}
                  className="h-8 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  {schedulePostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                  Schedule
                </button>
                <button onClick={() => setShowScheduleForm(false)} className="h-8 px-3 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Meta publish panel */}
          {showMetaPublish && (
            <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Publish to Facebook / Instagram</p>
              {metaAccountsQuery.isLoading && (
                <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Loading accounts…</span></div>
              )}
              {!metaAccountsQuery.isLoading && metaAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground">No Meta accounts connected. <a href="/settings" className="underline text-blue-600">Go to Settings →</a></p>
              )}
              {metaAccounts.length > 0 && (
                <>
                  <select value={metaAccountId} onChange={(e) => setMetaAccountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                    <option value="">Choose account…</option>
                    {metaAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.platform === 'facebook_page' ? '📘' : '📸'} {a.account_name || a.account_id}
                      </option>
                    ))}
                  </select>
                  <input type="url" value={metaImageUrl} onChange={(e) => setMetaImageUrl(e.target.value)}
                    placeholder="Image URL (required for Instagram)"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => metaPostMutation.mutate({ accountId: metaAccountId, message: result.generated_content, imageUrl: metaImageUrl || undefined })}
                      disabled={!metaAccountId || metaPostMutation.isPending}
                      className="h-8 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      {metaPostMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Publish Now
                    </button>
                    <button onClick={() => setShowMetaPublish(false)} className="h-8 px-3 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Campaign selector */}
          {showCampaignSelector && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Select a campaign</p>
              {campaignsQuery.isLoading && <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Loading…</span></div>}
              {!campaignsQuery.isLoading && campaigns.length === 0 && <p className="text-xs text-muted-foreground">No campaigns found.</p>}
              {campaigns.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {campaigns.map((c) => (
                    <button key={c.id} onClick={() => useInCampaignMutation.mutate({ id: result.id, campaignId: c.id })}
                      disabled={useInCampaignMutation.isPending}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-left transition-colors disabled:opacity-50">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{c.status}</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowCampaignSelector(false)} className="h-7 px-3 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item, onDelete, isDeleting, isExpanded, onToggleExpand, onUseAgain, historyFilters,
}: {
  item: ContentGeneration
  onDelete: () => void
  isDeleting: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onUseAgain: () => void
  historyFilters: ContentHistoryFilters
}) {
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(item.is_saved)
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: (id: string) => contentApi.save(id),
    onMutate: () => setIsSaved((p) => !p),
    onError: () => { setIsSaved((p) => !p); toast.error('Failed') },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.historyAll }),
    onSuccess: () => toast.success(isSaved ? 'Removed' : 'Saved! ✓'),
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.generated_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      'bg-card border rounded-2xl overflow-hidden transition-all',
      isSaved ? 'border-primary-200 dark:border-primary-800' : 'border-border',
    )}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-lg flex-shrink-0">
          {getPlatformIcon(item.platform)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{truncate(item.input_topic, 65)}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getPlatformColor(item.platform))}>
              {getPlatformLabel(item.platform)}
            </span>
            <QualityBadge score={item.quality_score} />
            {isSaved && (
              <span className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">
                ✓ Saved
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(item.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Preview / expanded content */}
      <div
        className={cn(
          'px-4 pb-3 text-sm text-foreground leading-relaxed',
          !isExpanded && 'line-clamp-3',
        )}
      >
        {item.generated_content}
      </div>

      {item.generated_content.length > 200 && (
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 px-4 pb-2 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          {isExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Read more</>}
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border bg-muted/20">
        <button
          onClick={() => saveMutation.mutate(item.id)}
          disabled={saveMutation.isPending}
          className={cn(
            'h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors',
            isSaved ? 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          {isSaved ? 'Saved' : 'Save'}
        </button>

        <button onClick={handleCopy}
          className="h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          {copied ? <><Check className="w-3.5 h-3.5 text-green-500" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </button>

        <button onClick={onUseAgain}
          className="h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />Use Again
        </button>

        <button
          onClick={onDelete} disabled={isDeleting}
          className="ml-auto h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:opacity-40"
        >
          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded" />
            <div className="h-3 bg-muted rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [language, setLanguage] = useState<Language>('en')
  const [context, setContext] = useState('')
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [result, setResult] = useState<ContentGeneration | null>(null)
  const [historyFilters, setHistoryFilters] = useState<ContentHistoryFilters>({ page: 1 })
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const queryClient = useQueryClient()

  const regenerateFromHistory = (item: ContentGeneration) => {
    setTopic(item.input_topic)
    setPlatform(item.platform as Platform)
    if ((item as any).tone) setTone((item as any).tone as Tone)
    setActiveTab('generate')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // History query — always enabled so switching to tab is instant
  const historyQuery = useQuery({
    queryKey: CONTENT_KEYS.history(historyFilters),
    queryFn: async () => {
      const params: ContentHistoryFilters = { ...historyFilters, platform: historyFilters.platform || undefined }
      const response = await contentApi.getHistory(params)
      return response.data as PaginatedResponse<ContentGeneration>
    },
    staleTime: 10_000,
  })

  // Generate — on success, inject into history cache immediately
  const generateMutation = useMutation({
    mutationFn: (data: ContentGenerateRequest) =>
      contentApi.generate(data).then((r) => r.data as ContentGeneration),
    onSuccess: (data) => {
      setResult(data)
      toast.success('Content generated!')
      // Inject into history cache so History tab shows it immediately
      queryClient.setQueryData(CONTENT_KEYS.history({ page: 1 }), (old: any) => ({
        items: [data, ...(old?.items ?? [])].slice(0, 20),
        total: (old?.total ?? 0) + 1,
        page: 1,
        page_size: old?.page_size ?? 20,
      }))
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.historyAll })
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error?.response?.data?.detail || 'Failed to generate content')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onMutate: async (deletedId: string) => {
      setDeletingIds((prev) => new Set(prev).add(deletedId))
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
    onSettled: (_data: any, _err: any, id: any) => {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.historyAll })
    },
    onSuccess: () => toast.success('Deleted'),
  })

  const topicTooShort = topic.trim().length < 10
  const canGenerate = !topicTooShort && !generateMutation.isPending

  const handleGenerate = () => {
    if (!canGenerate) return
    generateMutation.mutate({ topic: topic.trim(), platform, tone, language, context: context.trim() || undefined, include_hashtags: includeHashtags })
  }

  const historyItems = historyQuery.data?.items ?? []
  const historyTotal = historyQuery.data?.total ?? 0
  const historyPageSize = historyQuery.data?.page_size ?? 20
  const currentPage = historyFilters.page ?? 1
  const totalPages = Math.ceil(historyTotal / historyPageSize)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Content Studio</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Generate AI-powered content for your campaigns
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-6">
        {([
          { key: 'generate', icon: Sparkles, label: 'Generate' },
          { key: 'history',  icon: History,  label: `History${historyTotal > 0 ? ` (${historyTotal})` : ''}` },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors',
              activeTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── GENERATE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Form */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">

              {/* Platform */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={cn(
                        'flex flex-col items-start px-3 py-2.5 rounded-xl text-xs font-medium transition-all border text-left',
                        platform === p.value
                          ? 'ring-2 ring-primary bg-primary-50 dark:bg-primary-900/20 border-primary text-primary-700 dark:text-primary-300'
                          : 'bg-background border-border hover:bg-muted text-foreground',
                      )}
                    >
                      <span className="text-base mb-0.5">{p.emoji}</span>
                      <span className="font-semibold leading-tight">{p.label}</span>
                      <span className="text-muted-foreground text-[10px] leading-tight">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    Topic <span className="text-destructive">*</span>
                  </label>
                  <span className={cn('text-xs', topicTooShort && topic.length > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {topic.trim().length}/10 min
                  </span>
                </div>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate() }}
                  placeholder="What do you want to post about? e.g. 'Importance of handwashing in rural schools'"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                <p className="text-xs text-muted-foreground">Tip: Ctrl+Enter to generate</p>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Tone</label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={cn(
                        'h-8 px-3 rounded-lg text-xs font-medium transition-colors border',
                        tone === t.value
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary text-primary-700 dark:text-primary-300'
                          : 'bg-background border-border hover:bg-muted text-foreground',
                      )}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Context */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">
                  Additional Context <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Key stats, audience details, campaign brief…"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                />
              </div>

              {/* Hashtags toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={cn(
                  'w-10 h-6 rounded-full relative transition-colors',
                  includeHashtags ? 'bg-primary-600' : 'bg-muted-foreground/30',
                )}>
                  <span className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    includeHashtags ? 'translate-x-5' : 'translate-x-1',
                  )} />
                  <input type="checkbox" className="sr-only" checked={includeHashtags} onChange={(e) => setIncludeHashtags(e.target.checked)} />
                </div>
                <span className="text-sm font-medium text-foreground">Include hashtags</span>
              </label>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm shadow-sm hover:shadow-md"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                ) : (
                  <><Zap className="w-4 h-4" />Generate Content</>
                )}
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="xl:col-span-3">
            {generateMutation.isPending && (
              <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary-600 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl border-2 border-primary-400 animate-ping opacity-25" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-foreground">Crafting your content…</p>
                  <p className="text-sm text-muted-foreground">
                    Analysing topic · Optimising for {PLATFORMS.find(p => p.value === platform)?.label} · Applying brand voice
                  </p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            {!generateMutation.isPending && result && (
              <ResultCard result={result} historyFilters={historyFilters} onRegenerate={handleGenerate} />
            )}

            {!generateMutation.isPending && !result && (
              <div className="bg-card border border-dashed border-border rounded-2xl min-h-[420px] flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-900/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Your content appears here</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Fill in your topic, choose a platform and tone, then click Generate.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2 w-full max-w-xs">
                  {['Topic', 'Platform', 'Generate'].map((step, i) => (
                    <div key={step} className="text-center">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground mx-auto mb-1">
                        {i + 1}
                      </div>
                      <p className="text-xs text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-4">
            <select
              value={historyFilters.platform ?? ''}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, platform: (e.target.value as Platform) || undefined, page: 1 }))}
              className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            >
              <option value="">All platforms</option>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <div className={cn('w-9 h-5 rounded-full relative transition-colors', historyFilters.is_saved ? 'bg-primary-600' : 'bg-muted-foreground/30')}>
                <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', historyFilters.is_saved ? 'translate-x-4' : 'translate-x-0.5')} />
                <input type="checkbox" className="sr-only"
                  checked={historyFilters.is_saved === true}
                  onChange={(e) => setHistoryFilters((prev) => ({ ...prev, is_saved: e.target.checked ? true : undefined, page: 1 }))} />
              </div>
              <span className="text-sm font-medium text-foreground">Saved only</span>
            </label>

            {historyTotal > 0 && (
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {historyTotal} item{historyTotal !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {historyQuery.isLoading && <HistorySkeleton />}

          {historyQuery.isError && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-sm text-destructive">Failed to load history. Please refresh.</p>
            </div>
          )}

          {!historyQuery.isLoading && !historyQuery.isError && historyItems.length === 0 && (
            <div className="bg-card border border-dashed border-border rounded-2xl min-h-[300px] flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <History className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No content yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {historyFilters.platform || historyFilters.is_saved
                  ? 'No items match these filters.'
                  : 'Generate content and it will appear here automatically.'}
              </p>
              {!historyFilters.platform && !historyFilters.is_saved && (
                <button onClick={() => setActiveTab('generate')}
                  className="mt-2 h-9 px-5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  Generate First Content
                </button>
              )}
            </div>
          )}

          {!historyQuery.isLoading && historyItems.length > 0 && (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  historyFilters={historyFilters}
                  onDelete={() => deleteMutation.mutate(item.id)}
                  isDeleting={deletingIds.has(item.id)}
                  isExpanded={expandedIds.has(item.id)}
                  onToggleExpand={() => toggleExpanded(item.id)}
                  onUseAgain={() => regenerateFromHistory(item)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setHistoryFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
                className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setHistoryFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
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
