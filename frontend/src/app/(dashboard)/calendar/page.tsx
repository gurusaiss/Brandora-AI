'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { scheduleApi, festivalApi } from '@/lib/api'
import { cn, getPlatformColor, getPlatformIcon } from '@/lib/utils'
import type { Platform, Festival } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduledPost {
  id: string
  platform: Platform
  content: string
  scheduled_at: string
  hashtags?: string[]
}

// ─── Calendar Utilities ──────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0=Sun, 1=Mon, ... 6=Sat
  return new Date(year, month - 1, 1).getDay()
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PLATFORM_OPTIONS: Platform[] = [
  'linkedin', 'instagram', 'twitter', 'reel_script', 'carousel', 'csr_story', 'founder_post',
]

const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  reel_script: 'Reel Script',
  carousel: 'Carousel',
  csr_story: 'CSR Story',
  founder_post: 'Founder Post',
}

// ─── Modal Component ─────────────────────────────────────────────────────────

interface PostModalProps {
  title: string
  form: {
    platform: string
    content: string
    scheduled_at: string
    hashtags: string
  }
  onChange: (field: string, value: string) => void
  onSubmit: () => void
  onClose: () => void
  isLoading: boolean
}

function PostModal({ title, form, onChange, onSubmit, onClose, isLoading }: PostModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => onChange('platform', e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => onChange('content', e.target.value)}
              rows={4}
              placeholder="Write your post content..."
              className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Schedule Date & Time</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => onChange('scheduled_at', e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hashtags</label>
            <input
              type="text"
              value={form.hashtags}
              onChange={(e) => onChange('hashtags', e.target.value)}
              placeholder="#ngo, #csr, #impactdriven"
              className="w-full h-9 px-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated hashtags</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isLoading || !form.content.trim() || !form.scheduled_at}
            className="flex-1 h-9 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const queryClient = useQueryClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null)
  const [addForm, setAddForm] = useState({
    platform: 'linkedin',
    content: '',
    scheduled_at: '',
    hashtags: '',
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────
  const todayStr = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: postsData = [] } = useQuery<ScheduledPost[]>({
    queryKey: ['schedule', currentYear, currentMonth],
    queryFn: async () => {
      const res = await scheduleApi.list({ year: currentYear, month: currentMonth })
      return (res.data?.items ?? res.data ?? []) as ScheduledPost[]
    },
    staleTime: 30 * 1000,
  })

  const { data: festivalsData = [] } = useQuery<Festival[]>({
    queryKey: ['festivals', 'upcoming'],
    queryFn: async () => {
      const res = await festivalApi.upcoming(30)
      return (res.data?.items ?? res.data ?? []) as Festival[]
    },
    staleTime: 60 * 60 * 1000,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateSchedule = () =>
    queryClient.invalidateQueries({ queryKey: ['schedule', currentYear, currentMonth] })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => scheduleApi.create(data),
    onSuccess: () => {
      invalidateSchedule()
      toast.success('Post scheduled successfully')
      setShowAddModal(false)
      resetForm()
    },
    onError: () => toast.error('Failed to schedule post'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      scheduleApi.update(id, data),
    onSuccess: () => {
      invalidateSchedule()
      toast.success('Post updated')
      setEditingPost(null)
      resetForm()
    },
    onError: () => toast.error('Failed to update post'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => {
      invalidateSchedule()
      toast.success('Post deleted')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete post'),
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  function resetForm() {
    setAddForm({ platform: 'linkedin', content: '', scheduled_at: '', hashtags: '' })
  }

  function handleFormChange(field: string, value: string) {
    setAddForm((prev) => ({ ...prev, [field]: value }))
  }

  function buildPayload() {
    return {
      platform: addForm.platform,
      content: addForm.content,
      scheduled_at: addForm.scheduled_at,
      hashtags: addForm.hashtags
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
    }
  }

  function handleSubmitAdd() {
    createMutation.mutate(buildPayload())
  }

  function handleSubmitEdit() {
    if (!editingPost) return
    updateMutation.mutate({ id: editingPost.id, data: buildPayload() })
  }

  function openEdit(post: ScheduledPost) {
    setEditingPost(post)
    setAddForm({
      platform: post.platform,
      content: post.content,
      scheduled_at: post.scheduled_at
        ? post.scheduled_at.slice(0, 16)
        : '',
      hashtags: post.hashtags ? post.hashtags.join(', ') : '',
    })
  }

  function openAddForDate(dateStr: string) {
    resetForm()
    setAddForm((prev) => ({ ...prev, scheduled_at: dateStr + 'T09:00' }))
    setShowAddModal(true)
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
    setSelectedDate(null)
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
    setSelectedDate(null)
  }

  // ── Calendar Grid Data ─────────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth) // 0=Sun
  const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7

  function dateStrFor(day: number) {
    const m = String(currentMonth).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${currentYear}-${m}-${d}`
  }

  function postsForDay(day: number): ScheduledPost[] {
    const prefix = dateStrFor(day)
    return postsData.filter((p) => p.scheduled_at && p.scheduled_at.startsWith(prefix))
  }

  function festivalForDay(day: number): Festival | undefined {
    const dateStr = dateStrFor(day)
    return festivalsData.find((f) => f.date === dateStr)
  }

  // ── Selected date posts ────────────────────────────────────────────────────
  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return []
    return postsData.filter((p) => p.scheduled_at && p.scheduled_at.startsWith(selectedDate))
  }, [selectedDate, postsData])

  // ── Upcoming posts (no day selected) ──────────────────────────────────────
  const upcomingPosts = useMemo(() => {
    return [...postsData]
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, 10)
  }, [postsData])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Content Calendar</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Plan and visualize your social media content schedule
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 h-9 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Post
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Calendar ── */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-foreground text-lg">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="py-3 text-center text-xs font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - firstDayIndex + 1
              const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth

              if (!isCurrentMonth) {
                // Empty / overflow cell
                return (
                  <div
                    key={`empty-${idx}`}
                    className={cn(
                      'min-h-[100px] p-2 border-b border-r border-border bg-muted/20',
                      idx % 7 === 6 && 'border-r-0',
                    )}
                  />
                )
              }

              const dateStr = dateStrFor(dayNum)
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayPosts = postsForDay(dayNum)
              const festival = festivalForDay(dayNum)

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={cn(
                    'min-h-[100px] p-2 border-b border-r border-border cursor-pointer transition-colors',
                    idx % 7 === 6 && 'border-r-0',
                    festival && 'bg-orange-50/40 dark:bg-orange-900/10',
                    isSelected && 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-inset ring-primary-500',
                    !isSelected && !festival && 'hover:bg-muted/40',
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium',
                        isToday
                          ? 'bg-primary-600 text-white'
                          : 'text-foreground',
                      )}
                    >
                      {dayNum}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>

                  {/* Festival indicator */}
                  {festival && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 rounded px-1 py-0.5 mb-1 truncate font-medium">
                      {festival.name}
                    </div>
                  )}

                  {/* Post pills */}
                  <div className="space-y-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <div
                        key={post.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate',
                          getPlatformColor(post.platform),
                        )}
                        title={post.content}
                      >
                        {getPlatformIcon(post.platform)} {post.content.slice(0, 20)}
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayPosts.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {selectedDate ? (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground text-sm">
                  {selectedDate}
                </h4>
                <button
                  onClick={() => openAddForDate(selectedDate)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>

              {selectedDayPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No posts scheduled for this day.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayPosts.map((post) => (
                    <div
                      key={post.id}
                      className="border border-border rounded-xl p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            getPlatformColor(post.platform),
                          )}
                        >
                          {getPlatformIcon(post.platform)} {PLATFORM_LABELS[post.platform] ?? post.platform}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(post)}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeleteId(post.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-foreground line-clamp-2">{post.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.scheduled_at
                          ? new Date(post.scheduled_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => openAddForDate(selectedDate)}
                className="w-full flex items-center justify-center gap-2 h-9 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Schedule Post
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-foreground text-sm">Upcoming Posts</h4>
              </div>

              {upcomingPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming posts. Click a day or schedule a post.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingPosts.map((post) => (
                    <div key={post.id} className="border border-border rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded-full font-medium',
                            getPlatformColor(post.platform),
                          )}
                        >
                          {getPlatformIcon(post.platform)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {post.scheduled_at
                            ? new Date(post.scheduled_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs text-foreground line-clamp-2">{post.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Modal ── */}
      {showAddModal && (
        <PostModal
          title="Schedule New Post"
          form={addForm}
          onChange={handleFormChange}
          onSubmit={handleSubmitAdd}
          onClose={() => { setShowAddModal(false); resetForm() }}
          isLoading={createMutation.isPending}
        />
      )}

      {/* ── Edit Modal ── */}
      {editingPost && (
        <PostModal
          title="Edit Scheduled Post"
          form={addForm}
          onChange={handleFormChange}
          onSubmit={handleSubmitEdit}
          onClose={() => { setEditingPost(null); resetForm() }}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Delete Post?</h3>
            <p className="text-sm text-muted-foreground">
              This scheduled post will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 h-9 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 h-9 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
