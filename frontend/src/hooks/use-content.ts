'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { contentApi } from '@/lib/api'
import { useContentStore } from '@/store/content-store'
import type {
  ContentGenerateRequest,
  ContentHistoryFilters,
  RepurposeRequest,
  PaginatedResponse,
  ContentGeneration,
} from '@/types'

export const CONTENT_KEYS = {
  all: ['content'] as const,
  history: (filters: ContentHistoryFilters) =>
    ['content', 'history', filters] as const,
  detail: (id: string) => ['content', id] as const,
}

// ─── Generate Content ─────────────────────────────────────────────────────────
export function useGenerateContent() {
  const { setCurrentGeneration, setIsGenerating } = useContentStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ContentGenerateRequest) => {
      setIsGenerating(true)
      const response = await contentApi.generate(data)
      return response.data as ContentGeneration
    },
    onSuccess: (data) => {
      setCurrentGeneration(data)
      setIsGenerating(false)
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all })
      toast.success('Content generated successfully!')
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setIsGenerating(false)
      const message =
        error?.response?.data?.detail || 'Failed to generate content'
      toast.error(message)
    },
  })
}

// ─── Content History ─────────────────────────────────────────────────────────
export function useContentHistory(filters: ContentHistoryFilters = {}) {
  return useQuery({
    queryKey: CONTENT_KEYS.history(filters),
    queryFn: async () => {
      const response = await contentApi.getHistory(filters)
      return response.data as PaginatedResponse<ContentGeneration>
    },
    staleTime: 30_000,
  })
}

// ─── Get Single Content ───────────────────────────────────────────────────────
export function useContentById(id: string) {
  return useQuery({
    queryKey: CONTENT_KEYS.detail(id),
    queryFn: async () => {
      const response = await contentApi.getById(id)
      return response.data as ContentGeneration
    },
    enabled: !!id,
  })
}

// ─── Repurpose Content ────────────────────────────────────────────────────────
export function useRepurposeContent() {
  const { setRepurposedContent, setIsRepurposing } = useContentStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: RepurposeRequest) => {
      setIsRepurposing(true)
      const response = await contentApi.repurpose(data)
      return response.data as ContentGeneration[]
    },
    onSuccess: (data) => {
      setRepurposedContent(data)
      setIsRepurposing(false)
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all })
      toast.success(`Repurposed to ${data.length} platform(s)!`)
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setIsRepurposing(false)
      const message =
        error?.response?.data?.detail || 'Failed to repurpose content'
      toast.error(message)
    },
  })
}

// ─── Save Content ─────────────────────────────────────────────────────────────
export function useSaveContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await contentApi.save(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all })
      toast.success('Content saved!')
    },
    onError: () => {
      toast.error('Failed to save content')
    },
  })
}

// ─── Content Feedback ─────────────────────────────────────────────────────────
export function useContentFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      feedback,
    }: {
      id: string
      feedback: 'thumbs_up' | 'thumbs_down'
    }) => {
      const response = await contentApi.feedback(id, feedback)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all })
    },
    onError: () => {
      toast.error('Failed to submit feedback')
    },
  })
}

// ─── Delete Content ───────────────────────────────────────────────────────────
export function useDeleteContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await contentApi.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTENT_KEYS.all })
      toast.success('Content deleted')
    },
    onError: () => {
      toast.error('Failed to delete content')
    },
  })
}
