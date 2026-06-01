'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Target,
  CalendarDays,
  Zap,
  BookOpen,
  ArrowRight,
  Clock,
  Star,
  BarChart2,
  Palette,
} from 'lucide-react'
import { analyticsApi, campaignApi, contentApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { MetricsCard } from '@/components/dashboard/metrics-card'
import {
  MetricCardSkeleton,
  ContentRowSkeleton,
} from '@/components/shared/loading-spinner'
import { EmptyState } from '@/components/shared/empty-state'
import {
  formatNumber,
  truncate,
  cn,
  getPlatformColor,
  getPlatformLabel,
  getPlatformIcon,
  formatRelativeTime,
  getQualityColor,
  getSubscriptionBadge,
} from '@/lib/utils'
import type {
  AnalyticsOverview,
  Campaign,
  ContentGeneration,
  PaginatedResponse,
} from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const { user, organization } = useAuthStore()

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
  } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const res = await analyticsApi.overview()
      return res.data
    },
    staleTime: 60000,
    retry: false,
  })

  const { data: campaignsData } = useQuery<{ items: Campaign[] }>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await campaignApi.list()
      return res.data
    },
    staleTime: 60000,
    retry: false,
  })

  const { data: historyData, isLoading: historyLoading } = useQuery<
    PaginatedResponse<ContentGeneration>
  >({
    queryKey: ['content', 'history', 5],
    queryFn: async () => {
      const res = await contentApi.getHistory({ page: 1, page_size: 5 })
      return res.data
    },
    staleTime: 30000,
    retry: false,
  })

  // ── Derived values ─────────────────────────────────────────────────────────
  const firstName = user?.full_name?.split(' ')[0] || 'there'

  const allCampaigns: Campaign[] = campaignsData?.items ?? []
  const activeCampaigns = allCampaigns.filter((c) => c.status === 'active')

  const totalGenerations = analyticsData?.total_generations ?? 0
  const avgQualityScore = analyticsData?.avg_quality_score
  const totalTokensUsed = analyticsData?.total_tokens_used ?? 0
  const generationsChangePct = analyticsData?.generations_change_pct ?? 0

  // Usage meter — prefer analytics fields, fall back to org
  const generationsUsed =
    analyticsData?.generations_used ?? organization?.ai_generations_used ?? 0
  const generationsLimit =
    analyticsData?.generations_limit ?? organization?.ai_generations_limit ?? 50
  const subscriptionTier =
    analyticsData?.subscription_tier ??
    organization?.subscription_tier ??
    'free'

  const usagePct =
    generationsLimit > 0
      ? Math.min(Math.round((generationsUsed / generationsLimit) * 100), 100)
      : 0

  const tierBadge = getSubscriptionBadge(subscriptionTier)

  const recentItems = historyData?.items?.slice(0, 5) ?? []

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* 1. Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Good to see you, {firstName}
          </h2>
          <p className="text-muted-foreground mt-1">
            Here is your content overview for{' '}
            {organization?.name ?? 'your organisation'}.
          </p>
        </div>
        <button
          onClick={() => router.push('/content')}
          className="flex items-center gap-2 h-11 px-5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-sm self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          Generate Content
        </button>
      </div>

      {/* 2. Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {analyticsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricsCard
              title="Total Generated"
              value={totalGenerations}
              change={
                generationsChangePct !== 0
                  ? {
                      value: Math.abs(Math.round(generationsChangePct)),
                      positive: generationsChangePct >= 0,
                    }
                  : undefined
              }
              icon={<Sparkles className="w-4 h-4" />}
              gradient
            />
            <MetricsCard
              title="Active Campaigns"
              value={activeCampaigns.length}
              description={
                activeCampaigns.length === 0
                  ? 'No active campaigns yet'
                  : `${activeCampaigns.length} running now`
              }
              icon={<Target className="w-4 h-4" />}
            />
            <MetricsCard
              title="Avg Quality Score"
              value={
                avgQualityScore != null
                  ? `${Math.round(avgQualityScore)}/100`
                  : '—'
              }
              description="Across all generations"
              icon={<Star className="w-4 h-4" />}
            />
            <MetricsCard
              title="Tokens Used"
              value={formatNumber(totalTokensUsed)}
              description="Total tokens consumed"
              icon={<Zap className="w-4 h-4" />}
            />
          </>
        )}
      </div>

      {/* 3. Usage meter */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">AI Usage</h3>
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
              tierBadge.color,
            )}
          >
            {tierBadge.label}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Monthly generations</span>
          <span className="font-semibold text-foreground">
            {generationsUsed} / {generationsLimit}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              usagePct >= 90
                ? 'bg-destructive'
                : usagePct >= 70
                  ? 'bg-amber-500'
                  : 'bg-primary-500',
            )}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {100 - usagePct}% remaining this month
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 4. Quick Actions */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              {
                icon: <Sparkles className="w-4 h-4" />,
                label: 'Generate Content',
                desc: 'Create AI content in seconds',
                href: '/content',
                accent: true,
              },
              {
                icon: <Target className="w-4 h-4" />,
                label: 'Start a Campaign',
                desc: 'Plan multi-platform content',
                href: '/campaigns',
              },
              {
                icon: <CalendarDays className="w-4 h-4" />,
                label: 'Content Calendar',
                desc: 'Schedule and organise posts',
                href: '/calendar',
              },
              {
                icon: <Palette className="w-4 h-4" />,
                label: 'Brand Profile',
                desc: 'Update your brand voice',
                href: '/brand',
              },
            ].map((action) => (
              <button
                key={action.href + action.label}
                onClick={() => router.push(action.href)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all group',
                  action.accent
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'hover:bg-muted',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    action.accent
                      ? 'bg-white/20'
                      : 'bg-muted group-hover:bg-background',
                  )}
                >
                  <span
                    className={
                      action.accent
                        ? 'text-white'
                        : 'text-muted-foreground group-hover:text-primary'
                    }
                  >
                    {action.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      action.accent ? 'text-white' : 'text-foreground',
                    )}
                  >
                    {action.label}
                  </p>
                  <p
                    className={cn(
                      'text-xs',
                      action.accent ? 'text-white/70' : 'text-muted-foreground',
                    )}
                  >
                    {action.desc}
                  </p>
                </div>
                <ArrowRight
                  className={cn(
                    'w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity',
                    action.accent ? 'text-white' : 'text-muted-foreground',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* 5. Recent Content */}
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Content</h3>
            <button
              onClick={() => router.push('/content')}
              className="text-xs text-primary hover:underline font-medium"
            >
              View all
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <ContentRowSkeleton key={i} />
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-8 h-8" />}
              title="No content yet"
              description="Generate your first AI-powered post to get started."
              action={{
                label: 'Generate now',
                onClick: () => router.push('/content'),
              }}
            />
          ) : (
            <div className="space-y-1">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
                  onClick={() => router.push('/content')}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">
                    {getPlatformIcon(item.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {truncate(item.input_topic, 60)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {truncate(item.generated_content, 80)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        getPlatformColor(item.platform),
                      )}
                    >
                      {getPlatformLabel(item.platform)}
                    </span>
                    {item.quality_score != null && (
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          getQualityColor(item.quality_score),
                        )}
                      >
                        {item.quality_score}/100
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Active Campaigns mini-list */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Active Campaigns</h3>
          <button
            onClick={() => router.push('/campaigns')}
            className="text-xs text-primary hover:underline font-medium"
          >
            View all
          </button>
        </div>

        {activeCampaigns.length === 0 ? (
          <EmptyState
            icon={<BarChart2 className="w-8 h-8" />}
            title="No active campaigns"
            description="Create a campaign to plan and track multi-platform content."
            action={{
              label: 'New campaign',
              onClick: () => router.push('/campaigns'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {activeCampaigns.slice(0, 3).map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push('/campaigns')}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {campaign.name}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium flex-shrink-0 capitalize">
                      {campaign.status}
                    </span>
                  </div>
                  {campaign.platforms && campaign.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {campaign.platforms.map((platform) => (
                        <span
                          key={platform}
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded font-medium',
                            getPlatformColor(platform),
                          )}
                        >
                          {getPlatformLabel(platform)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
