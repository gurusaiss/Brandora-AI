'use client'

import { Check, Sparkles, Zap, Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'Perfect for getting started',
    generations: 20,
    features: [
      '20 AI content generations / month',
      'All 7 content formats',
      'Meta (Facebook + Instagram) publishing',
      'Campaign scheduler',
      'Brand profile',
      'Festival calendar',
      '1 team member',
    ],
    cta: 'Current plan',
    highlight: false,
    tier: 'free',
  },
  {
    name: 'Pro',
    price: '₹2,499',
    period: 'per month',
    description: 'For growing NGOs and CSR teams',
    generations: 150,
    features: [
      '150 AI content generations / month',
      'Everything in Free',
      'LinkedIn + Twitter publishing',
      'Image generation (DALL-E 3)',
      'Content repurposing',
      'Advanced analytics',
      'Up to 5 team members',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
    tier: 'pro',
  },
  {
    name: 'Growth',
    price: '₹7,499',
    period: 'per month',
    description: 'For large organizations with high volume',
    generations: 500,
    features: [
      '500 AI content generations / month',
      'Everything in Pro',
      'Multiple brand profiles',
      'Custom AI model access',
      'API access',
      'Unlimited team members',
      'Dedicated onboarding',
      'SLA support',
    ],
    cta: 'Contact sales',
    highlight: false,
    tier: 'growth',
  },
]

export default function BillingPage() {
  const { organization } = useAuthStore()
  const currentTier = organization?.subscription_tier ?? 'free'

  const usedPct = Math.min(
    ((organization?.ai_generations_used ?? 0) / Math.max(organization?.ai_generations_limit ?? 20, 1)) * 100,
    100,
  )

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <div>
        <h2 className="text-xl font-bold text-foreground">Billing & Plans</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your subscription and upgrade your plan
        </p>
      </div>

      {/* Current usage */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Current Usage</h3>
          <span className="ml-auto text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {currentTier} plan
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">AI Generations this month</span>
            <span className="font-semibold text-foreground">
              {organization?.ai_generations_used ?? 0} / {organization?.ai_generations_limit ?? 20}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usedPct >= 90 ? 'bg-destructive' : usedPct >= 70 ? 'bg-amber-500' : 'bg-primary-500'
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          {usedPct >= 90 && (
            <p className="text-xs text-destructive font-medium">
              You&apos;re almost out of generations. Upgrade now to keep creating content.
            </p>
          )}
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier
          return (
            <div
              key={plan.tier}
              className={`relative bg-card border rounded-2xl p-6 flex flex-col gap-5 ${
                plan.highlight
                  ? 'border-primary-400 dark:border-primary-600 shadow-lg shadow-primary-500/10'
                  : 'border-border'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                    Most popular
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  {plan.tier === 'free' && <Building2 className="w-4 h-4 text-muted-foreground" />}
                  {plan.tier === 'pro'  && <Zap className="w-4 h-4 text-primary" />}
                  {plan.tier === 'growth' && <Sparkles className="w-4 h-4 text-amber-500" />}
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>

              <div>
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent}
                onClick={() => {
                  if (plan.tier === 'growth') {
                    window.location.href = 'mailto:sales@brandoraai.com?subject=Brandora AI Growth Plan'
                  } else {
                    alert('Payment integration coming soon. Please contact support@brandoraai.com to upgrade.')
                  }
                }}
                className={`w-full h-10 rounded-xl text-sm font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : plan.highlight
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}
              >
                {isCurrent ? 'Current plan' : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        All prices are in INR and inclusive of GST. Cancel or change plans at any time.{' '}
        <a href="mailto:support@brandoraai.com" className="underline text-primary hover:text-primary/80">
          Contact support
        </a>
      </p>
    </div>
  )
}
