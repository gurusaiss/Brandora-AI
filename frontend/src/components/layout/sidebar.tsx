'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  Target,
  CalendarDays,
  BarChart3,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content Studio', icon: Sparkles, highlight: true },
  { href: '/campaigns', label: 'Campaigns', icon: Target },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/hashtags', label: 'Hashtags', icon: Hash },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/brand', label: 'Brand Profile', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { user, organization } = useAuthStore()

  const usagePct = organization
    ? Math.round(
        (organization.ai_generations_used / organization.ai_generations_limit) *
          100,
      )
    : 0

  const avatarInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'B'

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          // Mobile: slide in/out
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center border-b border-border h-16 px-4',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-foreground tracking-tight truncate">
                Brandora AI
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'hidden lg:flex w-6 h-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
              collapsed && 'hidden',
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="hidden lg:flex mx-auto mt-2 w-6 h-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                  isActive
                    ? item.highlight
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary/30'
                      : 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && 'justify-center px-2',
                )}
              >
                <Icon
                  className={cn(
                    'flex-shrink-0',
                    collapsed ? 'w-5 h-5' : 'w-4 h-4',
                    isActive && item.highlight && 'text-white',
                  )}
                />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {item.highlight && !isActive && !collapsed && (
                  <span className="ml-auto text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-1.5 py-0.5 rounded-md font-medium">
                    AI
                  </span>
                )}
                {/* Tooltip for collapsed */}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border text-foreground text-xs rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* AI Usage meter */}
        {!collapsed && organization && (
          <div className="px-4 py-3 mx-3 mb-3 bg-muted/50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  AI Credits
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {organization.ai_generations_used} /{' '}
                {organization.ai_generations_limit}
              </span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
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
            {usagePct >= 80 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {usagePct >= 90 ? 'Running low! ' : 'Almost there! '}
                <Link href="/settings/billing" className="text-primary hover:underline">
                  Upgrade
                </Link>
              </p>
            )}
          </div>
        )}

        {/* User profile */}
        <div
          className={cn(
            'border-t border-border p-4 flex items-center gap-3',
            collapsed && 'justify-center px-2',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {avatarInitials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || ''}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
