'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import * as Slider from '@radix-ui/react-slider'
import toast from 'react-hot-toast'
import {
  Building2,
  Mic2,
  User,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from 'lucide-react'
import { brandProfileApi } from '@/lib/api'
import { cn, getSectorOptions } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

const STEPS = [
  { id: 1, title: 'Organization', icon: Building2, desc: 'Tell us about your org' },
  { id: 2, title: 'Brand Voice', icon: Mic2, desc: 'Set your communication style' },
  { id: 3, title: 'Founder', icon: User, desc: 'Optional personal touch' },
  { id: 4, title: "Let's Create!", icon: Sparkles, desc: 'Generate your first post' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { organization } = useAuthStore()
  const sectorOptions = getSectorOptions()

  const [step, setStep] = useState(1)
  const [orgData, setOrgData] = useState({
    organization_name: organization?.name || '',
    tagline: '',
    mission_statement: '',
    sector_focus: [] as string[],
    website: '',
  })
  const [voiceData, setVoiceData] = useState({
    tone_professional: 70,
    tone_warm: 60,
    tone_inspirational: 55,
    tone_educational: 50,
    tone_urgent: 35,
  })
  const [founderData, setFounderData] = useState({
    founder_name: '',
    founder_title: '',
    founder_bio: '',
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await brandProfileApi.update({
        ...orgData,
        ...voiceData,
        ...founderData,
        sdg_alignment: [],
        custom_vocabulary: [],
        avoid_words: [],
      })
    },
    onSuccess: () => {
      toast.success("Brand profile saved! Let's generate your first post.")
      router.push('/content')
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  })

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  const canProceed = () => {
    if (step === 1) return orgData.organization_name.trim().length > 1
    return true
  }

  const handleNext = () => {
    if (step < STEPS.length) setStep(step + 1)
    else saveMutation.mutate()
  }

  return (
    <div className="max-w-2xl mx-auto py-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome to Brandora AI
        </h1>
        <p className="text-muted-foreground mt-2">
          Let&apos;s set up your brand profile in 3 quick steps.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-3">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm',
                  s.id < step
                    ? 'bg-primary-600 text-white'
                    : s.id === step
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 border-2 border-primary-400'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {s.id < step ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <span
                className={cn(
                  'text-xs hidden sm:block',
                  s.id === step ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-2xl p-6">
        {/* Step 1: Organization */}
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
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Organization Name *
              </label>
              <input
                value={orgData.organization_name}
                onChange={(e) =>
                  setOrgData({ ...orgData, organization_name: e.target.value })
                }
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Your NGO or company"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Sector
              </label>
              <select
                value={orgData.sector_focus[0] || ''}
                onChange={(e) =>
                  setOrgData({
                    ...orgData,
                    sector_focus: e.target.value ? [e.target.value] : [],
                  })
                }
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select your sector</option>
                {sectorOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Mission (optional)
              </label>
              <textarea
                value={orgData.mission_statement}
                onChange={(e) =>
                  setOrgData({ ...orgData, mission_statement: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                placeholder="Our mission is to..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Brand Voice */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                What&apos;s your brand voice?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Drag sliders to describe how you communicate. AI mirrors your style.
              </p>
            </div>
            {[
              { key: 'tone_professional', label: 'Professional ↔ Casual' },
              { key: 'tone_warm', label: 'Formal ↔ Warm' },
              { key: 'tone_inspirational', label: 'Factual ↔ Inspirational' },
              { key: 'tone_educational', label: 'Simple ↔ Educational' },
              { key: 'tone_urgent', label: 'Relaxed ↔ Urgent' },
            ].map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    {voiceData[key as keyof typeof voiceData]}
                  </span>
                </div>
                <Slider.Root
                  min={0}
                  max={100}
                  step={5}
                  value={[voiceData[key as keyof typeof voiceData]]}
                  onValueChange={([v]) =>
                    setVoiceData({ ...voiceData, [key]: v })
                  }
                  className="relative flex items-center select-none touch-none w-full h-5"
                >
                  <Slider.Track className="bg-muted relative grow rounded-full h-2">
                    <Slider.Range className="absolute bg-primary-500 rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb className="block w-5 h-5 bg-white border-2 border-primary-500 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </Slider.Root>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Founder */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Founder Profile
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Optional — enables &quot;Founder Post&quot; content type with your personal voice.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Founder Name
              </label>
              <input
                value={founderData.founder_name}
                onChange={(e) =>
                  setFounderData({ ...founderData, founder_name: e.target.value })
                }
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Title
              </label>
              <input
                value={founderData.founder_title}
                onChange={(e) =>
                  setFounderData({ ...founderData, founder_title: e.target.value })
                }
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Founder & CEO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Brief Bio
              </label>
              <textarea
                value={founderData.founder_bio}
                onChange={(e) =>
                  setFounderData({ ...founderData, founder_bio: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={4}
                placeholder="Your story, motivation, impact journey..."
              />
            </div>
            <button
              onClick={() => setStep(4)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Skip this step →
            </button>
          </div>
        )}

        {/* Step 4: Ready */}
        {step === 4 && (
          <div className="text-center space-y-5 py-4 animate-fade-in">
            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-primary-600" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-xl">
                Your brand is ready!
              </h2>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Brandora AI has learned your brand voice. Click below to generate
                your first AI-powered social media post.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                '✍️ LinkedIn thought leadership',
                '📸 Instagram impact story',
                '🎬 Reel script for awareness day',
                '❤️ CSR story for stakeholders',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-2 h-10 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleNext}
          disabled={!canProceed() || saveMutation.isPending}
          className="flex items-center gap-2 h-10 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm ml-auto"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          {step === STEPS.length ? (
            <>
              <Sparkles className="w-4 h-4" />
              Generate first post
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
