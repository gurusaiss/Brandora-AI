'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, accessToken } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated && !accessToken) {
      router.replace('/login')
    }
  }, [isAuthenticated, accessToken, router])

  if (!isAuthenticated && !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Find current page title
  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(([key]) => pathname.startsWith(key) && key !== '/')?.[1] ||
    'Brandora AI'

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content — offset for sidebar */}
      <div
        className={cn(
          'transition-all duration-300 lg:pl-64',
          // When sidebar is collapsed this doesn't update dynamically — acceptable
        )}
      >
        <Header
          title={title}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  )
}
