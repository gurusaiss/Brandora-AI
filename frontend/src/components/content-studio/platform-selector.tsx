'use client'

import {
  Linkedin,
  Instagram,
  Twitter,
  Film,
  LayoutGrid,
  Heart,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

interface PlatformOption {
  value: Platform
  label: string
  icon: React.ReactNode
  description: string
  color: string
  selectedBg: string
}

const platforms: PlatformOption[] = [
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: <Linkedin className="w-5 h-5" />,
    description: 'Professional thought leadership',
    color: 'text-blue-600',
    selectedBg: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  },
  {
    value: 'instagram',
    label: 'Instagram',
    icon: <Instagram className="w-5 h-5" />,
    description: 'Visual storytelling & reels',
    color: 'text-pink-600',
    selectedBg: 'border-pink-400 bg-pink-50 dark:bg-pink-900/20',
  },
  {
    value: 'twitter',
    label: 'Twitter / X',
    icon: <Twitter className="w-5 h-5" />,
    description: 'Concise impact messaging',
    color: 'text-sky-600',
    selectedBg: 'border-sky-400 bg-sky-50 dark:bg-sky-900/20',
  },
  {
    value: 'reel_script',
    label: 'Reel Script',
    icon: <Film className="w-5 h-5" />,
    description: 'Short-form video scripts',
    color: 'text-purple-600',
    selectedBg: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20',
  },
  {
    value: 'carousel',
    label: 'Carousel',
    icon: <LayoutGrid className="w-5 h-5" />,
    description: 'Multi-slide educational content',
    color: 'text-orange-600',
    selectedBg: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
  },
  {
    value: 'csr_story',
    label: 'CSR Story',
    icon: <Heart className="w-5 h-5" />,
    description: 'Impact reports & CSR narratives',
    color: 'text-red-600',
    selectedBg: 'border-red-400 bg-red-50 dark:bg-red-900/20',
  },
  {
    value: 'founder_post',
    label: 'Founder Post',
    icon: <User className="w-5 h-5" />,
    description: 'Personal founder voice content',
    color: 'text-green-600',
    selectedBg: 'border-green-400 bg-green-50 dark:bg-green-900/20',
  },
]

interface PlatformSelectorProps {
  value: Platform
  onChange: (platform: Platform) => void
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {platforms.map((platform) => {
        const isSelected = value === platform.value
        return (
          <button
            key={platform.value}
            type="button"
            onClick={() => onChange(platform.value)}
            className={cn(
              'flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]',
              isSelected
                ? `${platform.selectedBg} border-opacity-100`
                : 'border-border bg-card hover:bg-muted/50 hover:border-muted-foreground/30',
            )}
          >
            <span
              className={cn(
                'transition-colors',
                isSelected ? platform.color : 'text-muted-foreground',
              )}
            >
              {platform.icon}
            </span>
            <div>
              <p
                className={cn(
                  'text-xs font-semibold',
                  isSelected ? 'text-foreground' : 'text-foreground/80',
                )}
              >
                {platform.label}
              </p>
              <p className="text-xs text-muted-foreground leading-tight hidden sm:block">
                {platform.description}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
