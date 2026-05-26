import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricsCardProps {
  title: string
  value: string | number
  change?: { value: number; positive: boolean }
  icon: React.ReactNode
  description?: string
  className?: string
  gradient?: boolean
}

export function MetricsCard({
  title,
  value,
  change,
  icon,
  description,
  className,
  gradient = false,
}: MetricsCardProps) {
  return (
    <div
      className={cn(
        'relative bg-card border border-border rounded-2xl p-5 overflow-hidden card-hover',
        gradient && 'bg-gradient-to-br from-primary-600/5 to-accent/5',
        className,
      )}
    >
      {/* Background decoration */}
      {gradient && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full -translate-y-6 translate-x-6" />
      )}

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
            {icon}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground tracking-tight">
            {value}
          </p>

          {change && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                change.positive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-500 dark:text-red-400',
              )}
            >
              {change.positive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {change.positive ? '+' : ''}
                {change.value}% vs last week
              </span>
            </div>
          )}

          {description && !change && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
