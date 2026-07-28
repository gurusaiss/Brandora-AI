export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  is_verified: boolean
  created_at?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  sector: string
  website?: string
  subscription_tier: 'free' | 'pro' | 'growth' | 'enterprise'
  ai_generations_used: number
  ai_generations_limit: number
  created_at?: string
}

export type Platform =
  | 'linkedin'
  | 'instagram'
  | 'twitter'
  | 'reel_script'
  | 'carousel'
  | 'csr_story'
  | 'founder_post'

export type Tone =
  | 'professional'
  | 'inspirational'
  | 'educational'
  | 'urgent'
  | 'conversational'

export type Language = 'en' | 'hi' | 'bn' | 'ta' | 'kn'

export interface ContentGeneration {
  id: string
  platform: Platform
  generated_content: string
  hashtags: string[]
  quality_score?: number
  ai_model_used: string
  tokens_used: number
  is_saved: boolean
  input_topic: string
  input_context?: string
  tone?: Tone
  language?: Language
  feedback?: 'thumbs_up' | 'thumbs_down'
  created_at: string
}

export interface BrandProfile {
  id: string
  organization_name: string
  tagline?: string
  mission_statement?: string
  about?: string
  sector_focus: string[]
  sdg_alignment: number[]
  tone_professional: number
  tone_warm: number
  tone_inspirational: number
  tone_educational: number
  tone_urgent: number
  founder_name?: string
  founder_title?: string
  founder_bio?: string
  custom_vocabulary: string[]
  avoid_words: string[]
  sample_posts?: string[]
  linkedin_handle?: string
  instagram_handle?: string
  twitter_handle?: string
  updated_at?: string
}

export interface Campaign {
  id: string
  name: string
  description?: string
  campaign_type: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  start_date?: string
  end_date?: string
  platforms: Platform[]
  total_posts: number
  published_posts: number
  is_scheduled?: boolean
  created_at: string
  updated_at?: string
}

export interface Festival {
  id: string
  name: string
  date: string
  description: string
  category: string
  sdg_tags: number[]
  hashtags: string[]
  is_global: boolean
}

export interface ContentGenerateRequest {
  topic: string
  platform: Platform
  context?: string
  tone?: Tone
  campaign_brief?: string
  campaign_id?: string
  include_hashtags?: boolean
  language?: Language
}

export interface RepurposeRequest {
  content_id: string
  target_platforms: Platform[]
}

export interface ContentHistoryFilters {
  platform?: Platform
  is_saved?: boolean
  page?: number
  page_size?: number
}

export interface HashtagSet {
  id: string
  name: string
  hashtags: string[]
  platform?: Platform
  created_at: string
}

export interface TeamMember {
  id: string
  user_id: string
  email: string
  full_name: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  joined_at: string
  avatar_url?: string
}

export interface ApiKey {
  id: string
  name: string
  key_preview: string
  created_at: string
  last_used_at?: string
  is_active: boolean
}

export interface AnalyticsOverview {
  total_generations: number
  saved_content: number
  avg_quality_score: number
  total_tokens_used: number
  generations_this_week: number
  generations_change_pct: number
  most_used_platform: string
  platform_breakdown: Record<string, number>
  daily_activity: Array<{ date: string; generations: number }>
  // Usage meter fields
  generations_used: number
  generations_limit: number
  subscription_tier: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ── Campaign Automation Engine ────────────────────────────────────────────────

export type PostStatus = 'scheduled' | 'generating' | 'publishing' | 'published' | 'failed' | 'retrying'

export interface AutomationPost {
  id: string
  campaign_id: string
  platform: string
  content: string
  hashtags: string[] | null
  image_url: string | null
  status: PostStatus
  sequence_order: number
  retry_count: number
  max_retries: number
  failure_reason: string | null
  platform_post_id: string | null
  scheduled_at: string | null
  published_at: string | null
  created_at: string
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
export type CampaignFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface AutomationCampaign {
  id: string
  name: string
  campaign_goal: string | null
  description: string | null
  target_audience: string | null
  platforms: Platform[]
  frequency: CampaignFrequency | string
  post_time: string
  post_days: string[] | null
  tone: Tone | string
  keywords: string[] | null
  target_hashtags: string[] | null
  cta: string | null
  generate_images: boolean
  status: CampaignStatus | string
  start_date: string | null
  end_date: string | null
  total_posts: number
  published_posts: number
  social_account_id: string | null
  social_account_platform: string | null
  social_account_name: string | null
  created_at: string
  // analytics
  posts_scheduled: number
  posts_generating: number
  posts_published: number
  posts_failed: number
  posts_remaining: number
  progress_pct: number
  posts: AutomationPost[]
}

export interface AutomationCampaignCreate {
  name: string
  campaign_goal: string
  description?: string
  target_audience: string
  platforms: Platform[]
  social_account_id: string
  start_date: string
  end_date: string
  frequency: CampaignFrequency | string
  post_time: string
  post_days?: string[]
  tone: Tone | string
  keywords?: string[]
  target_hashtags?: string[]
  cta?: string
  generate_images: boolean
  topic?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  organization_name: string
  sector: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
  organization: Organization
}

export interface ScheduledPost {
  id: string
  platform: Platform
  content: string
  hashtags: string[]
  scheduled_at: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  campaign_id?: string
  created_at: string
}
