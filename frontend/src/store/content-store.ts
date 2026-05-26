import { create } from 'zustand'
import type { ContentGeneration, Platform, Tone, Language } from '@/types'

interface GenerationInput {
  topic: string
  platform: Platform
  tone: Tone
  context: string
  language: Language
  campaign_id?: string
}

interface ContentState {
  generationInput: GenerationInput
  currentGeneration: ContentGeneration | null
  repurposedContent: ContentGeneration[]
  isGenerating: boolean
  isRepurposing: boolean
  showHistory: boolean
  setGenerationInput: (input: Partial<GenerationInput>) => void
  setCurrentGeneration: (content: ContentGeneration | null) => void
  setRepurposedContent: (content: ContentGeneration[]) => void
  addRepurposedContent: (content: ContentGeneration) => void
  setIsGenerating: (val: boolean) => void
  setIsRepurposing: (val: boolean) => void
  setShowHistory: (val: boolean) => void
  reset: () => void
}

const defaultInput: GenerationInput = {
  topic: '',
  platform: 'linkedin',
  tone: 'professional',
  context: '',
  language: 'en',
}

export const useContentStore = create<ContentState>((set) => ({
  generationInput: { ...defaultInput },
  currentGeneration: null,
  repurposedContent: [],
  isGenerating: false,
  isRepurposing: false,
  showHistory: false,

  setGenerationInput: (input) =>
    set((state) => ({
      generationInput: { ...state.generationInput, ...input },
    })),

  setCurrentGeneration: (content) =>
    set({ currentGeneration: content, repurposedContent: [] }),

  setRepurposedContent: (content) => set({ repurposedContent: content }),

  addRepurposedContent: (content) =>
    set((state) => ({
      repurposedContent: [...state.repurposedContent, content],
    })),

  setIsGenerating: (val) => set({ isGenerating: val }),
  setIsRepurposing: (val) => set({ isRepurposing: val }),
  setShowHistory: (val) => set({ showHistory: val }),

  reset: () =>
    set({
      currentGeneration: null,
      repurposedContent: [],
      isGenerating: false,
      isRepurposing: false,
      generationInput: { ...defaultInput },
    }),
}))
