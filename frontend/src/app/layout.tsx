import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import * as Tooltip from '@radix-ui/react-tooltip'
import { QueryProvider } from '@/components/providers/query-provider'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Brandora AI',
    template: '%s | Brandora AI',
  },
  description:
    'AI-powered social media content platform for sanitation & menstrual hygiene NGOs and CSR organizations.',
  keywords: [
    'Brandora AI',
    'social media',
    'content generation',
    'NGO',
    'CSR',
    'menstrual hygiene',
    'sanitation',
    'AI content',
  ],
  authors: [{ name: 'Brandora AI' }],
  openGraph: {
    type: 'website',
    title: 'Brandora AI',
    description: 'AI-powered social media content for social impact',
    siteName: 'Brandora AI',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <Tooltip.Provider delayDuration={300}>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                },
                success: {
                  iconTheme: {
                    primary: 'hsl(var(--accent))',
                    secondary: 'white',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'hsl(var(--destructive))',
                    secondary: 'white',
                  },
                },
              }}
            />
            </Tooltip.Provider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
