'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Hash, Loader2, Copy, Check, Save, Trash2, Sparkles, BookmarkPlus,
} from 'lucide-react'
import { hashtagApi, toArray, getApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

type HashtagSet = {
  id: string
  name: string
  hashtags: string[]
  platform: string | null
  created_at: string
}

const PLATFORMS = [
  { value: 'linkedin',  label: 'LinkedIn',    limit: 5  },
  { value: 'instagram', label: 'Instagram',   limit: 20 },
  { value: 'twitter',   label: 'Twitter / X', limit: 3  },
]

const inputClass =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'

export default function HashtagsPage() {
  const queryClient = useQueryClient()

  const [topic, setTopic]         = useState('')
  const [platform, setPlatform]   = useState('linkedin')
  const [generated, setGenerated] = useState<string[]>([])
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [copied, setCopied]       = useState(false)
  const [showSave, setShowSave]   = useState(false)
  const [setName, setSetName]     = useState('')

  const { data: sets, isLoading: setsLoading } = useQuery({
    queryKey: ['hashtag-sets'],
    queryFn: async () => {
      const res = await hashtagApi.getSets()
      return toArray<HashtagSet>(res.data)
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await hashtagApi.generate({ topic: topic.trim(), platform })
      return res.data as { hashtags: string[] }
    },
    onSuccess: (data) => {
      const tags = data.hashtags ?? []
      setGenerated(tags)
      setSelected(new Set(tags))   // pre-select everything
      toast.success(`Generated ${tags.length} hashtags`)
    },
    onError: (err) => toast.error(getApiError(err, 'Failed to generate hashtags')),
  })

  const saveSetMutation = useMutation({
    mutationFn: () =>
      hashtagApi.saveSet({
        name: setName.trim(),
        hashtags: Array.from(selected),
        platform,
      }),
    onSuccess: () => {
      toast.success('Hashtag set saved!')
      setShowSave(false)
      setSetName('')
      queryClient.invalidateQueries({ queryKey: ['hashtag-sets'] })
    },
    onError: (err) => toast.error(getApiError(err, 'Failed to save set')),
  })

  const deleteSetMutation = useMutation({
    mutationFn: (id: string) => hashtagApi.deleteSet(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['hashtag-sets'] })
      const prev = queryClient.getQueryData(['hashtag-sets'])
      queryClient.setQueryData(['hashtag-sets'], (old: HashtagSet[] | undefined) =>
        (old ?? []).filter((s) => s.id !== id),
      )
      return { prev }
    },
    onSuccess: () => toast.success('Set deleted'),
    onError: (_e, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['hashtag-sets'], ctx.prev)
      toast.error('Failed to delete set')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['hashtag-sets'] }),
  })

  const toggleTag = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  const copyTags = async (tags: string[]) => {
    await navigator.clipboard.writeText(tags.join(' '))
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const activePlatform = PLATFORMS.find((p) => p.value === platform)
  const overLimit = activePlatform ? selected.size > activePlatform.limit : false

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Hashtag Generator</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Generate platform-optimised hashtags and save reusable sets
        </p>
      </div>

      {/* ── Generator ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Generate</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Topic</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && topic.trim().length >= 3) generateMutation.mutate()
            }}
            placeholder="e.g. Menstrual hygiene awareness drive in rural schools"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors',
                  platform === p.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {p.label}
                <span className="ml-1.5 text-xs opacity-70">max {p.limit}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => generateMutation.mutate()}
          disabled={topic.trim().length < 3 || generateMutation.isPending}
          className="flex items-center gap-2 h-10 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Hash className="w-4 h-4" />
          )}
          Generate Hashtags
        </button>

        {/* Results */}
        {generated.length > 0 && (
          <div className="border-t border-border pt-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium text-foreground">
                {selected.size} of {generated.length} selected
                {overLimit && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">
                    over {activePlatform?.label} limit of {activePlatform?.limit}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(generated))}
                  className="h-8 px-3 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="h-8 px-3 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {generated.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                    selected.has(tag)
                      ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-700 dark:text-primary-300 border-primary-300 dark:border-primary-700'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copyTags(Array.from(selected))}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 h-9 px-4 border border-border hover:bg-muted disabled:opacity-50 text-sm font-medium rounded-xl transition-colors"
              >
                {copied ? (
                  <><Check className="w-4 h-4 text-green-500" />Copied</>
                ) : (
                  <><Copy className="w-4 h-4" />Copy selected</>
                )}
              </button>
              <button
                onClick={() => setShowSave((v) => !v)}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 h-9 px-4 border border-border hover:bg-muted disabled:opacity-50 text-sm font-medium rounded-xl transition-colors"
              >
                <BookmarkPlus className="w-4 h-4" />
                Save as set
              </button>
            </div>

            {/* Save-as-set form */}
            {showSave && (
              <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">
                  Name this set ({selected.size} hashtags)
                </p>
                <div className="flex gap-2">
                  <input
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && setName.trim().length >= 2) saveSetMutation.mutate()
                    }}
                    placeholder="e.g. MH Day 2025"
                    className={`flex-1 ${inputClass}`}
                  />
                  <button
                    onClick={() => saveSetMutation.mutate()}
                    disabled={setName.trim().length < 2 || saveSetMutation.isPending}
                    className="flex items-center gap-1.5 h-10 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
                  >
                    {saveSetMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Saved sets ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Saved Sets</h3>
        </div>

        {setsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (sets ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No saved sets yet. Generate hashtags above and save them for reuse.
          </p>
        ) : (
          <div className="space-y-3">
            {(sets ?? []).map((set) => (
              <div key={set.id} className="rounded-xl border border-border bg-background p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{set.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {set.hashtags.length} hashtags
                      {set.platform && ` · ${set.platform}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => copyTags(set.hashtags)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy all hashtags"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteSetMutation.mutate(set.id)}
                      disabled={deleteSetMutation.isPending}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Delete set"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {set.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
