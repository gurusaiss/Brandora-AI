/**
 * next.config.ts
 *
 * Environment variables come from the single root .env file.
 *
 * Local dev:   `npm run dev` uses dotenv-cli to load ../.env before Next starts.
 * Docker:      docker-compose passes root .env vars via env_file injection.
 * Railway/CI:  vars are injected as environment variables directly.
 *
 * This file adds a loadEnvConfig safety-net so Next.js IDE tooling
 * (e.g. type-checking outside npm scripts) also picks up the root .env.
 */

import path from 'path'
import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

// Load root .env when running next.config.ts directly (e.g. `next build` called
// from the frontend/ directory without dotenv-cli prefix).
loadEnvConfig(path.resolve(__dirname, '..'))

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  // Explicitly expose NEXT_PUBLIC_* vars so they are available both server-side
  // and in the browser bundle. Values are read from the already-loaded env.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'Brandora AI',
  },
}

export default nextConfig
