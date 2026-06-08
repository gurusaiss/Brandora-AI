import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Organization } from '@/types'

interface AuthState {
  user: User | null
  organization: Organization | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean

  // ── Hydration flag ─────────────────────────────────────────────────────────
  // False until Zustand has finished reading from localStorage.
  // The auth guard in LayoutShell must wait for this before redirecting.
  _hasHydrated: boolean
  setHasHydrated: (value: boolean) => void

  setUser: (user: User | null) => void
  setOrganization: (org: Organization | null) => void
  setAccessToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  setAuthenticated: (authenticated: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organization: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setUser: (user) => set({ user }),
      setOrganization: (organization) => set({ organization }),
      setAccessToken: (accessToken) => {
        set({ accessToken, isAuthenticated: !!accessToken })
        if (typeof window !== 'undefined') {
          if (accessToken) {
            localStorage.setItem('access_token', accessToken)
          } else {
            localStorage.removeItem('access_token')
          }
        }
      },
      setLoading: (isLoading) => set({ isLoading }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
        set({
          user: null,
          organization: null,
          accessToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'brandora-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated,
      }),
      // Called as soon as Zustand finishes reading from localStorage
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
