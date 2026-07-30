'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Save, Loader2, Building2, Volume2, User, Globe2, BookOpen, Wand2 } from 'lucide-react'
import { brandProfileApi } from '@/lib/api'
import type { BrandProfile } from '@/types'

const SECTOR_OPTIONS = [
  { value: 'menstrual_hygiene', label: 'Menstrual Hygiene' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'wash', label: 'WASH' },
  { value: 'csr', label: 'CSR' },
  { value: 'sustainability', label: 'Sustainability' },
]

const TONE_DIMENSIONS = [
  { key: 'tone_professional', label: 'Professional' },
  { key: 'tone_warm', label: 'Warm' },
  { key: 'tone_inspirational', label: 'Inspirational' },
  { key: 'tone_educational', label: 'Educational' },
  { key: 'tone_urgent', label: 'Urgent' },
] as const

type ToneDimensionKey = (typeof TONE_DIMENSIONS)[number]['key']

const inputClass =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
const textareaClass =
  'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function BrandProfilePage() {
  const queryClient = useQueryClient()
  const [analyzeText, setAnalyzeText] = useState('')
  const [showAnalyze, setShowAnalyze] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: async () => {
      const res = await brandProfileApi.get()
      return res.data as BrandProfile
    },
    retry: false,
  })

  const [form, setForm] = useState<Partial<BrandProfile>>({
    organization_name: '',
    tagline: '',
    mission_statement: '',
    about: '',
    sector_focus: [],
    sdg_alignment: [],
    tone_professional: 5,
    tone_warm: 5,
    tone_inspirational: 5,
    tone_educational: 5,
    tone_urgent: 5,
    founder_name: '',
    founder_title: '',
    founder_bio: '',
    custom_vocabulary: [],
    avoid_words: [],
    linkedin_handle: '',
    instagram_handle: '',
    twitter_handle: '',
  })

  // textarea state for array fields (one item per line)
  const [vocabText, setVocabText] = useState('')
  const [avoidText, setAvoidText] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        organization_name: profile.organization_name ?? '',
        tagline: profile.tagline ?? '',
        mission_statement: profile.mission_statement ?? '',
        about: profile.about ?? '',
        sector_focus: Array.isArray(profile.sector_focus) ? profile.sector_focus : [],
        sdg_alignment: Array.isArray(profile.sdg_alignment) ? profile.sdg_alignment : [],
        tone_professional: Number(profile.tone_professional ?? 7),
        tone_warm: Number(profile.tone_warm ?? 7),
        tone_inspirational: Number(profile.tone_inspirational ?? 7),
        tone_educational: Number(profile.tone_educational ?? 7),
        tone_urgent: Number(profile.tone_urgent ?? 7),
        founder_name: profile.founder_name ?? '',
        founder_title: profile.founder_title ?? '',
        founder_bio: profile.founder_bio ?? '',
        custom_vocabulary: Array.isArray(profile.custom_vocabulary) ? profile.custom_vocabulary : [],
        avoid_words: Array.isArray(profile.avoid_words) ? profile.avoid_words : [],
        linkedin_handle: profile.linkedin_handle ?? '',
        instagram_handle: profile.instagram_handle ?? '',
        twitter_handle: profile.twitter_handle ?? '',
      })
      setVocabText((Array.isArray(profile.custom_vocabulary) ? profile.custom_vocabulary : []).join('\n'))
      setAvoidText((Array.isArray(profile.avoid_words) ? profile.avoid_words : []).join('\n'))
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BrandProfile>) => {
      const res = await brandProfileApi.update(data as Record<string, unknown>)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profile'] })
      toast.success('Brand profile saved!')
    },
    onError: () => toast.error('Failed to save. Please try again.'),
  })

  const analyzeMutation = useMutation({
    mutationFn: async (samplePosts: string[]) => {
      const res = await brandProfileApi.analyzeVoice({ sample_posts: samplePosts })
      return res.data
    },
    onSuccess: (data) => {
      // Apply analyzed tone values to form
      if (data?.tone_professional != null) setForm((f) => ({ ...f, tone_professional: data.tone_professional }))
      if (data?.tone_warm != null) setForm((f) => ({ ...f, tone_warm: data.tone_warm }))
      if (data?.tone_inspirational != null) setForm((f) => ({ ...f, tone_inspirational: data.tone_inspirational }))
      if (data?.tone_educational != null) setForm((f) => ({ ...f, tone_educational: data.tone_educational }))
      if (data?.tone_urgent != null) setForm((f) => ({ ...f, tone_urgent: data.tone_urgent }))
      queryClient.invalidateQueries({ queryKey: ['brand-profile'] })
      toast.success('Voice analyzed! Sliders updated — save to apply.')
      setShowAnalyze(false)
      setAnalyzeText('')
    },
    onError: () => toast.error('Voice analysis failed. Please try again.'),
  })

  const set = (key: keyof BrandProfile, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleSector = (value: string) => {
    const current = Array.isArray(form.sector_focus) ? form.sector_focus : []
    set(
      'sector_focus',
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
    )
  }

  const toggleSdg = (n: number) => {
    const current = Array.isArray(form.sdg_alignment) ? form.sdg_alignment : []
    set(
      'sdg_alignment',
      current.includes(n) ? current.filter((x) => x !== n) : [...current, n],
    )
  }

  const handleSave = () => {
    updateMutation.mutate({
      ...form,
      custom_vocabulary: vocabText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      avoid_words: avoidText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Brand Profile</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Help AI understand your brand voice and generate on-brand content
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 h-10 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Profile
        </button>
      </div>

      {/* Section: Identity */}
      <SectionCard icon={Building2} title="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Organization Name</label>
            <input
              value={form.organization_name || ''}
              onChange={(e) => set('organization_name', e.target.value)}
              className={inputClass}
              placeholder="Your NGO or company name"
            />
          </div>
          <div>
            <label className={labelClass}>Tagline</label>
            <input
              value={form.tagline || ''}
              onChange={(e) => set('tagline', e.target.value)}
              className={inputClass}
              placeholder="Empowering communities through hygiene"
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Mission Statement</label>
          <textarea
            value={form.mission_statement || ''}
            onChange={(e) => set('mission_statement', e.target.value)}
            className={textareaClass}
            rows={3}
            placeholder="Our mission is to..."
          />
        </div>
        <div>
          <label className={labelClass}>About</label>
          <textarea
            value={form.about || ''}
            onChange={(e) => set('about', e.target.value)}
            className={textareaClass}
            rows={4}
            placeholder="History, impact, geography, target beneficiaries..."
          />
        </div>
      </SectionCard>

      {/* Section: Sector and SDGs */}
      <SectionCard icon={Globe2} title="Sector and SDGs">
        <div>
          <label className={labelClass}>Sector Focus</label>
          <div className="flex flex-wrap gap-2">
            {SECTOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleSector(opt.value)}
                className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                  (Array.isArray(form.sector_focus) ? form.sector_focus : []).includes(opt.value)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>SDG Alignment (Goals 1–17)</label>
          <div className="grid grid-cols-9 sm:grid-cols-17 gap-1.5" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
            {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleSdg(n)}
                className={`aspect-square text-xs font-bold rounded-lg border transition-colors flex items-center justify-center ${
                  (Array.isArray(form.sdg_alignment) ? form.sdg_alignment : []).includes(n)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Section: Brand Voice */}
      <SectionCard icon={Volume2} title="Brand Voice">
        <div className="flex items-center justify-between -mt-2">
          <p className="text-sm text-muted-foreground">
            Rate each dimension 1–10. AI will mirror these settings when generating content.
          </p>
          <button
            onClick={() => setShowAnalyze((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors ml-4"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Analyze Voice
          </button>
        </div>

        {/* AI voice analysis panel */}
        {showAnalyze && (
          <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Paste 2–5 sample posts or captions</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI will analyze the tone and auto-set the sliders below.
              </p>
            </div>
            <textarea
              value={analyzeText}
              onChange={(e) => setAnalyzeText(e.target.value)}
              rows={5}
              placeholder={`Paste your existing social media posts here, one per paragraph…\n\nExample:\n"Today we reached 10,000 children with clean water access…"`}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const posts = analyzeText
                    .split(/\n{2,}/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                  if (posts.length === 0) {
                    toast.error('Please paste at least one sample post.')
                    return
                  }
                  analyzeMutation.mutate(posts)
                }}
                disabled={!analyzeText.trim() || analyzeMutation.isPending}
                className="flex items-center gap-1.5 h-9 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze'}
              </button>
              <button
                onClick={() => { setShowAnalyze(false); setAnalyzeText('') }}
                className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {TONE_DIMENSIONS.map(({ key, label }) => {
            const value = Number(form[key as ToneDimensionKey] ?? 7)
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">{label}</label>
                  <span className="text-sm font-semibold text-primary w-6 text-right">{value}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={value}
                  onChange={(e) => set(key as keyof BrandProfile, Number(e.target.value))}
                  className="w-full h-2 accent-primary cursor-pointer rounded-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Section: Founder Voice */}
      <SectionCard icon={User} title="Founder Voice">
        <p className="text-sm text-muted-foreground -mt-2">
          Used for &quot;Founder Post&quot; content — AI generates personal, authentic content.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Founder Name</label>
            <input
              value={form.founder_name || ''}
              onChange={(e) => set('founder_name', e.target.value)}
              className={inputClass}
              placeholder="Anjali Mehta"
            />
          </div>
          <div>
            <label className={labelClass}>Founder Title</label>
            <input
              value={form.founder_title || ''}
              onChange={(e) => set('founder_title', e.target.value)}
              className={inputClass}
              placeholder="Co-Founder & CEO"
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Founder Bio</label>
          <textarea
            value={form.founder_bio || ''}
            onChange={(e) => set('founder_bio', e.target.value)}
            className={textareaClass}
            rows={4}
            placeholder="Journey, motivations, background, personal story..."
          />
        </div>
      </SectionCard>

      {/* Section: Socials */}
      <SectionCard icon={Globe2} title="Socials">
        <div className="space-y-4">
          {[
            { key: 'linkedin_handle', label: 'LinkedIn', prefix: 'linkedin.com/company/' },
            { key: 'instagram_handle', label: 'Instagram', prefix: '@' },
            { key: 'twitter_handle', label: 'Twitter / X', prefix: '@' },
          ].map(({ key, label, prefix }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <div className="flex">
                <span className="flex items-center h-10 px-3 border border-r-0 border-border bg-muted rounded-l-xl text-sm text-muted-foreground whitespace-nowrap">
                  {prefix}
                </span>
                <input
                  value={(form[key as keyof BrandProfile] as string) || ''}
                  onChange={(e) => set(key as keyof BrandProfile, e.target.value)}
                  className="flex-1 h-10 px-3 border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-r-xl"
                  placeholder={`your-${label.toLowerCase().replace(' / x', '')}-handle`}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section: Vocabulary */}
      <SectionCard icon={BookOpen} title="Vocabulary">
        <div>
          <label className={labelClass}>Custom Vocabulary</label>
          <p className="text-xs text-muted-foreground mb-2">
            Words and phrases AI should use. One per line.
          </p>
          <textarea
            value={vocabText}
            onChange={(e) => setVocabText(e.target.value)}
            className={textareaClass}
            rows={4}
            placeholder={'menstrual health\nperiod dignity\nwash champion'}
          />
        </div>
        <div>
          <label className={labelClass}>Words to Avoid</label>
          <p className="text-xs text-muted-foreground mb-2">
            Words or phrases AI should never use. One per line.
          </p>
          <textarea
            value={avoidText}
            onChange={(e) => setAvoidText(e.target.value)}
            className={textareaClass}
            rows={4}
            placeholder={'jargon\noffensive term'}
          />
        </div>
      </SectionCard>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 h-10 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Profile
        </button>
      </div>
    </div>
  )
}
