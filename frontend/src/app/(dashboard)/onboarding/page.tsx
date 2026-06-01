'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Briefcase,
  Heart,
  GraduationCap,
  MessageCircle,
  Linkedin,
  Instagram,
  Twitter,
  Sparkles,
} from 'lucide-react'
import { brandProfileApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

const SECTOR_OPTIONS = [
  { value: 'menstrual_hygiene', label: 'Menstrual Hygiene' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'wash', label: 'WASH' },
  { value: 'csr', label: 'CSR' },
  { value: 'sustainability', label: 'Sustainability' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
]

const TONE_CARDS = [
  {
    key: 'professional',
    label: 'Professional',
    icon: Briefcase,
    desc: 'Formal, authoritative, and expert-driven communication.',
  },
  {
    key: 'inspirational',
    label: 'Inspirational',
    icon: Sparkles,
    desc: 'Uplifting, motivating, and emotionally resonant stories.',
  },
  {
    key: 'educational',
    label: 'Educational',
    icon: GraduationCap,
    desc: 'Clear, informative, and data-driven content.',
  },
  {
    key: 'conversational',
    label: 'Conversational',
    icon: MessageCircle,
    desc: 'Warm, relatable, and community-oriented voice.',
  },
] as const

type ToneKey = (typeof TONE_CARDS)[number]['key']

function toneToValues(tone: ToneKey) {
  switch (tone) {
    case 'professional':
      return { tone_professional: 9, tone_warm: 4, tone_inspirational: 5, tone_educational: 8, tone_urgent: 5 }
    case 'inspirational':
      return { tone_professional: 5, tone_warm: 8, tone_inspirational: 9, tone_educational: 4, tone_urgent: 5 }
    case 'educational':
      return { tone_professional: 7, tone_warm: 5, tone_inspirational: 5, tone_educational: 9, tone_urgent: 4 }
    case 'conversational':
      return { tone_professional: 4, tone_warm: 9, tone_inspirational: 7, tone_educational: 5, tone_urgent: 3 }
  }
}

const inputClass =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

export default function OnboardingPage() {
  const router = useRouter()
  const { organization } = useAuthStore()

  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    org_name: organization?.name || '',
    sector: '',
    website: '',
    tone: 'professional' as ToneKey,
    linkedin_handle: '',
    instagram_handle: '',
    twitter_handle: '',
  })

  const setField = (key: keyof typeof data, value: string) =>
    setData((d) => ({ ...d, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toneValues = toneToValues(data.tone)
      await brandProfileApi.update({
        organization_name: data.org_name,
        sector_focus: data.sector ? [data.sector] : [],
        linkedin_handle: data.linkedin_handle || undefined,
        instagram_handle: data.instagram_handle || undefined,
        twitter_handle: data.twitter_handle || undefined,
        ...toneValues,
      })
    },
    onSuccess: () => {
      toast.success('Brand profile set up! Time to create content.')
      router.push('/content')
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  })

  const progressPct = ((step - 1) / 2) * 100

  return (
    <div className="max-w-2xl mx-auto py-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to Brandora AI</h1>
        <p className="text-muted-foreground mt-2">
          Set up your brand profile in 3 quick steps.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Step {step} of 3</span>
          <span>{Math.round(progressPct)}% complete</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step card */}
      <div className="bg-card border border-border rounded-2xl p-6 min-h-[340px]">
        {/* Step 1: Org details */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Tell us about your organization
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                This helps AI generate relevant, on-brand content.
              </p>
            </div>
            <div>
              <label className={labelClass}>
                Organization Name <span className="text-destructive">*</span>
              </label>
              <input
                value={data.org_name}
                onChange={(e) => setField('org_name', e.target.value)}
                className={inputClass}
                placeholder="Your NGO or company"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Sector</label>
              <select
                value={data.sector}
                onChange={(e) => setField('sector', e.target.value)}
                className={inputClass}
              >
                <option value="">Select your sector</option>
                {SECTOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Website (optional)</label>
              <input
                value={data.website}
                onChange={(e) => setField('website', e.target.value)}
                className={inputClass}
                placeholder="https://yourorg.org"
                type="url"
              />
            </div>
          </div>
        )}

        {/* Step 2: Tone cards */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Choose your brand voice
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select the tone that best represents how you communicate.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TONE_CARDS.map(({ key, label, icon: Icon, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setField('tone', key)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    data.tone === key
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-border bg-background hover:border-primary-300 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon
                      className={`w-5 h-5 ${
                        data.tone === key ? 'text-primary-600' : 'text-muted-foreground'
                      }`}
                    />
                    <span
                      className={`font-semibold text-sm ${
                        data.tone === key ? 'text-primary-700 dark:text-primary-300' : 'text-foreground'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Socials */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Connect your social handles
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Optional — used to personalize content with platform-specific formatting.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn Handle
                  </span>
                </label>
                <div className="flex">
                  <span className="flex items-center h-10 px-3 border border-r-0 border-border bg-muted rounded-l-xl text-sm text-muted-foreground whitespace-nowrap">
                    linkedin.com/company/
                  </span>
                  <input
                    value={data.linkedin_handle}
                    onChange={(e) => setField('linkedin_handle', e.target.value)}
                    className="flex-1 h-10 px-3 border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-r-xl"
                    placeholder="your-company"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5">
                    <Instagram className="w-4 h-4" />
                    Instagram Handle
                  </span>
                </label>
                <div className="flex">
                  <span className="flex items-center h-10 px-3 border border-r-0 border-border bg-muted rounded-l-xl text-sm text-muted-foreground">
                    @
                  </span>
                  <input
                    value={data.instagram_handle}
                    onChange={(e) => setField('instagram_handle', e.target.value)}
                    className="flex-1 h-10 px-3 border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-r-xl"
                    placeholder="yourhandle"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5">
                    <Twitter className="w-4 h-4" />
                    Twitter / X Handle
                  </span>
                </label>
                <div className="flex">
                  <span className="flex items-center h-10 px-3 border border-r-0 border-border bg-muted rounded-l-xl text-sm text-muted-foreground">
                    @
                  </span>
                  <input
                    value={data.twitter_handle}
                    onChange={(e) => setField('twitter_handle', e.target.value)}
                    className="flex-1 h-10 px-3 border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-r-xl"
                    placeholder="yourhandle"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-2 h-10 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 ml-auto">
          {step === 3 && (
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 h-10 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Skip for now
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !data.org_name.trim()}
              className="flex items-center gap-2 h-10 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 h-10 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
