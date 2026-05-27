import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import type { Platform } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy • h:mm a')
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str
}

export function getPlatformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    twitter: 'Twitter / X',
    reel_script: 'Reel Script',
    carousel: 'Carousel',
    csr_story: 'CSR Story',
    founder_post: 'Founder Post',
  }
  return labels[platform] || platform
}

export function getPlatformIcon(platform: Platform | string): string {
  const icons: Record<string, string> = {
    linkedin: '💼',
    instagram: '📸',
    twitter: '🐦',
    reel_script: '🎬',
    carousel: '🎠',
    csr_story: '❤️',
    founder_post: '👤',
  }
  return icons[platform] || '📝'
}

export function getPlatformColor(platform: Platform | string): string {
  const colors: Record<string, string> = {
    linkedin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    instagram:
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    twitter: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    reel_script:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    carousel:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    csr_story: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    founder_post:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  }
  return colors[platform] || 'bg-gray-100 text-gray-800'
}

export function getPlatformBorderColor(platform: Platform | string): string {
  const colors: Record<string, string> = {
    linkedin: 'border-blue-400',
    instagram: 'border-pink-400',
    twitter: 'border-sky-400',
    reel_script: 'border-purple-400',
    carousel: 'border-orange-400',
    csr_story: 'border-red-400',
    founder_post: 'border-green-400',
  }
  return colors[platform] || 'border-gray-400'
}

export function getQualityColor(score: number): string {
  if (score >= 75) return 'text-green-600 dark:text-green-400'
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

export function getQualityLabel(score: number): string {
  if (score >= 75) return 'Excellent'
  if (score >= 50) return 'Good'
  return 'Fair'
}

export function getQualityBg(score: number): string {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function copyToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text)
  }
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

export function getSectorOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'menstrual_hygiene', label: 'Menstrual Hygiene' },
    { value: 'water_sanitation', label: 'Water & Sanitation (WASH)' },
    { value: 'csr_sustainability', label: 'CSR & Sustainability' },
    { value: 'womens_health', label: "Women's Health" },
    { value: 'public_health', label: 'Public Health' },
    { value: 'education', label: 'Education' },
    { value: 'environment', label: 'Environment & Climate' },
    { value: 'community_development', label: 'Community Development' },
    { value: 'other', label: 'Other NGO / Social Impact' },
  ]
}

export function getSubscriptionBadge(
  tier: string,
): { label: string; color: string } {
  const badges: Record<string, { label: string; color: string }> = {
    free: { label: 'Free', color: 'bg-gray-100 text-gray-700' },
    pro: {
      label: 'Pro',
      color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
    },
    growth: {
      label: 'Growth',
      color: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
    },
    enterprise: {
      label: 'Enterprise',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
  }
  return badges[tier] || badges.free
}
