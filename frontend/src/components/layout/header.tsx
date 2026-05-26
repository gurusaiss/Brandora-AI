'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Search,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Zap,
  Menu,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import { useLogout } from '@/hooks/use-auth'
import { getSubscriptionBadge } from '@/lib/utils'

interface HeaderProps {
  title?: string
  onMenuClick?: () => void
}

export function Header({ title = 'Dashboard', onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { user, organization } = useAuthStore()
  const logout = useLogout()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const avatarInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  const badge = organization
    ? getSubscriptionBadge(organization.subscription_tier)
    : null

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 sm:px-6 gap-4">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <h1 className="font-semibold text-foreground text-lg hidden sm:block">
        {title}
      </h1>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search content, campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-muted border border-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Upgrade badge (free tier) */}
        {organization?.subscription_tier === 'free' && (
          <button
            onClick={() => router.push('/settings')}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 bg-gradient-to-r from-primary-500 to-accent text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <Zap className="w-3 h-3" />
            Upgrade
          </button>
        )}

        {/* Plan badge */}
        {badge && organization?.subscription_tier !== 'free' && (
          <span
            className={cn(
              'hidden sm:inline-flex text-xs font-medium px-2 py-1 rounded-lg',
              badge.color,
            )}
          >
            {badge.label}
          </span>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>

        {/* User avatar dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 h-9 px-2 rounded-xl hover:bg-muted transition-colors group">
              <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold">
                {avatarInitials}
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
                {user?.full_name?.split(' ')[0] || 'User'}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] bg-popover border border-border rounded-xl shadow-lg p-1.5 animate-fade-in"
              sideOffset={8}
              align="end"
            >
              {/* User info */}
              <div className="px-3 py-2 mb-1">
                <p className="text-sm font-medium text-foreground">
                  {user?.full_name}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>

              <DropdownMenu.Separator className="h-px bg-border my-1" />

              <DropdownMenu.Item asChild>
                <button
                  onClick={() => router.push('/profile')}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  Profile
                </button>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <button
                  onClick={() => router.push('/settings')}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Settings
                </button>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-border my-1" />

              <DropdownMenu.Item asChild>
                <button
                  onClick={logout}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
