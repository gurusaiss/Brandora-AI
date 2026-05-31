import axios, { AxiosError } from 'axios'
import type {
  ContentGenerateRequest,
  RepurposeRequest,
  ContentHistoryFilters,
  LoginRequest,
  RegisterRequest,
} from '@/types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Request interceptor: inject auth token from localStorage
api.interceptors.request.use((config) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterRequest) => api.post('/auth/register', data),
  login: (data: LoginRequest) => api.post('/auth/login', data),
  refresh: (data: { refresh_token: string }) => api.post('/auth/refresh', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; new_password: string }) => api.post('/auth/reset-password', data),
}

// ─── Content ─────────────────────────────────────────────────────────────────
export const contentApi = {
  generate: (data: ContentGenerateRequest) =>
    api.post('/content/generate', data),
  repurpose: (data: RepurposeRequest) => api.post('/content/repurpose', data),
  getHistory: (params: ContentHistoryFilters) =>
    api.get('/content/history', { params }),
  getById: (id: string) => api.get(`/content/${id}`),
  // POST toggles saved state — use same endpoint for save & unsave
  save: (id: string) => api.post(`/content/${id}/save`),
  unsave: (id: string) => api.post(`/content/${id}/save`),
  feedback: (id: string, feedback: 'thumbs_up' | 'thumbs_down') =>
    api.post(`/content/${id}/feedback`, { feedback }),
  delete: (id: string) => api.delete(`/content/${id}`),
}

// ─── Brand Profile ────────────────────────────────────────────────────────────
export const brandProfileApi = {
  get: () => api.get('/brand-profile'),
  update: (data: Record<string, unknown>) => api.put('/brand-profile', data),
  analyzeVoice: (data: { sample_posts: string[] }) =>
    api.post('/brand-profile/voice/analyze', data),
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
}

// ─── Festivals ────────────────────────────────────────────────────────────────
export const festivalApi = {
  list: () => api.get('/festivals'),
  upcoming: (limit?: number) =>
    api.get('/festivals/upcoming', { params: { limit } }),
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

export default api
