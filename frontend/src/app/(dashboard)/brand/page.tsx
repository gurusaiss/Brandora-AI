'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import * as Slider from '@radix-ui/react-slider'
import toast from 'react-hot-toast'
import { Save, Plus, X, Building2, Loader2 } from 'lucide-react'
import { brandProfileApi } from '@/lib/api'
import { getSectorOptions } from '@/lib/utils'
import type { BrandProfile } from '@/types'

const TONE_LABELS = [
  { key: 'tone_professional', label: 'Professional', desc: 'Formal, expert tone' },
  { key: 'tone_warm', label: 'Warm', desc: 'Empathetic, caring tone' },
  { key: 'tone_inspirational', label: 'Inspirational', desc: 'Motivating, uplifting' },
  { key: 'tone_educational', label: 'Educational', desc: 'Informative, clear' },
  { key: 'tone_urgent', label: 'Urgent', desc: 'Action-driving, compelling' },
] as const

type ToneKey = (typeof TONE_LABELS)[number]['key']

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}

function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-lg font-medium"
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="flex-1 h-9 px-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={add}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function BrandProfilePage() {
  const queryClient = useQueryClient()
  const sectorOptions = getSectorOptions()

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
    tone_professional: 70,
    tone_warm: 60,
    tone_inspirational: 50,
    tone_educational: 50,
    tone_urgent: 30,
    founder_name: '',
    founder_title: '',
    founder_bio: '',
    custom_vocabulary: [],
    avoid_words: [],
    sample_posts: ['', '', ''],
    linkedin_handle: '',
    instagram_handle: '',
    twitter_handle: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({ ...profile, sample_posts: profile.sample_posts ?? ['', '', ''] })
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

  const set = (key: keyof BrandProfile, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSave = () => updateMutation.mutate(form)

  const inputClass =
    'w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
  const textareaClass =
    'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
  const labelClass = 'block text-sm font-medium text-foreground mb-1.5'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
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

      <Tabs.Root defaultValue="org">
        <Tabs.List className="flex gap-1 bg-muted p-1 rounded-xl mb-6 overflow-x-auto">
          {[
            { value: 'org', label: 'Organization' },
            { value: 'voice', label: 'Voice & Tone' },
            { value: 'founder', label: 'Founder Profile' },
            { value: 'samples', label: 'Sample Posts' },
            { value: 'social', label: 'Social Handles' },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="flex-shrink-0 h-9 px-4 text-sm font-medium rounded-lg transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab 1: Organization */}
        <Tabs.Content value="org" className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Organization Info</h3>
          </div>
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
              placeholder="Tell AI about your organization — history, impact, geography, target beneficiaries..."
            />
          </div>
          <div>
            <label className={labelClass}>Sector Focus</label>
            <TagInput
              tags={form.sector_focus || []}
              onChange={(v) => set('sector_focus', v)}
              placeholder="Add sector (e.g. menstrual health)"
            />
          </div>
          <div>
            <label className={labelClass}>SDG Alignment (Goals 1–17)</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    const current = form.sdg_alignment || []
                    set(
                      'sdg_alignment',
                      current.includes(n)
                        ? current.filter((x) => x !== n)
                        : [...current, n],
                    )
                  }}
                  className={`w-9 h-9 text-xs font-bold rounded-lg border transition-colors ${
                    (form.sdg_alignment || []).includes(n)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Tabs.Content>

        {/* Tab 2: Voice & Tone */}
        <Tabs.Content value="voice" className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Voice & Tone</h3>
            <p className="text-sm text-muted-foreground">
              Adjust sliders to define your brand&apos;s communication style. AI will mirror these settings.
            </p>
          </div>
          {TONE_LABELS.map(({ key, label, desc }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {desc}
                  </span>
                </div>
                <span className="text-sm font-semibold text-primary w-8 text-right">
                  {form[key as ToneKey] ?? 50}
                </span>
              </div>
              <Slider.Root
                min={0}
                max={100}
                step={5}
                value={[form[key as ToneKey] ?? 50]}
                onValueChange={([v]) => set(key as ToneKey, v)}
                className="relative flex items-center select-none touch-none w-full h-5"
              >
                <Slider.Track className="bg-muted relative grow rounded-full h-2">
                  <Slider.Range className="absolute bg-primary-500 rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-5 h-5 bg-white border-2 border-primary-500 rounded-full shadow-sm hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors" />
              </Slider.Root>
            </div>
          ))}

          <div className="pt-4 border-t border-border space-y-4">
            <div>
              <label className={labelClass}>Custom Vocabulary</label>
              <p className="text-xs text-muted-foreground mb-2">
                Words & phrases AI should use (brand terms, cause-specific language)
              </p>
              <TagInput
                tags={form.custom_vocabulary || []}
                onChange={(v) => set('custom_vocabulary', v)}
                placeholder="Add word (press Enter)"
              />
            </div>
            <div>
              <label className={labelClass}>Words to Avoid</label>
              <p className="text-xs text-muted-foreground mb-2">
                Words or phrases AI should never use
              </p>
              <TagInput
                tags={form.avoid_words || []}
                onChange={(v) => set('avoid_words', v)}
                placeholder="Add word to avoid"
              />
            </div>
          </div>
        </Tabs.Content>

        {/* Tab 3: Founder Profile */}
        <Tabs.Content value="founder" className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Founder Profile</h3>
            <p className="text-sm text-muted-foreground">
              Used for &quot;Founder Post&quot; content type — AI generates personal, authentic founder content.
            </p>
          </div>
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
              rows={5}
              placeholder="Anjali's journey, motivations, background, personal story, what drives their work..."
            />
          </div>
        </Tabs.Content>

        {/* Tab 4: Sample Posts */}
        <Tabs.Content value="samples" className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Sample Posts</h3>
            <p className="text-sm text-muted-foreground">
              Paste 3–5 of your best posts. AI will analyze and learn your unique writing style.
            </p>
          </div>
          {(form.sample_posts || ['', '', '']).map((post, i) => (
            <div key={i}>
              <label className={labelClass}>Sample Post {i + 1}</label>
              <textarea
                value={post}
                onChange={(e) => {
                  const updated = [...(form.sample_posts || ['', '', ''])]
                  updated[i] = e.target.value
                  set('sample_posts', updated)
                }}
                className={textareaClass}
                rows={4}
                placeholder={`Paste your ${i === 0 ? 'best' : 'another'} post here...`}
              />
            </div>
          ))}
          <button
            onClick={() =>
              set('sample_posts', [...(form.sample_posts || []), ''])
            }
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add another sample
          </button>
        </Tabs.Content>

        {/* Tab 5: Social Handles */}
        <Tabs.Content value="social" className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Social Handles</h3>
            <p className="text-sm text-muted-foreground">
              Used to personalize content with proper @ mentions and platform-specific formatting.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { key: 'linkedin_handle', label: 'LinkedIn', prefix: 'linkedin.com/company/' },
              { key: 'instagram_handle', label: 'Instagram', prefix: '@' },
              { key: 'twitter_handle', label: 'Twitter / X', prefix: '@' },
            ].map(({ key, label, prefix }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <div className="flex">
                  <span className="flex items-center h-10 px-3 border border-r-0 border-border bg-muted rounded-l-xl text-sm text-muted-foreground">
                    {prefix}
                  </span>
                  <input
                    value={form[key as keyof BrandProfile] as string || ''}
                    onChange={(e) => set(key as keyof BrandProfile, e.target.value)}
                    className="flex-1 h-10 px-3 border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-r-xl"
                    placeholder={`your-${label.toLowerCase().replace(' / x', '')}-handle`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
