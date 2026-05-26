'use client'

import { useState } from 'react'
import {
  Copy,
  Bookmark,
  BookmarkCheck,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Share2,
  Check,
  Cpu,
  Hash,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { QualityScore } from './quality-score'
import {
  cn,
  copyToClipboard,
  getPlatformLabel,
  getPlatformColor,
  getPlatformIcon,
} from '@/lib/utils'
import type { ContentGeneration, Platform } from '@/types'
import { useSaveContent, useContentFeedback, useRepurposeContent } from '@/hooks/use-content'

const ALL_PLATFORMS: Platform[] = [
  'linkedin',
  'instagram',
  'twitter',
  'reel_script',
  'carousel',
  'csr_story',
  'founder_post',
]

interface GenerationResultProps {
  content: ContentGeneration
  onNewGeneration?: () => void
}

export function GenerationResult({
  content,
  onNewGeneration,
}: GenerationResultProps) {
  const [copied, setCopied] = useState(false)
  const [showRepurpose, setShowRepurpose] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])

  const saveMutation = useSaveContent()
  const feedbackMutation = useContentFeedback()
  const repurposeMutation = useRepurposeContent()

  const handleCopy = () => {
    const text = [
      content.generated_content,
      '',
      content.hashtags.join(' '),
    ].join('\n')
    copyToClipboard(text)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyHashtag = (tag: string) => {
    copyToClipboard(tag)
    toast.success(`${tag} copied!`)
  }

  const handleSave = () => {
    saveMutation.mutate(content.id)
  }

  const handleFeedback = (feedback: 'thumbs_up' | 'thumbs_down') => {
    feedbackMutation.mutate({ id: content.id, feedback })
    toast.success(
      feedback === 'thumbs_up' ? 'Thanks for the feedback!' : 'Got it — we\'ll improve!',
    )
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  const handleRepurpose = () => {
    if (!selectedPlatforms.length) {
      toast.error('Select at least one platform')
      return
    }
    repurposeMutation.mutate({
      content_id: content.id,
      target_platforms: selectedPlatforms,
    })
  }

  const otherPlatforms = ALL_PLATFORMS.filter((p) => p !== content.platform)

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{getPlatformIcon(content.platform)}</span>
          <div>
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                getPlatformColor(content.platform),
              )}
            >
              {getPlatformLabel(content.platform)}
            </span>
          </div>
          {content.ai_model_used && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <Cpu className="w-3 h-3" />
              {content.ai_model_used}
            </div>
          )}
        </div>

        {content.quality_score !== undefined && (
          <QualityScore score={content.quality_score} size="sm" />
        )}
      </div>

      {/* Content body */}
      <div className="px-5 py-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">
            {content.generated_content}
          </p>
        </div>
      </div>

      {/* Hashtags */}
      {content.hashtags.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Hashtags
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {content.hashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleCopyHashtag(tag)}
                className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors font-medium"
                title="Click to copy"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-border bg-muted/30 flex flex-wrap items-center gap-2">
        {/* Copy */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 h-8 px-3 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? 'Copied!' : 'Copy all'}
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || content.is_saved}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors border',
            content.is_saved
              ? 'bg-accent/10 text-accent border-accent/30'
              : 'bg-background text-foreground border-border hover:bg-muted',
          )}
        >
          {content.is_saved ? (
            <BookmarkCheck className="w-3.5 h-3.5" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
          {content.is_saved ? 'Saved' : 'Save'}
        </button>

        {/* Repurpose */}
        <button
          onClick={() => setShowRepurpose(!showRepurpose)}
          className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Repurpose
        </button>

        {/* Share (placeholder) */}
        <button
          className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-lg transition-colors"
          title="Schedule (coming soon)"
        >
          <Share2 className="w-3.5 h-3.5" />
          Schedule
        </button>

        {/* Feedback */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => handleFeedback('thumbs_up')}
            disabled={feedbackMutation.isPending}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              content.feedback === 'thumbs_up'
                ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                : 'text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
            )}
            title="Good content"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleFeedback('thumbs_down')}
            disabled={feedbackMutation.isPending}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              content.feedback === 'thumbs_down'
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
            )}
            title="Needs improvement"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Repurpose panel */}
      {showRepurpose && (
        <div className="px-5 py-4 border-t border-border bg-muted/20 animate-fade-in">
          <p className="text-xs font-semibold text-foreground mb-3">
            Repurpose to other platforms:
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {otherPlatforms.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors border',
                  selectedPlatforms.includes(p)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {getPlatformIcon(p)} {getPlatformLabel(p)}
              </button>
            ))}
          </div>
          <button
            onClick={handleRepurpose}
            disabled={repurposeMutation.isPending || !selectedPlatforms.length}
            className="flex items-center gap-1.5 h-8 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {repurposeMutation.isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Repurposing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Repurpose to {selectedPlatforms.length || '...'} platform
                {selectedPlatforms.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
