'use client'

import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { Sparkles, Bookmark, Star, Zap, BarChart3 } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import { MetricsCard } from '@/components/dashboard/metrics-card'
import { EmptyState } from '@/components/shared/empty-state'
import { MetricCardSkeleton } from '@/components/shared/loading-spinner'
import {
  cn,
  getPlatformLabel,
  getPlatformColor,
  formatNumber,
  truncate,
} from '@/lib/utils'
import type { AnalyticsOverview } from '@/types'

const MOCK_PLATFORM_DATA = [
  { platform: 'LinkedIn', count: 45 },
  { platform: 'Instagram', count: 32 },
  { platform: 'Twitter', count: 28 },
  { platform: 'Reel Script', count: 15 },
  { platform: 'Carousel', count: 12 },
  { platform: 'CSR Story', count: 8 },
  { platform: 'Founder Post', count: 20 },
]

const MOCK_DAILY = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  }),
  generations: Math.floor(Math.random() * 15) + 1,
}))

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const res = await analyticsApi.overview()
      return res.data as AnalyticsOverview
    },
    retry: false,
  })

  const metrics = [
    {
      title: 'Total Generated',
      value: formatNumber(overview?.total_generations ?? 0),
      change: { value: overview?.generations_change_pct ?? 12, positive: true },
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      title: 'Saved Content',
      value: formatNumber(overview?.saved_content ?? 0),
      description: 'Saved for reuse',
      icon: <Bookmark className="w-4 h-4" />,
    },
    {
      title: 'Avg Quality Score',
      value: overview?.avg_quality_score
        ? `${overview.avg_quality_score}/100`
        : '—',
      description: 'Across all generations',
      icon: <Star className="w-4 h-4" />,
    },
    {
      title: 'AI Tokens Used',
      value: formatNumber(overview?.total_tokens_used ?? 0),
      description: 'This billing period',
      icon: <Zap className="w-4 h-4" />,
    },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-foreground">Analytics</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Track your content generation activity and performance
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading
          ? [...Array(4)].map((_, i) => <MetricCardSkeleton key={i} />)
          : metrics.map((m) => (
              <MetricsCard key={m.title} {...m} />
            ))}
      </div>

      {!isLoading && !overview ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8" />}
          title="No analytics yet"
          description="Start generating content to see your analytics here."
          className="bg-card border border-border rounded-2xl"
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Platform breakdown bar chart */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-5">
              Content by Platform
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={
                  overview?.platform_breakdown
                    ? Object.entries(overview.platform_breakdown).map(
                        ([k, v]) => ({
                          platform: getPlatformLabel(k as never),
                          count: v,
                        }),
                      )
                    : MOCK_PLATFORM_DATA
                }
                margin={{ left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="platform"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity over time line chart */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-5">
              Activity (Last 30 Days)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={overview?.daily_activity ?? MOCK_DAILY}
                margin={{ left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  interval={6}
                />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Generations"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top content table (mock) */}
      {!isLoading && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground mb-4">
            Top Content by Quality Score
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground pb-3">
                    Topic
                  </th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground pb-3">
                    Platform
                  </th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground pb-3">
                    Quality
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { topic: 'World Menstrual Hygiene Day — impact post', platform: 'linkedin', score: 92 },
                  { topic: 'Clean water initiative — 10,000 families reached', platform: 'instagram', score: 88 },
                  { topic: 'CSR report 2025 highlights', platform: 'csr_story', score: 85 },
                  { topic: 'Breaking taboos around menstrual health', platform: 'twitter', score: 80 },
                  { topic: 'Founder journey — 5 years of impact', platform: 'founder_post', score: 78 },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="text-foreground">
                        {truncate(row.topic, 50)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          getPlatformColor(row.platform),
                        )}
                      >
                        {getPlatformLabel(row.platform as never)}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          row.score >= 75
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                        )}
                      >
                        {row.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
