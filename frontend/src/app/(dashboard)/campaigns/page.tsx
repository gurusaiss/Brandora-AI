'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Target,
  Calendar,
  BarChart2,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { campaignApi } from '@/lib/api'
import { EmptyState } from '@/components/shared/empty-state'
import { cn, formatDate, getPlatformIcon } from '@/lib/utils'
import type { Campaign } from '@/types'

const STATUS_TABS = ['All', 'Active', 'Draft', 'Completed', 'Archived'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const STATUS_COLORS: Record<Campaign['status'], string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const router = useRouter()
  const progressPct =
    campaign.total_posts > 0
      ? Math.round((campaign.published_posts / campaign.total_posts) * 100)
      : 0

  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 card-hover cursor-pointer"
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <h3 className="font-semibold text-foreground truncate">
            {campaign.name}
          </h3>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {campaign.description}
            </p>
          )}
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 capitalize',
            STATUS_COLORS[campaign.status],
          )}
        >
          {campaign.status}
        </span>
      </div>

      {/* Platform icons */}
      {campaign.platforms.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {campaign.platforms.slice(0, 5).map((p) => (
            <span key={p} title={p} className="text-base">
              {getPlatformIcon(p)}
            </span>
          ))}
          {campaign.platforms.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{campaign.platforms.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Posts published</span>
          <span className="font-medium text-foreground">
            {campaign.published_posts} / {campaign.total_posts}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {campaign.start_date
            ? formatDate(campaign.start_date)
            : 'No start date'}
          {campaign.end_date && (
            <span>→ {formatDate(campaign.end_date)}</span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<StatusTab>('All')
  const [showNewModal, setShowNewModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await campaignApi.list()
      return res.data as { items: Campaign[]; total: number }
    },
  })

  const campaigns = data?.items ?? []
  const filtered =
    activeTab === 'All'
      ? campaigns
      : campaigns.filter(
          (c) => c.status === activeTab.toLowerCase(),
        )

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Plan and manage multi-platform content campaigns
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 h-10 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'h-8 px-3 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Campaigns grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-card border border-border rounded-2xl shimmer-bg"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Target className="w-8 h-8" />}
          title={
            activeTab === 'All'
              ? 'No campaigns yet'
              : `No ${activeTab.toLowerCase()} campaigns`
          }
          description={
            activeTab === 'All'
              ? 'Create your first campaign to plan multi-platform content at scale.'
              : `You don't have any ${activeTab.toLowerCase()} campaigns.`
          }
          action={
            activeTab === 'All'
              ? {
                  label: 'Create campaign',
                  onClick: () => setShowNewModal(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {/* New Campaign Modal (simplified) */}
      {showNewModal && (
        <NewCampaignModal onClose={() => setShowNewModal(false)} />
      )}
    </div>
  )
}

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await campaignApi.create({ name, description, status: 'draft', platforms: [] })
      onClose()
    } catch {
      // Handle error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md bg-card border border-border rounded-2xl shadow-xl z-50 p-6">
        <h3 className="font-semibold text-foreground mb-4 text-lg">
          New Campaign
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Campaign name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Menstrual Hygiene Day 2026"
              autoFocus
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campaign goals, target audience..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isSubmitting}
            className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Create Campaign
          </button>
        </div>
      </div>
    </>
  )
}
