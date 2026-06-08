'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/shared/error-boundary'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/content': 'Content Studio',
  '/campaigns': 'Campaigns',
  '/calendar': 'Content Calendar',
  '/analytics': 'Analytics',
  '/brand': 'Brand Profile',
  '/settings': 'Settings',
  '/onboarding': 'Getting Started',
}

// ── Full-page spinner used while Zustand rehydrates from localStorage ─────────
function HydrationSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, accessToken, _hasHydrated } = useAuthStore()
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect AFTER Zustand has read from localStorage.
    // Without this guard, Next.js SSR renders with isAuthenticated=false
    // and immediately redirects even though the user has a stored token.
    if (!_hasHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.replace('/login')
    }
  }, [_hasHydrated, isAuthenticated, accessToken, router])

  // Show spinner while localStorage is being read (usually < 50 ms)
  if (!_hasHydrated) return <HydrationSpinner />

  // After hydration — genuinely not authenticated
  if (!isAuthenticated || !accessToken) return <HydrationSpinner />

  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(
      ([key]) => pathname.startsWith(key) && key !== '/',
    )?.[1] ||
    'Brandora AI'

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className={cn('transition-all duration-300 lg:pl-64')}>
        <Header title={title} onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
