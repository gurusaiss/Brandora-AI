import axios, { AxiosError } from 'axios'
import type {
  ContentGenerateRequest,
  RepurposeRequest,
  ContentHistoryFilters,
  LoginRequest,
  RegisterRequest,
  AutomationCampaignCreate,
} from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Request interceptor: inject auth token from localStorage
api.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Refresh-token interceptor ─────────────────────────────────────────────────
// On 401: try silent refresh before giving up and redirecting to /login.
// Queues concurrent failing requests while a refresh is in-flight.
let _refreshing = false
type QueueEntry = { resolve: (t: string) => void; reject: (e: unknown) => void }
let _queue: QueueEntry[] = []

function flushQueue(err: unknown, token: string | null) {
  _queue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)))
  _queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    // Only handle 401; skip if this IS the refresh call (avoid infinite loop)
    if (
      error.response?.status !== 401 ||
      original?.url?.includes('/auth/refresh') ||
      original?._retry
    ) {
      return Promise.reject(error)
    }

    // If another refresh is already in-flight, queue this request
    if (_refreshing) {
      return new Promise((resolve, reject) => {
        original!._retry = true  // prevent re-entry if the new token is also rejected
        _queue.push({
          resolve: (token) => {
            original!.headers!.Authorization = `Bearer ${token}`
            resolve(api(original!))
          },
          reject,
        })
      })
    }

    original!._retry = true
    _refreshing = true

    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null

    if (!refreshToken) {
      _refreshing = false
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    try {
      // Use a plain axios call — not the intercepted `api` instance — to avoid loops
      const { data } = await axios.post(`${BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      }, { timeout: 10000 })
      const newToken: string = data.access_token
      const newRefresh: string = data.refresh_token ?? refreshToken

      localStorage.setItem('access_token', newToken)
      localStorage.setItem('refresh_token', newRefresh)

      // Sync Zustand store without importing the hook (avoids React context issues)
      try {
        const { useAuthStore } = await import('@/store/auth-store')
        useAuthStore.getState().setAccessToken(newToken)
      } catch {/* ignore if store unavailable during SSR */}

      api.defaults.headers.common.Authorization = `Bearer ${newToken}`
      flushQueue(null, newToken)

      original!.headers!.Authorization = `Bearer ${newToken}`
      return api(original!)
    } catch (refreshErr) {
      flushQueue(refreshErr, null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        // Sync Zustand store so persisted isAuthenticated doesn't stay true
        try {
          const { useAuthStore } = await import('@/store/auth-store')
          useAuthStore.getState().logout()
        } catch { /* ignore */ }
        window.location.href = '/login'
      }
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  },
)

// ── Error message extractor ───────────────────────────────────────────────────
// Backend always returns { error: "CODE", message: "Human text" }
// NOT { detail: "..." } — that's FastAPI's default format which we override.
export function getApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (err as any)?.response?.data
  return (
    data?.message ||    // our custom format  ← check first
    data?.detail ||     // FastAPI default (just in case)
    data?.error ||      // fallback code
    (err as any)?.message ||  // axios network error
    fallback
  )
}

// ── Safe array coercion ───────────────────────────────────────────────────────
// Many backend list endpoints may return { items: [...] } or { data: [...] }
// instead of a plain array.  Use this everywhere before calling .map().
export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['items', 'data', 'results', 'members', 'list', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterRequest) => api.post('/auth/register', data),
  login: (data: LoginRequest) => api.post('/auth/login', data),
  refresh: (data: { refresh_token: string }) => api.post('/auth/refresh', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateMe: (data: { full_name?: string }) => api.patch('/auth/me', data),
  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; new_password: string }) =>
    api.post('/auth/reset-password', data),
  facebookLoginUrl: () => api.get('/auth/facebook'),
}

// ─── Content ─────────────────────────────────────────────────────────────────
export const contentApi = {
  generate: (data: ContentGenerateRequest) => api.post('/content/generate', data),
  repurpose: (data: RepurposeRequest) => api.post('/content/repurpose', data),
  getHistory: (params: ContentHistoryFilters) =>
    api.get('/content/history', { params }),
  getById: (id: string) => api.get(`/content/${id}`),
  save: (id: string) => api.post(`/content/${id}/save`),
  unsave: (id: string) => api.delete(`/content/${id}/save`),  // explicit DELETE endpoint
  feedback: (id: string, feedback: 'thumbs_up' | 'thumbs_down') =>
    api.post(`/content/${id}/feedback`, { feedback }),
  delete: (id: string) => api.delete(`/content/${id}`),
  schedulePost: (
    id: string,
    data: { scheduled_at: string; platform?: string },
  ) => api.post(`/content/${id}/schedule`, data),
  useInCampaign: (id: string, data: { campaign_id: string }) =>
    api.post(`/content/${id}/use-in-campaign`, data),
}

// ─── Brand Profile ────────────────────────────────────────────────────────────
export const brandProfileApi = {
  get: () => api.get('/brand-profile'),
  update: (data: Record<string, unknown>) => api.put('/brand-profile', data),
  analyzeVoice: (data: { sample_posts: string[] }) =>
    api.post('/brand-profile/voice/analyze', data),
}

// ─── Campaign Automation Engine ───────────────────────────────────────────────
export const automationApi = {
  create:         (data: AutomationCampaignCreate) => api.post('/campaigns/automation', data),
  list:           () => api.get('/campaigns/automation/list'),
  detail:         (id: string) => api.get(`/campaigns/${id}/detail`),
  updatePost:     (campaignId: string, postId: string, data: Record<string, unknown>) =>
                    api.patch(`/campaigns/${campaignId}/posts/${postId}`, data),
  regeneratePost: (campaignId: string, postId: string) =>
                    api.post(`/campaigns/${campaignId}/posts/${postId}/regenerate`),
  toggle:         (id: string) => api.patch(`/campaigns/${id}/toggle`),
  delete:         (id: string) => api.delete(`/campaigns/${id}`),
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const campaignApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/campaigns', { params }),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: Record<string, unknown>) => api.post('/campaigns', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  // ── Auto-campaign scheduler ───────────────────────────────────────────────
  listAuto: () => api.get('/campaigns/auto'),
  createAuto: (data: {
    name: string
    topic: string
    social_account_id: string
    frequency: string
    post_time: string
    post_days?: string[]
    image_url?: string
  }) => api.post('/campaigns/auto', data),
  toggle: (id: string) => api.patch(`/campaigns/${id}/toggle`),
}

// ─── Festivals ────────────────────────────────────────────────────────────────
export const festivalApi = {
  list: () => api.get('/festivals'),
  upcoming: (days?: number) =>
    api.get('/festivals/upcoming', { params: { days } }),
  generateContent: (festivalId: string, data: Record<string, unknown>) =>
    api.post(`/festivals/${festivalId}/generate-content`, data),
}

// ─── Hashtags ─────────────────────────────────────────────────────────────────
export const hashtagApi = {
  generate: (data: { topic: string; platform: string; count?: number }) =>
    api.post('/hashtags/generate', data),
  getSets: () => api.get('/hashtags/sets'),
  saveSet: (data: { name: string; hashtags: string[]; platform?: string }) =>
    api.post('/hashtags/sets', data),
  deleteSet: (id: string) => api.delete(`/hashtags/sets/${id}`),
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  contentPerformance: () => api.get('/analytics/content-performance'),
}

// ─── Team ─────────────────────────────────────────────────────────────────────
export const teamApi = {
  list: () => api.get('/team/members'),
  invite: (data: { email: string; role: string }) =>
    api.post('/team/invite', data),
  updateRole: (memberId: string, role: string) =>
    api.patch(`/team/members/${memberId}`, { role }),
  remove: (memberId: string) => api.delete(`/team/members/${memberId}`),
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export const apiKeyApi = {
  list: () => api.get('/api-keys'),
  create: (name: string) => api.post('/api-keys', { name }),
  revoke: (id: string) => api.delete(`/api-keys/${id}`),
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
export const scheduleApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/schedule', { params }),
  create: (data: Record<string, unknown>) => api.post('/schedule', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/schedule/${id}`, data),
  delete: (id: string) => api.delete(`/schedule/${id}`),
}

// ─── Organization ─────────────────────────────────────────────────────────────
export const organizationApi = {
  me: () => api.get('/organizations/me'),
  update: (data: Record<string, unknown>) => api.patch('/organizations/me', data),
}

// ─── Social Accounts ──────────────────────────────────────────────────────────
export const socialAccountsApi = {
  list: () => api.get('/social-accounts'),
  connectMeta: () => api.get('/social-accounts/connect/meta'),
  connectLinkedIn: () => api.get('/social-accounts/connect/linkedin'),
  connectTwitter: () => api.get('/social-accounts/connect/twitter'),
  connectMetaManual: (pageAccessToken: string) =>
    api.post('/social-accounts/connect/meta/manual', { page_access_token: pageAccessToken }),
  disconnect: (accountId: string) =>
    api.delete(`/social-accounts/${accountId}`),
  metaPost: (data: {
    account_id: string
    message: string
    image_url?: string
  }) => api.post('/social-accounts/meta/post', data),
}

export default api
