'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  getDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { cn, getPlatformColor, getPlatformIcon } from '@/lib/utils'
import type { Platform } from '@/types'

// Mock scheduled posts
const MOCK_POSTS: Array<{
  id: string
  date: string
  platform: Platform
  title: string
}> = [
  { id: '1', date: format(new Date(), 'yyyy-MM-dd'), platform: 'linkedin', title: 'MH Day awareness post' },
  { id: '2', date: format(addMonths(new Date(), 0), 'yyyy-MM') + '-' + String(new Date().getDate() + 2).padStart(2, '0'), platform: 'instagram', title: 'Impact story reel' },
  { id: '3', date: format(addMonths(new Date(), 0), 'yyyy-MM') + '-' + String(new Date().getDate() + 5).padStart(2, '0'), platform: 'twitter', title: 'CSR milestone tweet' },
]

// UN Awareness days (sample)
const AWARENESS_DAYS: Array<{ date: string; name: string }> = [
  { date: '2026-05-28', name: 'Menstrual Hygiene Day' },
  { date: '2026-06-05', name: 'World Environment Day' },
  { date: '2026-06-15', name: 'Elder Abuse Awareness Day' },
  { date: '2026-07-11', name: 'World Population Day' },
  { date: '2026-08-06', name: 'World Breastfeeding Week' },
]

const PLATFORM_LEGEND: Array<{ platform: Platform; label: string }> = [
  { platform: 'linkedin', label: 'LinkedIn' },
  { platform: 'instagram', label: 'Instagram' },
  { platform: 'twitter', label: 'Twitter' },
  { platform: 'reel_script', label: 'Reel' },
  { platform: 'carousel', label: 'Carousel' },
]

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getPostsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return MOCK_POSTS.filter((p) => p.date === dateStr)
  }

  const getAwarenessDayForDate = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return AWARENESS_DAYS.find((a) => a.date === dateStr)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Content Calendar</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Plan and visualize your social media content schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl">
            {(['month', 'week'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  'h-8 px-3 text-sm font-medium rounded-lg capitalize transition-colors',
                  viewMode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 h-9 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" />
            Add Post
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Calendar navigation */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-foreground text-lg">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div
              key={d}
              className="py-3 text-center text-xs font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const posts = getPostsForDay(day)
            const awarenessDay = getAwarenessDayForDate(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] p-2 border-b border-r border-border relative',
                  !isCurrentMonth && 'bg-muted/20',
                  i % 7 === 6 && 'border-r-0',
                  awarenessDay && 'bg-primary-50/30 dark:bg-primary-900/10',
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium',
                      isDayToday
                        ? 'bg-primary-600 text-white'
                        : isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {isCurrentMonth && (
                    <button className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted rounded-md opacity-0 hover:opacity-100 group-hover:opacity-100 transition-all">
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Awareness day indicator */}
                {awarenessDay && (
                  <div className="text-xs text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 rounded px-1 py-0.5 mb-1 truncate font-medium">
                    {awarenessDay.name}
                  </div>
                )}

                {/* Scheduled posts */}
                <div className="space-y-1">
                  {posts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity',
                        getPlatformColor(post.platform),
                      )}
                      title={post.title}
                    >
                      {getPlatformIcon(post.platform)} {post.title}
                    </div>
                  ))}
                  {posts.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{posts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 bg-card border border-border rounded-xl px-5 py-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Legend:
          </span>
        </div>
        {PLATFORM_LEGEND.map(({ platform, label }) => (
          <div key={platform} className="flex items-center gap-1.5">
            <span className="text-sm">{getPlatformIcon(platform)}</span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                getPlatformColor(platform),
              )}
            >
              {label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-3 h-3 rounded bg-primary-100 dark:bg-primary-900/30 border border-primary-300" />
          <span className="text-xs text-muted-foreground">Awareness Day</span>
        </div>
      </div>
    </div>
  )
}
