'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from '@/types'

// ─── Login ────────────────────────────────────────────────────────────────────
export function useLogin() {
  const router = useRouter()
  const { setUser, setOrganization, setAccessToken, setLoading } =
    useAuthStore()

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      setLoading(true)
      const response = await authApi.login(data)
      return response.data as AuthResponse
    },
    onSuccess: (data) => {
      setLoading(false)
      setUser(data.user)
      setOrganization(data.organization)
      setAccessToken(data.access_token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', data.refresh_token)
      }
      toast.success(`Welcome back, ${data.user.full_name.split(' ')[0]}!`)
      router.push('/content')
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setLoading(false)
      const message =
        error?.response?.data?.detail || 'Invalid email or password'
      toast.error(message)
    },
  })
}

// ─── Register ─────────────────────────────────────────────────────────────────
export function useRegister() {
  const router = useRouter()
  const { setUser, setOrganization, setAccessToken, setLoading } =
    useAuthStore()

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      setLoading(true)
      const response = await authApi.register(data)
      return response.data as AuthResponse
    },
    onSuccess: (data) => {
      setLoading(false)
      setUser(data.user)
      setOrganization(data.organization)
      setAccessToken(data.access_token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', data.refresh_token)
      }
      toast.success('Account created! Let\'s set up your brand.')
      router.push('/onboarding')
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setLoading(false)
      const message =
        error?.response?.data?.detail || 'Registration failed. Try again.'
      toast.error(message)
    },
  })
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export function useLogout() {
  const router = useRouter()
  const { logout } = useAuthStore()

  return async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout API errors — clear local state regardless
    }
    logout()
    toast.success('Logged out successfully')
    router.push('/login')
  }
}

// ─── Current User ─────────────────────────────────────────────────────────────
export function useCurrentUser() {
  const { accessToken, setUser } = useAuthStore()

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await authApi.me()
      const user = response.data as User
      setUser(user)
      return user
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })
}
