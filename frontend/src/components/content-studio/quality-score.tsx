'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { cn, getQualityLabel } from '@/lib/utils'

interface QualityScoreProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function QualityScore({ score, size = 'md' }: QualityScoreProps) {
  const radius = size === 'sm' ? 18 : size === 'lg' ? 28 : 22
  const stroke = size === 'sm' ? 3 : 4
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const sizeMap = {
    sm: { svg: 48, text: 'text-xs' },
    md: { svg: 64, text: 'text-sm' },
    lg: { svg: 80, text: 'text-base' },
  }
  const { svg: svgSize, text: textSize } = sizeMap[size]

  const color =
    score >= 75
      ? '#22c55e'
      : score >= 50
        ? '#f59e0b'
        : '#ef4444'

  const bgColor =
    score >= 75
      ? '#dcfce7'
      : score >= 50
        ? '#fef3c7'
        : '#fee2e2'

  const label = getQualityLabel(score)

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
          <div className="flex flex-col items-center gap-1 cursor-default">
            <div className="relative" style={{ width: svgSize, height: svgSize }}>
              <svg
                width={svgSize}
                height={svgSize}
                className="-rotate-90"
                viewBox={`0 0 ${svgSize} ${svgSize}`}
              >
                {/* Background circle */}
                <circle
                  cx={svgSize / 2}
                  cy={svgSize / 2}
                  r={radius}
                  fill="none"
                  stroke={bgColor}
                  strokeWidth={stroke}
                />
                {/* Progress circle */}
                <circle
                  cx={svgSize / 2}
                  cy={svgSize / 2}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              {/* Score text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={cn('font-bold', textSize)}
                  style={{ color }}
                >
                  {score}
                </span>
              </div>
            </div>
            <span
              className="text-xs font-medium"
              style={{ color }}
            >
              {label}
            </span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-popover border border-border text-foreground text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs z-50"
            sideOffset={5}
          >
            <p className="font-medium mb-1">Quality Score: {score}/100</p>
            <p className="text-muted-foreground leading-relaxed">
              Brandora AI evaluates content based on clarity, relevance,
              engagement potential, and alignment with your brand voice.
              {score >= 75
                ? ' This content is well-optimized for maximum impact.'
                : score >= 50
                  ? ' Consider refining the topic or adding more context.'
                  : ' Try providing more specific context for better results.'}
            </p>
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
  )
}
