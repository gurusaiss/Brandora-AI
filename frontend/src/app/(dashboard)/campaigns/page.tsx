'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Target, Calendar, Pencil, Trash2, Loader2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { campaignApi } from '@/lib/api'
import { EmptyState } from '@/components/shared/empty-state'
import { cn, formatDate, getPlatformIcon, getPlatformLabel } from '@/lib/utils'
import type { Campaign, Platform } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'draft', 'active', 'completed'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const STATUS_LABELS: Record<StatusTab, string> = {
  all: 'All',
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
}

const STATUS_COLORS: Record<Campaign['status'], string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

const CAMPAIGN_TYPES = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'event', label: 'Event' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'csr_report', label: 'CSR Report' },
] as const

const ALL_PLATFORMS: Platform[] = [
  'linkedin',
  'instagram',
  'twitter',
  'reel_script',
  'carousel',
  'csr_story',
  'founder_post',
]

// ─── Form shape ───────────────────────────────────────────────────────────────

interface CampaignForm {
  name: string
  description: string
  campaign_type: string
  start_date: string
  end_date: string
  platforms: Platform[]
}

const EMPTY_FORM: CampaignForm = {
  name: '',
  description: '',
  campaign_type: 'awareness',
  start_date: '',
  end_date: '',
  platforms: [],
}

function formFromCampaign(c: Campaign): CampaignForm {
  return {
    name: c.name,
    description: c.description ?? '',
    campaign_type: c.campaign_type,
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? '',
    platforms: c.platforms,
  }
}

// ─── Platform checkbox list ───────────────────────────────────────────────────

function PlatformCheckboxes({
  value,
  onChange,
}: {
  value: Platform[]
  onChange: (v: Platform[]) => void
}) {
  const toggle = (p: Platform) => {
    if (value.includes(p)) {
      onChange(value.filter((x) => x !== p))
    } else {
      onChange([...value, p])
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {ALL_PLATFORMS.map((p) => {
        const checked = value.includes(p)
        return (
          <label
            key={p}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors select-none',
              checked
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary-400',
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() => toggle(p)}
            />
            <span>{getPlatformIcon(p)}</span>
            <span className="truncate">{getPlatformLabel(p)}</span>
            {checked && <Check className="w-3.5 h-3.5 ml-auto text-primary-600 flex-shrink-0" />}
          </label>
        )
      })}
    </div>
  )
}

// ─── Shared form fields ───────────────────────────────────────────────────────

function CampaignFormFields({
  form,
  setForm,
}: {
  form: CampaignForm
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>
}) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Campaign name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Menstrual Hygiene Day 2026"
          autoFocus
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Description{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Campaign goals, target audience..."
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Campaign type */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Campaign type
        </label>
        <select
          value={form.campaign_type}
          onChange={(e) => setForm((f) => ({ ...f, campaign_type: e.target.value }))}
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {CAMPAIGN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            Start date
          </label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">
            End date
          </label>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Platforms */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Platforms
        </label>
        <PlatformCheckboxes
          value={form.platforms}
          onChange={(platforms) => setForm((f) => ({ ...f, platforms }))}
        />
      </div>
    </div>
  )
}

