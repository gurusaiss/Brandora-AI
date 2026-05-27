# FREE_PLAN.md
# Brandora AI — Free vs Paid Analysis & Billing Guide

> **Short answer: YES, you can build and run the entire MVP with ₹0 / $0 spend.**
>
> This document explains exactly what is free, what costs money, how much,
> and the minimum keys you need right now to see the app working today.

---

## Table of Contents

1. [Can We Build This 100% Free?](#1-can-we-build-this-100-free)
2. [Minimum Keys Needed RIGHT NOW (to run locally)](#2-minimum-keys-needed-right-now)
3. [Complete Free Stack for Local Development](#3-complete-free-stack-for-local-development)
4. [Complete Free Stack for Production (deployed)](#4-complete-free-stack-for-production-deployed)
5. [Free Tier Limits — What to Watch](#5-free-tier-limits---what-to-watch)
6. [What Costs Money & How Much](#6-what-costs-money--how-much)
7. [When You Must Start Paying](#7-when-you-must-start-paying)
8. [Recommended Upgrade Path](#8-recommended-upgrade-path)
9. [Social Media API — Free vs Paid](#9-social-media-api---free-vs-paid)
10. [Monthly Cost Calculator](#10-monthly-cost-calculator)

---

## 1. Can We Build This 100% Free?

| Phase | Free? | Notes |
|-------|-------|-------|
| Local development | ✅ **100% Free** | Docker + Gemini free tier |
| MVP (first 50 users) | ✅ **100% Free** | Supabase + Upstash + Vercel free tiers |
| Growth (50–500 users) | ⚠️ **Mostly Free** | May need $5–25/month |
| Scale (500+ users) | 💰 **Paid needed** | AI costs grow with usage |

**Conclusion:** You can develop, test, demo, and even launch to your first 50 users with
absolutely zero spend. The only thing you need is a Google account to get the Gemini API key.

---

## 2. Minimum Keys Needed RIGHT NOW

To see the app fully working locally today, you need **just 1 key**:

### Step 1 — Get Google Gemini API Key (FREE, takes 2 minutes)

```
1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key → paste into .env as GOOGLE_AI_API_KEY
```

**Free limits:** 15 requests/minute · 1,500 requests/day · 1 million tokens/day
This is MORE than enough for development and early production.

### Step 2 — Database & Redis (ZERO setup, handled by Docker)

When you run `make dev`, Docker automatically starts:
- **PostgreSQL** on `localhost:5432` (local, no account needed)
- **Redis** on `localhost:6379` (local, no account needed)

These are already configured in `docker-compose.yml`. No Supabase account needed for local dev.

### Step 3 — Your complete `.env` to get started (copy this)

```env
# ============================================================
# MINIMUM .env TO RUN BRANDORA AI LOCALLY — NO PAID KEYS
# ============================================================

# Database — Docker handles this automatically (no account needed)
DATABASE_URL=postgresql+asyncpg://brandora:brandora_dev_password@localhost:5432/brandora_ai

# Redis — Docker handles this automatically (no account needed)
REDIS_URL=redis://localhost:6379/0

# JWT Secret — generate any random string (min 32 chars)
SECRET_KEY=brandora-ai-dev-secret-key-change-in-production-32chars

# AI — ONLY ONE KEY NEEDED: Google Gemini (FREE)
GOOGLE_AI_API_KEY=AIzaSy_YOUR_GEMINI_KEY_HERE
OPENAI_API_KEY=        # leave blank for now — Gemini handles everything
ANTHROPIC_API_KEY=     # leave blank for now

# App URLs
ENVIRONMENT=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Next.js public vars
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Brandora AI

# Leave everything else blank for now
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_BEARER_TOKEN=
SENTRY_DSN=
```

> **That's it.** With just `GOOGLE_AI_API_KEY` filled in, the entire content
> generation feature works. Everything else can wait.

---

## 3. Complete Free Stack for Local Development

| Service | Tool | Cost | Sign-up needed? |
|---------|------|------|-----------------|
| Database | PostgreSQL (Docker) | FREE | ❌ No |
| Cache/Queue | Redis (Docker) | FREE | ❌ No |
| AI — Primary | Google Gemini 1.5 Flash | FREE | ✅ Google account |
| AI — Fallback | Groq API (Llama 3.3, Qwen) | FREE | ✅ Groq account |
| Frontend | Next.js localhost | FREE | ❌ No |
| Backend | FastAPI localhost | FREE | ❌ No |
| Containers | Docker Desktop | FREE | ✅ Docker account |
| Code hosting | GitHub | FREE | ✅ GitHub account |
| **TOTAL** | | **$0/month** | |

### Getting Groq API Key (FREE backup AI)

```
1. Go to: https://console.groq.com/keys
2. Sign up with Google/GitHub
3. Create API key
4. Add to .env as: GROQ_API_KEY=gsk_...
```

Groq free models available: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`
These are excellent for content generation at zero cost.

---

## 4. Complete Free Stack for Production (Deployed)

When you're ready to deploy the app online (still free):

| Layer | Free Service | Free Limits |
|-------|-------------|-------------|
| **Frontend hosting** | Vercel | 100GB bandwidth/month, unlimited deploys |
| **Backend hosting** | Render.com | 750 hours/month (1 free web service) |
| **Database** | Supabase Free Tier | 500MB storage, 50,000 MAU, 2GB bandwidth |
| **Redis** | Upstash Free Tier | 10,000 commands/day, 256MB data |
| **AI** | Google Gemini Flash | 15 RPM, 1,500 RPD, 1M TPD |
| **CI/CD** | GitHub Actions | 2,000 minutes/month (public repo: unlimited) |
| **Monitoring** | Sentry Free | 5,000 errors/month |
| **Domain** | — | You need to buy (~₹800/year) |
| **TOTAL** | | **~$0/month** (just domain cost) |

### Getting Supabase (FREE database in cloud)

```
1. Go to: https://supabase.com
2. Sign up with GitHub
3. Click "New Project"
4. Choose "Free" plan
5. Set database password
6. Get from Settings → API:
   - Project URL → SUPABASE_URL
   - anon/public key → SUPABASE_ANON_KEY
   - service_role key → SUPABASE_SERVICE_KEY
7. Get from Settings → Database → Connection String:
   - URI (use the "Transaction" pooler URL) → DATABASE_URL
   - Replace [YOUR-PASSWORD] with your database password
```

### Getting Upstash Redis (FREE Redis in cloud)

```
1. Go to: https://upstash.com
2. Sign up with GitHub/Google
3. Create Database → Choose "Free" → Region: ap-south-1 (India)
4. Copy "UPSTASH_REDIS_REST_URL" — but use the Redis connection string:
   Settings → Details → "Redis Connection String"
   Format: rediss://:PASSWORD@ENDPOINT:PORT
5. Add to .env as REDIS_URL
```

### Deploying Frontend to Vercel (FREE)

```
1. Go to: https://vercel.com
2. Sign in with GitHub
3. "Import Project" → select your Brandora-AI repo
4. Set Root Directory to: frontend
5. Add ALL environment variables from your root .env
6. Deploy!
```

### Deploying Backend to Render.com (FREE)

```
1. Go to: https://render.com
2. Sign in with GitHub
3. "New Web Service" → connect Brandora-AI repo
4. Settings:
   - Root Directory: backend
   - Build Command: pip install -r requirements.txt
   - Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
5. Add environment variables from your .env
6. Deploy!

⚠️ Note: Render free tier spins down after 15 mins of inactivity.
   First request after spin-down takes ~30 seconds (cold start).
   Acceptable for MVP, upgrade to paid ($7/month) for production.
```

---

## 5. Free Tier Limits — What to Watch

### Google Gemini Flash (Your primary AI — FREE)

| Limit | Value | Impact |
|-------|-------|--------|
| Requests per minute | 15 RPM | Fine for single user |
| Requests per day | 1,500 RPD | ~50 content generations/day |
| Tokens per day | 1,000,000 TPD | ~3,000 LinkedIn posts/day |
| **Will you hit it?** | **Unlikely in MVP** | Fine until ~100 active users |

**What happens if you hit it?** The system gets a 429 error and Celery retries automatically.
In the code, the fallback chain goes: Gemini → GPT-4o (if key set) → error.

### Supabase Free Tier

| Limit | Value | Impact |
|-------|-------|--------|
| Database size | 500 MB | ~500,000 content records |
| Monthly active users | 50,000 | More than enough for MVP |
| Storage | 1 GB | Profile images, assets |
| Bandwidth | 5 GB/month | Fine until 500+ users |
| **Paused after** | 1 week inactivity | Resume via dashboard |

> ⚠️ **Important:** Supabase free projects pause after 1 week of inactivity.
> This is the main gotcha. Just visit the Supabase dashboard to unpause.

### Upstash Redis Free Tier

| Limit | Value | Impact |
|-------|-------|--------|
| Commands per day | 10,000 | ~333 content generations/day |
| Max data size | 256 MB | Fine for MVP |
| **Will you hit it?** | **Yes, around 50 DAU** | Upgrade at $10/month then |

### Vercel Free Tier

| Limit | Value | Impact |
|-------|-------|--------|
| Bandwidth | 100 GB/month | ~500,000 page views |
| Build minutes | 6,000 min/month | ~200 deploys |
| Serverless functions | 100 GB-hrs | Fine for Next.js |

### Render.com Free Tier

| Limit | Value | Impact |
|-------|-------|--------|
| Monthly hours | 750 hrs | 1 service = always-on |
| RAM | 512 MB | FastAPI runs fine |
| Cold start | ~30 seconds | Annoying but OK for MVP |

---

## 6. What Costs Money & How Much

### AI API Costs (Per generation)

| Model | Input (per 1K tokens) | Output (per 1K tokens) | 1 LinkedIn post (~500 tokens) |
|-------|----------------------|----------------------|-------------------------------|
| **Gemini 1.5 Flash** | **FREE** | **FREE** | **$0.000** |
| Gemini 1.5 Pro | $0.00125 | $0.005 | $0.003 |
| GPT-4o mini | $0.00015 | $0.0006 | $0.0004 |
| GPT-4o | $0.0025 | $0.01 | $0.006 |
| Claude 3 Haiku | $0.00025 | $0.00125 | $0.0008 |
| Claude 3.5 Sonnet | $0.003 | $0.015 | $0.009 |

**Recommendation:** Start with Gemini Flash (free). When you need better quality for CSR stories
or high-value posts, use GPT-4o mini ($0.0004 per post = basically free at small scale).

### New Account Free Credits (Use these first!)

| Platform | Free Credit | Expiry |
|----------|------------|--------|
| OpenAI | $5.00 | 3 months |
| Anthropic | $5.00 | Varies |
| Google AI | FREE tier (no credit card for Flash) | Ongoing |
| Groq | FREE tier | Ongoing |
| AWS | $300 credit | 12 months |
| GCP | $300 credit | 90 days |
| Azure | $200 credit | 30 days |

> 💡 **Strategy:** Register new accounts to claim free credits for OpenAI and Anthropic.
> Use them for testing premium models. Then stick to Gemini Flash for production.

### Infrastructure Costs (When You Need to Scale)

| Service | Free Tier | Paid Starts At | When to Upgrade |
|---------|----------|---------------|-----------------|
| Supabase | Free (500MB) | $25/month (Pro) | >500MB data or pausing annoys you |
| Upstash | Free (10K cmd/day) | $10/month | >50 daily active users |
| Render.com backend | Free (cold starts) | $7/month | When cold starts hurt UX |
| Vercel | Free (100GB BW) | $20/month | >500K page views/month |
| Railway | $5 credit/month | $5/month (hobby) | If you prefer Railway over Render |
| Custom domain | — | ~₹800–1,200/year | When you want brandoraai.com |

### Social Media API Costs

| Platform | Free Access | Paid Tier |
|----------|------------|-----------|
| LinkedIn | Free (basic posting via OAuth) | Not needed for MVP |
| Instagram/Meta | Free (Graph API basic) | Not needed for MVP |
| Twitter/X | Free (1,500 posts/month write) | Basic: $100/month |
| Facebook Pages | Free | Not needed for MVP |

> ⚠️ **Twitter/X note:** The free tier allows reading but severely limits writes.
> For scheduling + posting, you need the Basic tier at $100/month.
> **Skip Twitter API for MVP** — just generate content, copy-paste manually.

---

## 7. When You Must Start Paying

### Timeline to First Dollar Spent

```
Month 1–3  (0–50 users):    $0/month     — all free tiers
Month 4–6  (50–200 users):  $7–17/month  — Render paid + Upstash paid
Month 7–9  (200–500 users): $25–50/month — Supabase Pro + AI credits
Month 10+  (500+ users):    $50–200/month — Scale infrastructure
```

### Exact Trigger Points

| Event | Action Needed | Monthly Cost |
|-------|--------------|-------------|
| Supabase database hits 500MB | Upgrade to Supabase Pro | +$25 |
| Redis hits 10K commands/day | Upgrade to Upstash Pay-as-you-go | +$10 |
| Backend cold starts hurt UX | Upgrade Render to Starter | +$7 |
| Gemini hits 1,500 RPD | Add GPT-4o mini fallback | +$5–20 |
| Twitter scheduling needed | Twitter Basic API | +$100 |
| Need custom domain | Buy domain (once) | +₹800/year |

---

## 8. Recommended Upgrade Path

### Phase 0 — Today (Local Only)
```
Cost: $0
Stack: Docker (local PG + Redis) + Gemini Flash
What you can do: Full content generation locally, test all features
```

### Phase 1 — First Demo/Launch (Months 1–3)
```
Cost: $0/month + ₹800/year domain
Stack:
  ✅ Vercel (frontend) — free
  ✅ Render.com (backend) — free (cold starts ok)
  ✅ Supabase (database) — free
  ✅ Upstash (Redis) — free
  ✅ Gemini Flash (AI) — free
  ✅ GitHub Actions (CI/CD) — free
  💰 Domain name — ₹800/year (~₹70/month)
```

### Phase 2 — First Paying Users (Months 4–6)
```
Cost: ~$17/month
Stack:
  ✅ Vercel Pro or continue free
  💰 Render Starter ($7/month) — no cold starts
  ✅ Supabase free (still ok at <500MB)
  💰 Upstash Pay-as-you-go (~$10/month)
  ✅ Gemini Flash free
  Optional: GPT-4o mini for quality boost (~$5/month)
```

### Phase 3 — Real Growth (Months 7–12)
```
Cost: ~$50–80/month
Stack:
  💰 Vercel Pro ($20/month)
  💰 Render Standard ($25/month)
  💰 Supabase Pro ($25/month)
  💰 Upstash Pro (~$10/month)
  💰 AI credits (Gemini Pro + GPT-4o mini) (~$20/month)
  💰 Sentry Team ($26/month) — optional
```

---

## 9. Social Media API — Free vs Paid

### LinkedIn API (Free for basic use ✅)

```
What's free:
  - OAuth authentication
  - Post text content to member feed
  - Post images + documents
  - Read own post analytics
  - Share articles

What needs approval (but still free):
  - LinkedIn Partner Program (for company page posting)
  - Marketing Developer Platform (for ads)

How to get started:
  1. Go to: https://www.linkedin.com/developers/apps
  2. Create app → fill details
  3. Request "Sign In with LinkedIn" + "Share on LinkedIn" products
  4. Get Client ID + Secret → add to .env
  5. Approval: usually 1–3 days
```

### Instagram / Meta Graph API (Free ✅)

```
What's free:
  - Post photos and videos to Business/Creator accounts
  - Read post insights
  - Manage hashtags

Requirements:
  - Must be a Business or Creator Instagram account
  - Must have a connected Facebook Page
  - Facebook Developer App (free)

How to get started:
  1. Go to: https://developers.facebook.com/apps/
  2. Create App → Business type
  3. Add "Instagram Graph API" product
  4. Get App ID + Secret → add to .env
  5. App Review needed for some permissions (1–2 weeks)
```

### Twitter/X API (Partially free ⚠️)

```
Free tier:
  - 1,500 tweets/month write limit (very low!)
  - Read access (unlimited)
  
Basic ($100/month):
  - 10,000 tweets/month
  - Full write access

Recommendation for MVP:
  Skip Twitter API entirely for now.
  Generate content → user copies and pastes manually.
  Add scheduling when you have paying users who need it.
  
How to get free tier access:
  1. Go to: https://developer.twitter.com/en/portal/dashboard
  2. Sign up for Developer account (requires phone verification)
  3. Create App → Free tier
  4. Get API Key, Secret, Bearer Token → add to .env
```

---

## 10. Monthly Cost Calculator

### Scenario A: Local Development Only
```
Infrastructure:  $0    (Docker local)
AI:             $0    (Gemini free)
Total:          $0/month
```

### Scenario B: MVP Deployed (0–50 users)
```
Vercel (frontend):    $0    (free tier)
Render (backend):     $0    (free tier, cold starts)
Supabase (DB):        $0    (free tier)
Upstash (Redis):      $0    (free tier)
Gemini Flash (AI):    $0    (free tier)
Domain:               ₹70   (~$0.85/month, ~₹800/year)
Total:                ₹70/month  (~$0.85/month)
```

### Scenario C: Soft Launch (50–200 users)
```
Vercel:           $0
Render Starter:   $7    (no cold starts)
Supabase:         $0    (still under limits)
Upstash:          $10   (paid tier)
Gemini Flash:     $0
GPT-4o mini:      $5    (optional quality boost)
Domain:           ₹70
Total:            ~$22/month  (~₹1,840/month)
```

### Scenario D: Growth (200–500 users)
```
Vercel Pro:       $20
Render Standard:  $25
Supabase Pro:     $25
Upstash Pro:      $10
Gemini Pro:       $20   (mix of Flash + Pro)
Sentry:           $0    (free tier)
Total:            ~$100/month  (~₹8,350/month)
```

### Scenario E: Scale (500+ users, first revenue)
```
Vercel Pro:        $20
Railway/AWS ECS:   $100
Supabase Pro:      $25
Upstash Pro:       $20
AI Credits:        $50–200  (depends on usage)
Twitter Basic:     $100   (only if needed)
Monitoring:        $26    (Sentry)
Total:             ~$350/month  (~₹29,000/month)
Revenue at this stage: Should be ~$500–2,000/month (easily covers costs)
```

---

## Summary: Do This Right Now (Free Setup in 15 Minutes)

```
Step 1  (2 min):  Get Groq API key (PRIMARY AI — free, fast)
                  → https://console.groq.com/keys
                  → Sign up → Create API Key → copy it

Step 2  (2 min):  Get Gemini API key (FALLBACK AI — free)
                  → https://aistudio.google.com/app/apikey
                  → Sign in with Google → Create API Key → copy it

Step 3  (1 min):  Copy root .env
                  → cp .env.example .env

Step 4  (2 min):  Fill in these 3 lines in .env:
                  GROQ_API_KEY=gsk_your_key_here
                  GOOGLE_AI_API_KEY=AIza_your_key_here
                  SECRET_KEY=any-random-32-char-string-here

Step 5  (1 min):  Start everything
                  → make dev

Step 6  (2 min):  Run database setup
                  → make migrate

Step 7  (0 min):  Open the app
                  → http://localhost:3000        (main UI)
                  → http://localhost:8000/docs   (API explorer)
                  → http://localhost:5555        (Celery job monitor)

Total time: ~10 minutes. Total cost: $0.
```

---

*Last updated: May 2026 — prices may change. Always check provider websites for current pricing.*
