'use client'

import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Target,
  CalendarDays,
  Zap,
  BookOpen,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { MetricsCard } from '@/components/dashboard/metrics-card'
import { useAuthStore } from '@/store/auth-store'
import { useContentHistory } from '@/hooks/use-content'
import {
  getPlatformLabel,
  getPlatformColor,
  getPlatformIcon,
  formatRelativeTime,
  truncate,
  cn,
} from '@/lib/utils'
import { ContentRowSkeleton } from '@/components/shared/loading-spinner'
import { EmptyState } from '@/components/shared/empty-state'

const UPCOMING_DAYS = [
  {
    date: 'May 28',
    name: 'Menstrual Hygiene Day',
    daysAway: 2,
    hashtags: ['#MHDay2026', '#MenstrualHygieneDay'],
  },
  {
    date: 'Jun 5',
    name: 'World Environment Day',
    daysAway: 10,
    hashtags: ['#WorldEnvironmentDay', '#ForNature'],
  },
  {
    date: 'Jun 15',
    name: 'World Elder Abuse Awareness Day',
    daysAway: 20,
    hashtags: ['#WEAAD', '#ElderCare'],
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { data: historyData, isLoading: historyLoading } = useContentHistory({
    page: 1,
    page_size: 5,
  })

  const firstName = user?.full_name?.split(' ')[0] || 'there'
  const usagePct = organization
    ? Math.round(
        (organization.ai_generations_used / organization.ai_generations_limit) *
          100,
      )
    : 0

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Good morning, {firstName} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            {organization?.name} — ready to create impactful content?
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

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Generations"
          value={organization?.ai_generations_used ?? 0}
          change={{ value: 12, positive: true }}
          icon={<Sparkles className="w-4 h-4" />}
          gradient
        />
        <MetricsCard
          title="Saved Content"
          value={historyData?.items?.filter((i) => i.is_saved).length ?? 0}
          description="Pieces saved for reuse"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <MetricsCard
          title="Active Campaigns"
          value={0}
          description="No active campaigns yet"
          icon={<Target className="w-4 h-4" />}
        />
        <MetricsCard
          title="This Week"
          value={Math.floor((organization?.ai_generations_used ?? 0) * 0.3)}
          change={{ value: 8, positive: true }}
          icon={<Zap className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              {
                icon: <Sparkles className="w-4 h-4" />,
                label: 'Generate LinkedIn Post',
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
                label: 'View Content Calendar',
                desc: 'Schedule & organize posts',
                href: '/calendar',
              },
              {
                icon: <BookOpen className="w-4 h-4" />,
                label: 'Upcoming Awareness Days',
                desc: 'Never miss an impact moment',
                href: '/calendar',
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
                      action.accent
                        ? 'text-white/70'
                        : 'text-muted-foreground',
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

        {/* Recent Content */}
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
          ) : !historyData?.items?.length ? (
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
              {historyData.items.slice(0, 5).map((item) => (
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

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Upcoming awareness days */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              Upcoming Awareness Days
            </h3>
            <button
              onClick={() => router.push('/calendar')}
              className="text-xs text-primary hover:underline font-medium"
            >
              Full calendar
            </button>
          </div>
          <div className="space-y-3">
            {UPCOMING_DAYS.map((day) => (
              <div
                key={day.name}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => router.push('/content')}
              >
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs text-primary-600 dark:text-primary-400 font-bold leading-none">
                    {day.date.split(' ')[0]}
                  </span>
                  <span className="text-xs text-primary-500 dark:text-primary-400 leading-none">
                    {day.date.split(' ')[1]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{day.name}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {day.hashtags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {day.daysAway}d away
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Usage */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground mb-4">AI Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Monthly generations
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {organization?.ai_generations_used ?? 0} /{' '}
                  {organization?.ai_generations_limit ?? 50}
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
                  style={{ width: `${Math.min(usagePct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {100 - usagePct}% remaining this month
              </p>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-1">
                Current plan:{' '}
                <span className="capitalize">
                  {organization?.subscription_tier || 'Free'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Upgrade to generate unlimited content, access advanced AI models,
                and unlock team collaboration.
              </p>
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-primary-600 to-accent text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                <Zap className="w-3.5 h-3.5" />
                Upgrade plan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
