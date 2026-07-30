import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export const metadata = { title: 'Privacy Policy — Brandora AI' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">Brandora AI</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2 text-sm">Last updated: July 2025</p>
        </div>

        {[
          {
            title: '1. Information We Collect',
            body: `We collect information you provide directly, such as your name, email address, and organization details when you register. We also collect content you generate, usage data, and technical information like IP address and browser type.`,
          },
          {
            title: '2. How We Use Your Information',
            body: `We use your information to provide and improve the Service, generate AI content tailored to your brand profile, send service-related communications, and comply with legal obligations. We do not sell your personal data to third parties.`,
          },
          {
            title: '3. AI Content Processing',
            body: `Content you input for generation (topics, brand voice, mission statements) is sent to AI providers (such as Groq, Google AI, or OpenAI) to generate content. These providers process data according to their own privacy policies. We do not use your content to train our AI models without explicit consent.`,
          },
          {
            title: '4. Social Media Integrations',
            body: `When you connect social media accounts (Facebook, Instagram, LinkedIn, Twitter/X), we store access tokens to enable posting on your behalf. These tokens are encrypted at rest. We only access the permissions you explicitly grant and only post content you initiate.`,
          },
          {
            title: '5. Data Storage',
            body: `Your data is stored on Supabase PostgreSQL servers hosted on AWS infrastructure. We implement industry-standard security measures including encryption in transit (TLS) and at rest.`,
          },
          {
            title: '6. Data Retention',
            body: `We retain your data for as long as your account is active. You may request deletion of your account and associated data by contacting us at privacy@brandoraai.com. We will process deletion requests within 30 days.`,
          },
          {
            title: '7. Cookies',
            body: `We use essential cookies for authentication. We do not use tracking or advertising cookies. You can disable cookies in your browser, but this may affect Service functionality.`,
          },
          {
            title: '8. Your Rights',
            body: `You have the right to access, correct, or delete your personal data. You may request a copy of your data or object to processing. Contact us at privacy@brandoraai.com to exercise these rights.`,
          },
          {
            title: '9. Third-Party Services',
            body: `We use third-party services including Supabase (database), Groq/Google AI/OpenAI (AI generation), and Redis (caching). These services have their own privacy policies and we encourage you to review them.`,
          },
          {
            title: '10. Changes to This Policy',
            body: `We may update this Privacy Policy. We will notify you of significant changes by email. Your continued use of the Service after notification constitutes acceptance of the updated policy.`,
          },
          {
            title: '11. Contact Us',
            body: `For privacy questions or requests, contact our Data Protection contact at privacy@brandoraai.com.`,
          },
        ].map(({ title, body }) => (
          <section key={title} className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-muted-foreground leading-relaxed">{body}</p>
          </section>
        ))}

        <div className="pt-4 border-t border-border flex gap-4 text-sm">
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
          <Link href="/login" className="text-muted-foreground hover:text-foreground">Back to app</Link>
        </div>
      </main>
    </div>
  )
}