// ─── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  deleteConfirmId,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  isDeleting,
}: {
  campaign: Campaign
  deleteConfirmId: string | null
  onEdit: (c: Campaign) => void
  onDeleteRequest: (id: string) => void
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
  isDeleting: boolean
}) {
  const progressPct =
    campaign.total_posts > 0
      ? Math.round((campaign.published_posts / campaign.total_posts) * 100)
      : 0
  const isConfirming = deleteConfirmId === campaign.id

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
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

      {/* Platform chips */}
      {campaign.platforms.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5">
          {campaign.platforms.slice(0, 5).map((p) => (
            <span
              key={p}
              title={getPlatformLabel(p)}
              className="text-sm bg-muted rounded-lg px-2 py-0.5 text-muted-foreground"
            >
              {getPlatformIcon(p)} {getPlatformLabel(p)}
            </span>
          ))}
          {campaign.platforms.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{campaign.platforms.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span>
          {campaign.start_date ? formatDate(campaign.start_date) : 'No start date'}
        </span>
        {campaign.end_date && (
          <span>— {formatDate(campaign.end_date)}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
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

      {/* Actions / Delete confirm */}
      {isConfirming ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-destructive font-medium flex-1">
            Delete this campaign?
          </span>
          <button
            onClick={() => onDeleteConfirm(campaign.id)}
            disabled={isDeleting}
            className="h-7 px-3 text-xs font-semibold bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
          >
            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Delete
          </button>
          <button
            onClick={onDeleteCancel}
            className="h-7 px-3 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1 pt-1">
          <button
            onClick={() => onEdit(campaign)}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Edit campaign"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteRequest(campaign.id)}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
            title="Delete campaign"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg bg-card border border-border rounded-2xl shadow-xl z-50 flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

function CreateModal({
  onClose,
  form,
  setForm,
  onSubmit,
  isPending,
}: {
  onClose: () => void
  form: CampaignForm
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>
  onSubmit: () => void
  isPending: boolean
}) {
  return (
    <ModalShell title="New Campaign" onClose={onClose}>
      <div className="overflow-y-auto px-6 py-4 flex-1">
        <CampaignFormFields form={form} setForm={setForm} />
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!form.name.trim() || isPending}
          className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Campaign
        </button>
      </div>
    </ModalShell>
  )
}

function EditModal({
  onClose,
  form,
  setForm,
  onSubmit,
  isPending,
}: {
  onClose: () => void
  form: CampaignForm
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>
  onSubmit: () => void
  isPending: boolean
}) {
  return (
    <ModalShell title="Edit Campaign" onClose={onClose}>
      <div className="overflow-y-auto px-6 py-4 flex-1">
        <CampaignFormFields form={form} setForm={setForm} />
      </div>
      <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!form.name.trim() || isPending}
          className="flex-1 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const queryClient = useQueryClient()

  // Modal / selection state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all')

  // Form state
  const [createForm, setCreateForm] = useState<CampaignForm>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<CampaignForm>(EMPTY_FORM)

  // ── Query ────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await campaignApi.list()
      return res.data as { items: Campaign[]; total: number }
    },
  })

  const campaigns = data?.items ?? []
  const filtered =
    statusFilter === 'all'
      ? campaigns
      : campaigns.filter((c) => c.status === statusFilter)

  // ── Create mutation ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      campaignApi.create({
        name: createForm.name,
        description: createForm.description,
        campaign_type: createForm.campaign_type,
        start_date: createForm.start_date || undefined,
        end_date: createForm.end_date || undefined,
        platforms: createForm.platforms,
        status: 'draft',
      }),
    onSuccess: () => {
      setShowCreateModal(false)
      setCreateForm(EMPTY_FORM)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign created!')
    },
    onError: () => {
      toast.error('Failed to create campaign')
    },
  })

  // ── Update mutation ───────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedCampaign) throw new Error('No campaign selected')
      return campaignApi.update(selectedCampaign.id, {
        name: editForm.name,
        description: editForm.description,
        campaign_type: editForm.campaign_type,
        start_date: editForm.start_date || undefined,
        end_date: editForm.end_date || undefined,
        platforms: editForm.platforms,
      })
    },
    onSuccess: () => {
      setShowEditModal(false)
      setSelectedCampaign(null)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign updated!')
    },
    onError: () => {
      toast.error('Failed to update campaign')
    },
  })

  // ── Delete mutation ───────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => campaignApi.delete(id),
    onSuccess: () => {
      setDeleteConfirmId(null)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign deleted')
    },
    onError: () => {
      toast.error('Failed to delete campaign')
    },
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setCreateForm(EMPTY_FORM)
    setShowCreateModal(true)
  }

  const openEditModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setEditForm(formFromCampaign(campaign))
    setShowEditModal(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Plan and manage multi-platform content campaigns
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 h-10 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              'h-8 px-3 text-sm font-medium rounded-lg transition-colors capitalize',
              statusFilter === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-56 bg-card border border-border rounded-2xl shimmer-bg"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Target className="w-8 h-8" />}
          title={
            statusFilter === 'all'
              ? 'No campaigns yet'
              : `No ${statusFilter} campaigns`
          }
          description={
            statusFilter === 'all'
              ? 'Create your first campaign to plan multi-platform content at scale.'
              : `You don't have any ${statusFilter} campaigns.`
          }
          action={
            statusFilter === 'all'
              ? { label: 'Create campaign', onClick: openCreateModal }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              deleteConfirmId={deleteConfirmId}
              onEdit={openEditModal}
              onDeleteRequest={(id) => setDeleteConfirmId(id)}
              onDeleteConfirm={(id) => deleteMutation.mutate(id)}
              onDeleteCancel={() => setDeleteConfirmId(null)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          form={createForm}
          setForm={setCreateForm}
          onSubmit={() => createMutation.mutate()}
          isPending={createMutation.isPending}
        />
      )}

      {/* Edit modal */}
      {showEditModal && selectedCampaign && (
        <EditModal
          onClose={() => {
            setShowEditModal(false)
            setSelectedCampaign(null)
          }}
          form={editForm}
          setForm={setEditForm}
          onSubmit={() => updateMutation.mutate()}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  )
}
