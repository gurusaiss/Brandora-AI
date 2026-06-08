'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi, organizationApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

// ── Spinner shown while Suspense is resolving ─────────────────────────────────
function CallbackSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5">
      <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <div className="flex items-center gap-2.5 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
        Signing you in with Facebook…
      </div>
      <p className="text-xs text-muted-foreground/60">You'll be redirected automatically</p>
    </div>
  )
}

// ── Inner component — reads searchParams, must be inside <Suspense> ───────────
function CallbackHandler() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { setUser, setOrganization, setAccessToken } = useAuthStore()

  useEffect(() => {
    const accessToken  = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const isNew        = searchParams.get('is_new') === '1'

    if (!accessToken) {
      router.replace('/login')
      return
    }

    localStorage.setItem('access_token', accessToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    setAccessToken(accessToken)

    Promise.all([authApi.me(), organizationApi.me()])
      .then(([userRes, orgRes]) => {
        setUser(userRes.data)
        setOrganization(orgRes.data)
        const firstName = (userRes.data?.full_name ?? 'there').split(' ')[0]
        toast.success(
          isNew
            ? `Welcome to Brandora AI, ${firstName}! 🎉`
            : `Welcome back, ${firstName}!`,
        )
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

  return <CallbackSpinner />
}

// ── Page — wraps handler in Suspense so Next.js can prerender the fallback ────
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackSpinner />}>
      <CallbackHandler />
    </Suspense>
  )
}
