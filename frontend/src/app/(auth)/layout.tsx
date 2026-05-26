import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-teal-50/30 dark:from-slate-950 dark:via-purple-950/20 dark:to-teal-950/20 flex">
      {/* Left panel — brand imagery */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-primary-600 via-primary-700 to-accent relative overflow-hidden flex-col justify-between p-12">
        {/* Background mesh */}
        <div className="absolute inset-0 bg-mesh-gradient opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Brandora AI
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-white text-4xl xl:text-5xl font-bold leading-tight">
              Amplify your social
              <br />
              impact with AI
            </h1>
            <p className="text-white/75 text-lg max-w-md leading-relaxed">
              Generate compelling content for LinkedIn, Instagram, and more —
              tailored for NGOs, CSR organizations, and social impact leaders.
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-4">
          {[
            {
              icon: '✨',
              title: 'AI-powered content',
              desc: 'Generate platform-specific posts in seconds',
            },
            {
              icon: '🎯',
              title: 'Brand voice training',
              desc: 'AI learns your organization\'s unique tone',
            },
            {
              icon: '📅',
              title: 'Awareness day calendar',
              desc: 'Never miss a relevant impact moment',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4"
            >
              <span className="text-xl flex-shrink-0">{feature.icon}</span>
              <div>
                <p className="text-white font-medium">{feature.title}</p>
                <p className="text-white/65 text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
