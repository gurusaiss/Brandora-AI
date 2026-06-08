'use client'

/**
 * /auth/callback
 *
 * Landing page after Facebook OAuth completes.
 * The backend redirects here with:
 *   ?access_token=…&refresh_token=…&is_new=0|1
 * or on error:
 *   /login?fb_error=…  (backend redirects directly to /login on error)
 *
 * This page:
 *  1. Stores the tokens
 *  2. Fetches user + org data
 *  3. Sets auth store
 *  4. Redirects → /onboarding (new user) or /content (existing user)
 */

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi, organizationApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

export default function AuthCallbackPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { setUser, setOrganization, setAccessToken } = useAuthStore()

  useEffect(() => {
    const accessToken  = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const isNew        = searchParams.get('is_new') === '1'

    if (!accessToken) {
      // No token — backend already redirected errors to /login?fb_error=…
      router.replace('/login')
      return
    }

    // 1 — Store tokens immediately so API interceptor picks them up
    localStorage.setItem('access_token', accessToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    setAccessToken(accessToken)

    // 2 — Fetch user + org in parallel
    Promise.all([authApi.me(), organizationApi.me()])
      .then(([userRes, orgRes]) => {
        const user = userRes.data
        const org  = orgRes.data
        setUser(user)
        setOrganization(org)

        const firstName = (user?.full_name ?? 'there').split(' ')[0]
        toast.success(
          isNew
            ? `Welcome to Brandora AI, ${firstName}! 🎉`
            : `Welcome back, ${firstName}!`,
        )

        // New users → onboarding; existing users → dashboard
        router.replace(isNew ? '/onboarding' : '/content')
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        toast.error('Failed to load your account. Please try again.')
        router.replace('/login')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5">
      {/* Logo */}
      <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
        <Sparkles className="w-6 h-6 text-white" />
      </div>

      {/* Spinner + message */}
      <div className="flex items-center gap-2.5 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
        Signing you in with Facebook…
      </div>

      <p className="text-xs text-muted-foreground/60">
        You'll be redirected automatically
      </p>
    </div>
  )
}
