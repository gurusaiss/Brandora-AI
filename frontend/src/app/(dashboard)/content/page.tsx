'use client'

import { useState } from 'react'
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  History,
  Clock,
  Loader2,
  X,
} from 'lucide-react'
import { PlatformSelector } from '@/components/content-studio/platform-selector'
import { GenerationResult } from '@/components/content-studio/generation-result'
import { EmptyState } from '@/components/shared/empty-state'
import {
  useGenerateContent,
  useContentHistory,
} from '@/hooks/use-content'
import { useContentStore } from '@/store/content-store'
import {
  cn,
  getPlatformLabel,
  getPlatformColor,
  getPlatformIcon,
  truncate,
  formatRelativeTime,
} from '@/lib/utils'
import type { Tone, Language } from '@/types'

const TONES: Array<{ value: Tone; label: string; desc: string }> = [
  { value: 'professional', label: 'Professional', desc: 'Polished & formal' },
  { value: 'inspirational', label: 'Inspirational', desc: 'Motivating & uplifting' },
  { value: 'educational', label: 'Educational', desc: 'Informative & clear' },
  { value: 'urgent', label: 'Urgent', desc: 'Action-driving' },
  { value: 'conversational', label: 'Conversational', desc: 'Friendly & direct' },
]

const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'kn', label: 'Kannada' },
]

const SAMPLE_TOPICS = [
  'World Menstrual Hygiene Day 2026 — how our NGO is making a difference',
  'Clean water access: 5 ways we\'re changing lives in rural India',
  'Our CSR impact report 2025 — 50,000 girls reached',
  'Breaking the taboo around menstrual health in schools',
]

export default function ContentStudioPage() {
  const [showContext, setShowContext] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const {
    generationInput,
    currentGeneration,
    repurposedContent,
    isGenerating,
    setGenerationInput,
  } = useContentStore()

  const generateMutation = useGenerateContent()
  const { data: historyData } = useContentHistory({ page: 1, page_size: 10 })

  const handleGenerate = () => {
    if (!generationInput.topic.trim()) return
    generateMutation.mutate({
      topic: generationInput.topic,
      platform: generationInput.platform,
      tone: generationInput.tone,
      context: generationInput.context || undefined,
      language: generationInput.language,
      include_hashtags: true,
    })
  }

  const canGenerate =
    generationInput.topic.trim().length > 0 && !isGenerating

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Content Studio</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Generate AI-powered social media content for your campaigns
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 h-9 px-4 border border-border bg-card hover:bg-muted rounded-xl text-sm font-medium text-foreground transition-colors"
        >
          <History className="w-4 h-4" />
          History
          {historyData?.total ? (
            <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full">
              {historyData.total}
            </span>
          ) : null}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Left panel: Input form ────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            {/* Topic input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                What do you want to post about?
              </label>
              <textarea
                value={generationInput.topic}
                onChange={(e) =>
                  setGenerationInput({ topic: e.target.value })
                }
                placeholder={SAMPLE_TOPICS[0]}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
              {/* Sample topics */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Try:</p>
                {SAMPLE_TOPICS.slice(1, 3).map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setGenerationInput({ topic })}
                    className="block w-full text-left text-xs text-primary hover:underline truncate"
                  >
                    &rarr; {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Platform
              </label>
              <PlatformSelector
                value={generationInput.platform}
                onChange={(platform) => setGenerationInput({ platform })}
              />
            </div>

            {/* Tone selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Tone
              </label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <button
                    key={tone.value}
                    onClick={() => setGenerationInput({ tone: tone.value })}
                    title={tone.desc}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs font-medium transition-colors border',
                      generationInput.tone === tone.value
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-background text-foreground border-border hover:bg-muted',
                    )}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Language
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() =>
                      setGenerationInput({ language: lang.value })
                    }
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs font-medium transition-colors border',
                      generationInput.language === lang.value
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-background text-foreground border-border hover:bg-muted',
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional context (collapsible) */}
            <div>
              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showContext ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Additional context
                <span className="text-xs">(optional)</span>
              </button>
              {showContext && (
                <textarea
                  value={generationInput.context}
                  onChange={(e) =>
                    setGenerationInput({ context: e.target.value })
                  }
                  placeholder="Add campaign brief, key statistics, target audience, or specific messages to include..."
                  rows={3}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm shadow-sm shadow-primary/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Content
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Right panel: Results ───────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          {isGenerating && (
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary-600 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-2xl border-2 border-primary-400 animate-ping opacity-30" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  AI is crafting your content...
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyzing topic, optimizing for{' '}
                  {getPlatformLabel(generationInput.platform)}, applying brand
                  voice
                </p>
              </div>
            </div>
          )}

          {!isGenerating && currentGeneration && (
            <GenerationResult
              content={currentGeneration}
              onNewGeneration={() => useContentStore.getState().reset()}
            />
          )}

          {/* Repurposed content */}
          {repurposedContent.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Repurposed versions ({repurposedContent.length})
              </h3>
              {repurposedContent.map((c) => (
                <GenerationResult key={c.id} content={c} />
              ))}
            </div>
          )}

          {!isGenerating && !currentGeneration && (
            <EmptyState
              icon={<Sparkles className="w-8 h-8" />}
              title="Ready to create?"
              description="Enter your topic on the left, choose a platform and tone, then click Generate. Your AI-powered content will appear here."
              className="bg-card border border-border rounded-2xl min-h-[400px]"
            />
          )}
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowHistory(false)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border z-50 flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold text-foreground">Content History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!historyData?.items?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No history yet
                </p>
              ) : (
                historyData.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      useContentStore.getState().setCurrentGeneration(item)
                      setShowHistory(false)
                    }}
                    className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm flex-shrink-0">
                      {getPlatformIcon(item.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {truncate(item.input_topic, 50)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            getPlatformColor(item.platform),
                          )}
                        >
                          {getPlatformLabel(item.platform)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
