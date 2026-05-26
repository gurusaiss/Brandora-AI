# CLAUDE.md — Brandora AI Codebase Guide

> This file is the authoritative guide for AI assistants (and human developers) working in the Brandora AI codebase.
> Read this before touching any code. Refer back when something feels unclear.

---

## Table of Contents

1. [Project Overview & Context](#1-project-overview--context)
2. [Tech Stack & Architecture Decisions](#2-tech-stack--architecture-decisions)
3. [Repository Structure](#3-repository-structure)
4. [Development Conventions](#4-development-conventions)
5. [Key Architectural Decisions](#5-key-architectural-decisions)
6. [AI Integration Architecture](#6-ai-integration-architecture)
7. [Database Patterns (Supabase)](#7-database-patterns-supabase)
8. [Frontend Patterns (Next.js)](#8-frontend-patterns-nextjs)
9. [Backend Patterns (FastAPI)](#9-backend-patterns-fastapi)
10. [Content Pipeline Architecture](#10-content-pipeline-architecture)
11. [Brand Voice System](#11-brand-voice-system)
12. [Testing Strategy](#12-testing-strategy)
13. [Environment Variables & Secrets](#13-environment-variables--secrets)
14. [Development Tasks](#14-development-tasks)
15. [Adding New Content Generation Features](#15-adding-new-content-generation-features)
16. [Adding New Social Media Platforms](#16-adding-new-social-media-platforms)
17. [Prompt Engineering Guidelines](#17-prompt-engineering-guidelines)
18. [Important Gotchas](#18-important-gotchas)
19. [Deployment Architecture](#19-deployment-architecture)

---

## 1. Project Overview & Context

### What is Brandora AI?

Brandora AI is a **vertical AI SaaS platform** for social impact organizations — specifically those working in sanitation, menstrual hygiene (MHM), and WASH (Water, Sanitation, Hygiene). It is NOT a general-purpose social media tool.

**What it does:**
- Generates culturally appropriate, domain-expert social media content for LinkedIn, Instagram, Twitter/X, and Facebook
- Transforms raw program impact data into compelling multi-platform stories
- Manages campaign calendars around awareness days (World Menstrual Hygiene Day, World Toilet Day, etc.)
- Schedules and publishes content directly to social platforms
- Tracks performance analytics
- Provides founder personal branding tools for thought leadership

**What makes it different:**
- Deep domain training in MHM/WASH/sanitation communication norms
- Cultural sensitivity layer for content involving menstruation
- Hindi-first content generation (not just translation)
- CSR compliance-aware content (India MCA CSR-1)
- Built for NGO program officers, not marketing teams

### Who uses it?
- NGO Program Directors / Communications Leads
- Corporate CSR Managers (India Section 135)
- Social Enterprise Founders
- Social Media Managers at MHM/WASH organizations
- INGO country communications teams

### Technical context
- **Domain:** High-sensitivity AI output — menstrual health content requires careful safety checks
- **Scale:** Designed for 5,000 concurrent organizations, 50,000 posts/day by Year 2
- **Multi-model:** Routes requests across OpenAI, Anthropic, Google based on task complexity and cost
- **Multi-language:** English primary, Hindi critical, Tamil/Bengali/Kannada roadmap

---

## 2. Tech Stack & Architecture Decisions

### Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS

**Why Next.js App Router:**
- Server Components reduce client JS bundle — critical for NGO users on slow connections in India
- Built-in API routes for lightweight proxy calls (avoid CORS issues with AI providers)
- Streaming via React Suspense for AI content generation (users see content appear progressively)
- Vercel deployment with edge network — sub-100ms load times across India

**Why TypeScript:**
- Prevents entire categories of bugs in multi-developer environment
- Self-documenting API contracts between frontend and backend
- Type safety across the AI response schemas (structured outputs)
- All AI response types defined in `types/ai.ts` — never use `any`

**Why Tailwind CSS:**
- Consistent design system without maintaining a custom component library
- JIT mode — tiny bundle, only includes used classes
- Paired with Shadcn UI (copy-paste component patterns — we own the code, no dependency risk)

**Component library: Shadcn UI**
- NOT installed as a package — components live in `/components/ui/`
- Run `npx shadcn-ui@latest add [component]` to add new base components
- Then customize freely — we own these files

---

### Backend: FastAPI + Python 3.12

**Why FastAPI:**
- Native async/await — critical for parallel AI API calls (we call 3-5 models simultaneously)
- Pydantic models throughout — input validation + output serialization in one step
- Automatic OpenAPI docs at `/docs` — useful for frontend team integration
- Python ecosystem: LangChain, Anthropic SDK, OpenAI SDK, Google GenAI — all first-class

**Why Python (not Node.js for backend):**
- AI/ML ecosystem is Python-native
- LangChain, Hugging Face, text processing libraries (PyMuPDF, langdetect) — no Node equivalents
- Future fine-tuning and model training will be Python

---

### Database: PostgreSQL via Supabase

**Why Supabase:**
- Managed PostgreSQL with Row-Level Security (RLS) — critical for multi-tenant data isolation
- Built-in auth (handles JWT, OAuth, email magic links) — don't reinvent this
- Real-time subscriptions (Postgres CDC) — used for live collaboration features
- Storage for media assets (profile images, uploaded reports)
- Edge Functions for lightweight serverless tasks
- Mumbai region — data residency for India compliance

**Why PostgreSQL (not MongoDB/DynamoDB):**
- Relational data with complex joins (posts → campaigns → organizations → users)
- JSONB columns where schema flexibility needed (voice profiles, AI configs, platform metadata)
- SQL is well-understood; junior devs don't need to learn a new query language
- Full-text search via `pg_trgm` and `to_tsvector` — used for content search

---

### Task Queue: Redis + Celery

**Why Celery + Redis:**
- AI generation takes 8-20 seconds — must be async, never in HTTP request
- Social publishing must run on exact schedule — cron-style Celery Beat
- Multiple worker pools: AI workers (CPU-bound) vs. publishing workers (I/O-bound) vs. analytics workers
- Redis also used for caching (prompt cache, hashtag cache, session data)

**Queue design:**
```
ai_generation_queue     — Priority: high, workers: 4, timeout: 60s
social_publish_queue    — Priority: critical, workers: 2, timeout: 30s
analytics_queue         — Priority: low, workers: 2, timeout: 120s
email_queue             — Priority: medium, workers: 1, timeout: 30s
```

---

### AI Providers: OpenAI + Anthropic + Google Gemini

**Why multi-model (not just OpenAI):**
- Cost optimization: route simple tasks to cheaper models
- Reliability: if one provider has an outage, fall back to another
- Capability matching: Claude is better for narrative/tone; GPT-4o for structured output; Gemini Flash for fast/cheap classification
- Vendor lock-in risk mitigation: we are never dependent on a single AI provider

**Model routing is in `backend/services/ai_router.py`** — all AI calls go through this, never directly to provider SDKs.

---

## 3. Repository Structure

```
brandora-ai/
├── dashboard/                   ← Next.js 14 frontend
│   ├── app/
│   │   ├── (auth)/              ← Auth pages (login, register, forgot-password)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx       ← Centered card layout for auth pages
│   │   ├── (dashboard)/         ← Protected main app routes
│   │   │   ├── layout.tsx       ← Sidebar + Topbar wrapper
│   │   │   ├── page.tsx         ← Home dashboard
│   │   │   ├── create/          ← Content Studio
│   │   │   ├── calendar/        ← Content Calendar
│   │   │   ├── campaigns/       ← Campaign management
│   │   │   ├── analytics/       ← Analytics dashboard
│   │   │   ├── founder-hub/     ← Founder personal branding
│   │   │   ├── settings/        ← Org settings, brand voice, social connections
│   │   │   │   ├── brand-voice/
│   │   │   │   ├── team/
│   │   │   │   └── connections/
│   │   │   └── content-bank/    ← All drafts and published content
│   │   ├── api/                 ← Next.js API routes (thin proxy to backend)
│   │   │   └── [...]/route.ts
│   │   ├── layout.tsx           ← Root layout (fonts, providers)
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  ← Shadcn base components (own these)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── content/             ← Content creation components
│   │   │   ├── ContentStudio.tsx
│   │   │   ├── PlatformPreview.tsx
│   │   │   ├── VoiceSelector.tsx
│   │   │   └── GenerationLoader.tsx
│   │   ├── calendar/
│   │   │   ├── ContentCalendar.tsx
│   │   │   └── CalendarDayCell.tsx
│   │   ├── campaigns/
│   │   ├── analytics/
│   │   │   ├── KpiCard.tsx
│   │   │   └── AnalyticsCharts.tsx
│   │   └── shared/              ← Truly shared across sections
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        ← Browser Supabase client
│   │   │   └── server.ts        ← Server Supabase client (SSR)
│   │   ├── api/                 ← Typed API call functions
│   │   │   ├── content.ts       ← Content generation API calls
│   │   │   ├── campaigns.ts
│   │   │   └── analytics.ts
│   │   ├── types.ts             ← All TypeScript types (source of truth)
│   │   └── utils.ts             ← Shared utilities (cn, formatDate, etc.)
│   ├── hooks/                   ← Custom React hooks
│   │   ├── useContentGeneration.ts
│   │   ├── useCalendar.ts
│   │   └── useAuth.ts
│   ├── middleware.ts             ← Auth middleware (protects dashboard routes)
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     ← FastAPI Python backend
│   ├── main.py                  ← FastAPI app entry point
│   ├── config.py                ← Settings (Pydantic BaseSettings)
│   ├── database.py              ← Supabase async client setup
│   ├── auth/
│   │   ├── dependencies.py      ← FastAPI dependencies (get_current_user, require_role)
│   │   └── router.py            ← /auth endpoints
│   ├── routers/                 ← All API route handlers
│   │   ├── content.py           ← Content generation endpoints
│   │   ├── campaigns.py
│   │   ├── scheduling.py
│   │   ├── analytics.py
│   │   ├── organizations.py
│   │   └── social_connections.py
│   ├── services/                ← Business logic (no DB calls here — use repositories)
│   │   ├── ai_router.py         ← Multi-model AI routing (ALL AI calls go through here)
│   │   ├── content_generator.py ← Content generation orchestration
│   │   ├── brand_voice.py       ← Voice profile management
│   │   ├── safety_checker.py    ← Content safety classification
│   │   ├── hashtag_engine.py    ← Hashtag recommendation
│   │   ├── campaign_builder.py  ← Campaign generation logic
│   │   ├── repurposer.py        ← Content repurposing pipeline
│   │   └── platform_publishers/ ← Platform-specific publishing
│   │       ├── linkedin.py
│   │       ├── instagram.py
│   │       ├── twitter.py
│   │       └── facebook.py
│   ├── repositories/            ← Database access layer
│   │   ├── posts.py
│   │   ├── campaigns.py
│   │   ├── organizations.py
│   │   └── analytics.py
│   ├── workers/                 ← Celery task definitions
│   │   ├── celery_app.py        ← Celery configuration
│   │   ├── ai_tasks.py          ← Async AI generation tasks
│   │   ├── publish_tasks.py     ← Scheduled publishing tasks
│   │   └── analytics_tasks.py  ← Analytics aggregation tasks
│   ├── prompts/                 ← All prompt templates
│   │   ├── base.py              ← Base system prompts
│   │   ├── linkedin.py
│   │   ├── instagram.py
│   │   ├── twitter.py
│   │   ├── impact_story.py
│   │   ├── campaign.py
│   │   ├── safety.py
│   │   └── hindi.py             ← Hindi-specific prompts
│   ├── models/                  ← Pydantic models (request/response)
│   │   ├── content.py
│   │   ├── campaign.py
│   │   ├── organization.py
│   │   └── analytics.py
│   ├── migrations/              ← SQL migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_voice_profiles.sql
│   │   └── ...
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── requirements.txt
│   └── pyproject.toml
│
├── supabase/                    ← Supabase project config
│   ├── migrations/              ← Supabase migration files (linked to backend/migrations)
│   ├── functions/               ← Supabase Edge Functions
│   └── seed.sql                 ← Development seed data
│
├── .env.example                 ← Template for required env vars
├── docker-compose.yml           ← Local development (Redis, workers)
└── CLAUDE.md                    ← This file
```

---

## 4. Development Conventions

### 4.1 Naming Conventions

**TypeScript/React (frontend):**
```typescript
// Components: PascalCase, descriptive
ContentStudio.tsx
PlatformPreview.tsx
VoiceProfileWizard.tsx

// Hooks: camelCase with "use" prefix
useContentGeneration.ts
useBrandVoice.ts

// API functions: camelCase, verb-noun
generateContent()
fetchCampaigns()
schedulePost()

// Types: PascalCase interfaces, descriptive
interface ContentGenerationRequest { ... }
interface BrandVoiceProfile { ... }
type SocialPlatform = 'linkedin' | 'instagram' | 'twitter' | 'facebook'

// Constants: SCREAMING_SNAKE_CASE
const MAX_HASHTAGS = 30
const DEFAULT_POSTING_TIMES = { ... }
```

**Python/FastAPI (backend):**
```python
# Files: snake_case
content_generator.py
brand_voice.py
ai_router.py

# Classes: PascalCase
class ContentGenerator:
class BrandVoiceProfile:
class AIRouter:

# Functions: snake_case, descriptive
async def generate_linkedin_post(...)
async def check_content_safety(...)
def build_campaign_calendar(...)

# Constants: SCREAMING_SNAKE_CASE
MAX_RETRIES = 3
DEFAULT_CAMPAIGN_DURATION_DAYS = 14

# Pydantic models: PascalCase with suffix
class ContentGenerationRequest(BaseModel):
class ContentGenerationResponse(BaseModel):
class BrandVoiceConfig(BaseModel):
```

### 4.2 File Organization Principles

1. **Co-locate feature code.** Components, hooks, and types related to a feature belong near each other.
2. **Shared code goes in `lib/` or `shared/`.** If more than 2 places use it, extract it.
3. **API routes are thin proxies.** Route handlers should call service functions, never contain business logic.
4. **Services are business logic, repositories are data access.** Never call Supabase directly from a service — use repositories.
5. **Prompts are code.** They live in `backend/prompts/` and are versioned. Never define prompt strings inline in service functions.

### 4.3 Code Style

**Frontend:**
- ESLint config: `eslint-config-next` + custom rules
- No default exports from component files (named exports only, except for Next.js page files which require default export)
- React Server Components by default; add `"use client"` only when needed (event handlers, hooks, browser APIs)
- Tailwind class ordering: use Prettier + Tailwind plugin

**Backend:**
- Black formatter (line length 88)
- isort for imports
- Ruff for linting
- Type hints on all function parameters and return types
- Docstrings on all public service functions (Google style)

```python
async def generate_linkedin_post(
    input_data: ImpactData,
    org_profile: OrgProfile,
    voice_profile: BrandVoiceProfile,
) -> LinkedInPost:
    """Generate a LinkedIn post from impact data using the org's brand voice.

    Args:
        input_data: Raw impact metrics and context from the program.
        org_profile: Organization metadata including type and focus area.
        voice_profile: Brand voice configuration for tone adaptation.

    Returns:
        A LinkedInPost object with content, hashtags, and quality score.

    Raises:
        ContentGenerationError: If AI generation fails after max retries.
        SafetyCheckError: If content fails safety validation.
    """
```

### 4.4 Git Conventions

**Branch naming:**
```
feature/content-repurposing-engine
fix/linkedin-publish-timeout
chore/update-dependencies
refactor/voice-profile-storage
docs/add-campaign-api-docs
```

**Commit messages (Conventional Commits):**
```
feat: add hindi content generation for instagram posts
fix: resolve linkedin oauth token refresh failure
perf: cache hashtag clusters in redis for 24h
refactor: extract prompt templates to separate module
test: add integration tests for content safety checker
docs: update CLAUDE.md with new platform publisher pattern
```

**Branch strategy:**
- `main` — production-ready code, protected
- `dev` — integration branch for active development
- Feature branches from `dev`; PR to `dev`; `dev` → `main` on release

---

## 5. Key Architectural Decisions

### Decision 1: AI calls are always async via Celery, never in HTTP request

**Rule:** No AI generation call blocks an HTTP response.

The HTTP endpoint immediately returns a job ID. The Celery worker processes the AI call. The frontend polls for completion (or uses Supabase real-time subscription for push notification).

```python
# CORRECT: Return job ID immediately
@router.post("/content/generate")
async def generate_content(request: ContentRequest, user: User = Depends(get_current_user)):
    job = await create_generation_job(request, user)
    task = generate_content_task.delay(job.id)  # Celery async
    return {"job_id": job.id, "status": "queued"}

# WRONG: Never do this
@router.post("/content/generate")
async def generate_content(request: ContentRequest):
    result = await openai_client.chat.completions.create(...)  # BLOCKS for 8+ seconds
    return result
```

**Exception:** The `/content/preview` endpoint (quick preview, uses cheapest model, 2s timeout) is allowed to be synchronous. It is clearly marked and monitored.

### Decision 2: All AI calls go through `ai_router.py`

**Rule:** Never instantiate an AI provider client anywhere except `ai_router.py`.

```python
# CORRECT
from services.ai_router import generate

result = await generate(
    task="linkedin_post",
    prompt=prompt,
    context=context,
    quality="high",
)

# WRONG: Direct provider call from service layer
from openai import AsyncOpenAI
client = AsyncOpenAI()
result = await client.chat.completions.create(...)
```

This ensures:
- Cost tracking on every AI call
- Automatic fallback if primary model fails
- A/B testing of models without changing service code
- Single place to update API keys
- Centralized rate limit management

### Decision 3: Supabase RLS is the authorization layer

**Rule:** Database-level RLS policies enforce multi-tenant isolation. Never rely solely on application-level checks.

Every table that contains org-specific data has an RLS policy. When adding a new table, the first task is writing the RLS policy before any other code.

```sql
-- EVERY org-scoped table needs this pattern
ALTER TABLE new_feature_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON new_feature_table
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

### Decision 4: Prompts are versioned database records, not code constants

Prompts that affect content quality are stored in `prompt_versions` table. Code retrieves the active version at runtime. This allows prompt iteration without code deployments.

Only exception: structural prompts (output format instructions) which are tightly coupled to parsing code — these live in `backend/prompts/`.

### Decision 5: Content safety check is mandatory before scheduling

No post can be scheduled without passing the safety check. This is enforced in the `SchedulingService`, not just the UI.

```python
async def schedule_post(post_id: UUID, scheduled_at: datetime) -> ScheduledPost:
    post = await self.posts_repo.get(post_id)

    if post.safety_status != SafetyStatus.PASSED:
        if post.safety_status == SafetyStatus.PENDING:
            safety_result = await self.safety_checker.check(post.content)
            await self.posts_repo.update_safety(post_id, safety_result)
            if safety_result.status == SafetyStatus.BLOCKED:
                raise ContentBlockedError(reason=safety_result.reason)
        elif post.safety_status == SafetyStatus.BLOCKED:
            raise ContentBlockedError(reason=post.safety_reason)
        # AMBER (flagged but allowed) — log, allow scheduling, but audit trail

    return await self.publish_queue.schedule(post_id, scheduled_at)
```

---

## 6. AI Integration Architecture

### 6.1 AI Router (`backend/services/ai_router.py`)

The central AI routing service. All AI generation goes through here.

```python
class AIRouter:
    """Routes AI generation requests to optimal model based on task, cost, and availability."""

    # Model registry
    MODELS = {
        "claude-sonnet": AnthropicClient(model="claude-sonnet-4-5"),
        "claude-haiku": AnthropicClient(model="claude-haiku-3-5"),
        "gpt-4o": OpenAIClient(model="gpt-4o"),
        "gpt-4o-mini": OpenAIClient(model="gpt-4o-mini"),
        "gemini-flash": GoogleClient(model="gemini-1.5-flash"),
        "gemini-pro": GoogleClient(model="gemini-1.5-pro"),
    }

    # Task → model mapping
    ROUTING_TABLE = {
        "linkedin_post": "claude-sonnet",
        "instagram_caption": "gpt-4o",
        "twitter_thread": "gpt-4o",
        "impact_story_narrative": "claude-sonnet",
        "impact_story_platform": "gpt-4o-mini",
        "safety_check": "claude-haiku",
        "hashtag_research": "gemini-flash",
        "hindi_content": "claude-haiku",
        "campaign_generation": "claude-sonnet",
        "founder_post": "claude-sonnet",
        "quick_preview": "gpt-4o-mini",
        "document_parsing": "gpt-4o",
    }

    async def generate(
        self,
        task: str,
        messages: list[dict],
        user_plan: UserPlan,
        structured_output: type[BaseModel] | None = None,
    ) -> AIResponse:
        model_key = self._select_model(task, user_plan)
        client = self.MODELS[model_key]

        try:
            result = await client.generate(
                messages=messages,
                structured_output=structured_output,
            )
            await self._log_usage(task, model_key, result.token_usage)
            return result

        except RateLimitError:
            fallback_model = self._get_fallback(model_key)
            return await self._retry_with_fallback(fallback_model, messages)

        except ProviderOutageError:
            # Log to alerting system, use fallback
            await self._alert_oncall(model_key)
            fallback_model = self._get_cross_provider_fallback(model_key)
            return await self._retry_with_fallback(fallback_model, messages)
```

### 6.2 Structured AI Output

All AI responses are structured using Pydantic models. Never parse raw text.

```python
# Define the expected output schema
class LinkedInPostOutput(BaseModel):
    post_content: str = Field(description="The LinkedIn post text, max 3000 chars")
    hashtags: list[str] = Field(description="Recommended hashtags, 8-15 items")
    quality_score: int = Field(ge=0, le=100, description="Content quality 0-100")
    hook_alternative: str = Field(description="Alternative opening line variant")
    posting_time_suggestion: str = Field(description="Best time to post, e.g. 'Tuesday 8AM IST'")
    safety_flags: list[str] = Field(default=[], description="Any sensitivity concerns")

# Use in generation
response = await ai_router.generate(
    task="linkedin_post",
    messages=messages,
    structured_output=LinkedInPostOutput,  # Forces structured response
)
post_data = LinkedInPostOutput.model_validate(response.parsed)
```

**For Anthropic (Claude):** Use `response_format` with JSON mode  
**For OpenAI:** Use `response_format={"type": "json_object"}` or structured outputs  
**For Gemini:** Use `generation_config` with `response_schema`

The `ai_router.py` handles the provider-specific structured output syntax — callers just pass the Pydantic model class.

### 6.3 Prompt Caching (Anthropic)

Anthropic's prompt caching reduces costs by 90% for repeated system prompts. Use it aggressively for:
- System prompt (role + rules + domain context) — rarely changes
- Organization context block — changes only when org profile updates

```python
# Anthropic cache_control usage
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},  # Cache this block
            },
            {
                "type": "text",
                "text": org_context_block,
                "cache_control": {"type": "ephemeral"},  # Cache org context too
            },
            {
                "type": "text",
                "text": specific_task_prompt,  # Not cached — changes per request
            },
        ],
    }
]
```

### 6.4 AI Cost Tracking

Every AI call is logged:

```sql
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    task_type VARCHAR NOT NULL,
    model_used VARCHAR NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_tokens INTEGER,
    cost_usd DECIMAL(10, 6),
    latency_ms INTEGER,
    success BOOLEAN,
    error_type VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Daily budget enforcement runs as a Celery Beat task at midnight, resetting daily counters.

---

## 7. Database Patterns (Supabase)

### 7.1 Client Configuration

```typescript
// dashboard/lib/supabase/server.ts — for Server Components and API Routes
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
    const cookieStore = cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                set(name, value, options) { cookieStore.set({ name, value, ...options }) },
                remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
            },
        }
    )
}

// dashboard/lib/supabase/client.ts — for Client Components only
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
}
```

**CRITICAL:** Never use the browser client in Server Components. Never use the server client in Client Components. They look similar but have different auth handling.

### 7.2 Key Tables

```sql
-- Core tables (abbreviated — see full schema in migrations/)

-- Organizations (multi-tenant root)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    type org_type NOT NULL,       -- 'ngo' | 'csr' | 'social_enterprise' | 'ingo'
    focus_area focus_area[],      -- 'wash' | 'mhm' | 'education' | 'health'
    country_code CHAR(2) DEFAULT 'IN',
    state_code VARCHAR,           -- Indian state code for regional content
    website VARCHAR,
    logo_url VARCHAR,
    voice_profile JSONB,          -- BrandVoiceProfile stored as JSONB
    plan subscription_plan DEFAULT 'free',
    ai_daily_budget_usd DECIMAL DEFAULT 0.05,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts (core content entity)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    platform social_platform NOT NULL,  -- 'linkedin' | 'instagram' | 'twitter' | 'facebook'
    content TEXT NOT NULL,
    hashtags TEXT[],
    media_urls TEXT[],
    status post_status DEFAULT 'draft',  -- 'draft' | 'in_review' | 'approved' | 'scheduled' | 'published' | 'failed'
    safety_status safety_status DEFAULT 'pending',
    safety_flags JSONB,
    quality_score INTEGER,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    platform_post_id VARCHAR,            -- ID returned by social platform API
    campaign_id UUID REFERENCES campaigns(id),
    generation_metadata JSONB,           -- AI model used, tokens, prompt version, etc.
    language VARCHAR DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice profiles (separate table for versioning)
CREATE TABLE voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    profile_type VARCHAR DEFAULT 'organization',  -- 'organization' | 'founder' | 'program'
    name VARCHAR NOT NULL,
    config JSONB NOT NULL,             -- BrandVoiceConfig object
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Migration Pattern

Migrations are plain SQL files, numbered sequentially:
```
backend/migrations/
├── 001_initial_schema.sql
├── 002_voice_profiles_table.sql
├── 003_campaigns_tables.sql
├── 004_analytics_tables.sql
├── 005_add_language_column_to_posts.sql
```

**Rules for migrations:**
- Never modify an existing migration file — always add a new one
- Migrations must be idempotent where possible (use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
- Every migration that adds a table must also add RLS policies in the same file
- Run migrations locally before pushing: `supabase db push --local`

### 7.4 JSONB Columns

Use JSONB for flexible config data. Never use for data you need to query/filter:

```python
# CORRECT: Store voice profile config in JSONB
voice_profile = {
    "formality": 65,
    "emotion_weight": 45,
    "signature_phrases": ["Here's what we've learned:", "Real impact:"],
    "avoid_phrases": ["We are pleased to announce"],
}
# Store in organizations.voice_profile JSONB column

# WRONG: Store searchable data in JSONB
# Never do: {"post_status": "scheduled", "platform": "linkedin"} in JSONB
# These need to be proper columns with indexes
```

### 7.5 Real-time Subscriptions

Used for live content generation status updates:

```typescript
// Frontend: Subscribe to job status updates
const channel = supabase
    .channel(`generation_job_${jobId}`)
    .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'generation_jobs',
        filter: `id=eq.${jobId}`,
    }, (payload) => {
        if (payload.new.status === 'completed') {
            setGeneratedContent(payload.new.result)
        }
    })
    .subscribe()

// Remember to unsubscribe on component unmount
return () => { supabase.removeChannel(channel) }
```

---

## 8. Frontend Patterns (Next.js)

### 8.1 App Router Route Groups

Route groups `(auth)` and `(dashboard)` share layouts but don't affect URL structure:
- `app/(auth)/login/page.tsx` → URL: `/login`
- `app/(dashboard)/calendar/page.tsx` → URL: `/calendar`

### 8.2 Server vs. Client Components

**Use Server Components (default) for:**
- Data fetching (database calls, API calls)
- Static content rendering
- Pages that don't need interactivity

**Use Client Components (`"use client"`) for:**
- Event handlers (onClick, onChange)
- useState, useEffect, useRef
- Browser APIs (localStorage, navigator)
- Interactive widgets (drag-drop calendar, content editor)

```typescript
// Server Component — fetches data, passes to client component
// app/(dashboard)/calendar/page.tsx
export default async function CalendarPage() {
    const supabase = createClient()
    const posts = await supabase.from('posts').select('*').order('scheduled_at')
    return <CalendarView posts={posts.data ?? []} />  // Client component
}

// Client Component — handles interaction
// components/calendar/CalendarView.tsx
"use client"
export function CalendarView({ posts }: { posts: Post[] }) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    // ...
}
```

### 8.3 Data Fetching Pattern

```typescript
// For Server Components: direct Supabase call
const { data, error } = await supabase.from('posts').select('*')

// For Client Components: call backend API via fetch
const response = await fetch('/api/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
})

// Use SWR or React Query for client-side data fetching with caching
// We use SWR — see hooks/useContentGeneration.ts for pattern
```

### 8.4 Loading & Error States

Every data-dependent page must have:
```typescript
// Use Next.js built-in patterns
app/(dashboard)/calendar/
├── page.tsx          ← Main page (Server Component)
├── loading.tsx       ← Skeleton loading state
└── error.tsx         ← Error boundary ("use client")
```

Use `Skeleton` component from `components/ui/Skeleton.tsx` for loading states — never show blank/empty UI.

### 8.5 Content Generation UX Pattern

Content generation is async (8-20 seconds). Show the user something is happening:

```typescript
function ContentStudio() {
    const [jobId, setJobId] = useState<string | null>(null)
    const [content, setContent] = useState<GeneratedContent | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)

    const handleGenerate = async (request: ContentRequest) => {
        setIsGenerating(true)
        const { job_id } = await startGenerationJob(request)
        setJobId(job_id)
        // Supabase real-time subscription handles the rest
        // GenerationLoader component shows animated progress
    }

    return (
        <>
            {isGenerating && <GenerationLoader jobId={jobId} onComplete={setContent} />}
            {content && <ContentPreviewPanel content={content} />}
        </>
    )
}
```

### 8.6 Platform Preview Components

Each social platform has a preview component that simulates the platform's UI:

```
components/content/previews/
├── LinkedInPreview.tsx    ← LinkedIn post card simulation
├── InstagramPreview.tsx   ← Instagram feed post simulation
├── TwitterPreview.tsx     ← Tweet thread simulation
└── FacebookPreview.tsx    ← Facebook post simulation
```

These are presentational only — no logic, just rendering. They accept a `Post` object and render it.

---

## 9. Backend Patterns (FastAPI)

### 9.1 Dependency Injection

```python
# All database access is via injected repository
@router.post("/content/generate", response_model=GenerationJobResponse)
async def create_generation_job(
    request: ContentGenerationRequest,
    current_user: User = Depends(get_current_user),          # Auth dependency
    posts_repo: PostsRepository = Depends(get_posts_repo),  # DB dependency
    ai_router: AIRouter = Depends(get_ai_router),           # AI dependency
):
    # Business logic — just orchestration, no direct DB or AI calls
    job = await posts_repo.create_draft(request, current_user.org_id)
    generate_content_task.delay(job.id, current_user.plan)
    return GenerationJobResponse(job_id=job.id, status="queued")
```

### 9.2 Repository Pattern

```python
# backend/repositories/posts.py
class PostsRepository:
    def __init__(self, db: AsyncClient):
        self.db = db

    async def create_draft(self, request: ContentRequest, org_id: UUID) -> Post:
        result = await self.db.table("posts").insert({
            "org_id": str(org_id),
            "platform": request.platform,
            "content": "",           # Populated by AI worker
            "status": "draft",
            "safety_status": "pending",
        }).execute()
        return Post(**result.data[0])

    async def update_with_generation(self, post_id: UUID, content: GeneratedContent) -> Post:
        result = await self.db.table("posts").update({
            "content": content.post_content,
            "hashtags": content.hashtags,
            "quality_score": content.quality_score,
            "status": "draft",
            "generation_metadata": content.metadata.model_dump(),
        }).eq("id", str(post_id)).execute()
        return Post(**result.data[0])
```

**Rules:**
- All DB calls are in `repositories/` — never in `services/` or `routers/`
- Repositories return typed Pydantic models, never raw dicts
- No business logic in repositories — only CRUD and queries

### 9.3 Error Handling

```python
# backend/exceptions.py — define all custom exceptions
class BrandoraError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code

class ContentBlockedError(BrandoraError):
    def __init__(self, reason: str):
        super().__init__(
            message=f"Content blocked by safety system: {reason}",
            code="CONTENT_BLOCKED",
            status_code=422,
        )

class AIGenerationError(BrandoraError):
    def __init__(self, task: str, attempts: int):
        super().__init__(
            message=f"AI generation failed for task '{task}' after {attempts} attempts",
            code="AI_GENERATION_FAILED",
            status_code=503,
        )

# Register global exception handler in main.py
@app.exception_handler(BrandoraError)
async def brandora_exception_handler(request: Request, exc: BrandoraError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message},
    )
```

### 9.4 Celery Tasks

```python
# backend/workers/ai_tasks.py
from celery import shared_task
from services.content_generator import ContentGeneratorService

@shared_task(
    name="generate_content",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    time_limit=120,    # Kill task if it runs > 2 minutes
    soft_time_limit=90,
)
def generate_content_task(self, job_id: str, user_plan: str):
    """Celery task: runs AI generation and updates database."""
    try:
        service = ContentGeneratorService()
        result = asyncio.run(service.generate(job_id, user_plan))
        # Supabase update triggers real-time notification to frontend
        return {"status": "success", "job_id": job_id}

    except SoftTimeLimitExceeded:
        self.update_state(state="TIMEOUT")
        raise

    except Exception as exc:
        logger.error(f"Generation failed for job {job_id}: {exc}")
        self.retry(exc=exc)
```

---

## 10. Content Pipeline Architecture

### 10.1 Generation Job Flow

```
HTTP POST /content/generate
    │
    ▼
Router → validate request → create PostDraft record → enqueue Celery task
    │                                                          │
    ▼                                                          ▼
Return {job_id, status: "queued"}                   Celery Worker picks up task
                                                               │
                                                               ▼
                                                   ContentGeneratorService.generate()
                                                               │
                                              ┌────────────────┼────────────────┐
                                              ▼                ▼                ▼
                                       Build Prompt    Fetch Voice Profile  Add Safety Context
                                              │
                                              ▼
                                       AI Router → select model → call API
                                              │
                                              ▼
                                       Parse structured response
                                              │
                                              ▼
                                       Safety Check (parallel Celery sub-task)
                                              │
                                              ▼
                                       Hashtag Injection
                                              │
                                              ▼
                                       Update Post record in DB → Supabase real-time fires
                                              │
                                              ▼
                                       Frontend receives update → displays content
```

### 10.2 Multi-Platform Generation

When generating for all platforms simultaneously:

```python
async def generate_all_platforms(
    impact_data: ImpactData,
    org_profile: OrgProfile,
) -> ContentBundle:

    # Step 1: Generate narrative core once (shared foundation)
    story_core = await self._generate_narrative_core(impact_data, org_profile)

    # Step 2: Adapt for each platform in parallel (different models, same input)
    platform_tasks = [
        self._adapt_for_platform("linkedin", story_core, org_profile),
        self._adapt_for_platform("instagram", story_core, org_profile),
        self._adapt_for_platform("twitter", story_core, org_profile),
        self._adapt_for_platform("facebook", story_core, org_profile),
    ]
    platform_posts = await asyncio.gather(*platform_tasks, return_exceptions=True)

    # Step 3: Safety check all platforms in parallel
    safety_tasks = [self.safety_checker.check(post) for post in platform_posts if post]
    safety_results = await asyncio.gather(*safety_tasks)

    # Step 4: Inject hashtags
    final_posts = [
        self.hashtag_engine.inject(post, platform, org_profile)
        for post, platform in zip(platform_posts, PLATFORMS)
        if post
    ]

    return ContentBundle(posts=final_posts, story_core=story_core)
```

### 10.3 Impact Story Pipeline

```python
# backend/services/content_generator.py

async def generate_impact_story(self, data: ImpactStoryRequest) -> ImpactStoryBundle:

    # 1. Enrich raw data (Gemini Flash — fast & cheap)
    enriched = await self.ai_router.generate(
        task="data_enrichment",
        messages=build_enrichment_prompt(data),
    )
    # enriched adds: SDG tags, equivalences ("enough for X schools"), trend context

    # 2. Generate narrative core (Claude Sonnet — narrative quality)
    narrative = await self.ai_router.generate(
        task="impact_story_narrative",
        messages=build_narrative_prompt(enriched, data.org_profile),
        structured_output=ImpactNarrativeCore,
    )
    # narrative contains: headline, hero_sentence, proof_points[3], cta_variants[2]

    # 3. Platform adaptation (GPT-4o-mini × 5 — fast parallel)
    # Each platform call costs ~$0.002 and takes ~3 seconds
    platform_adapts = await asyncio.gather(
        self._adapt("linkedin", narrative, data),
        self._adapt("instagram", narrative, data),
        self._adapt("twitter", narrative, data),
        self._adapt("facebook", narrative, data),
        self._adapt("whatsapp", narrative, data),
    )

    # 4. Hindi variants if org uses Hindi
    if data.org_profile.languages and 'hi' in data.org_profile.languages:
        hindi_versions = await self._generate_hindi_variants(narrative, data)

    return ImpactStoryBundle(
        narrative_core=narrative,
        platform_posts=platform_adapts,
        hindi_posts=hindi_versions if data.hindi_requested else [],
    )
```

---

## 11. Brand Voice System

### 11.1 Voice Profile Storage

Voice profiles are stored as JSONB in the `voice_profiles` table:

```python
class BrandVoiceConfig(BaseModel):
    # Dimension scores (0-100)
    formality: int = Field(ge=0, le=100, default=60)
    emotion_weight: int = Field(ge=0, le=100, default=50)
    urgency: int = Field(ge=0, le=100, default=40)
    authority: int = Field(ge=0, le=100, default=65)
    simplicity: int = Field(ge=0, le=100, default=55)

    # Style markers
    uses_first_person: bool = True
    uses_rhetorical_questions: bool = False
    uses_data_citations: bool = True
    sign_off_style: str = ""

    # Cultural config
    primary_language: str = "en"
    cultural_context: str = "urban_india"
    stigma_sensitivity: Literal["high", "medium", "low"] = "high"

    # Learned markers (populated by analysis)
    signature_phrases: list[str] = []
    avoid_phrases: list[str] = []
    example_posts: list[str] = []   # 3-5 gold-standard examples (stored as text)

    # Metadata
    profile_type: Literal["organization", "founder", "program"] = "organization"
    confidence_score: float = 0.0   # 0-1, how confident AI is in this profile
    posts_analyzed: int = 0         # How many posts were used to build this
```

### 11.2 Voice Profile Injection in Prompts

```python
def build_voice_context_block(profile: BrandVoiceConfig) -> str:
    """Convert voice profile into natural language prompt context."""
    
    formality_desc = {
        range(0, 30): "very conversational, casual language",
        range(30, 60): "professional but warm",
        range(60, 80): "formal and institutional",
        range(80, 101): "highly formal, authoritative",
    }
    
    return f"""
BRAND VOICE GUIDELINES:
Tone: {get_range_value(formality_desc, profile.formality)}
Emotional weight: {"Lead with data; emotions support" if profile.emotion_weight < 50 else "Lead with story; data supports"}
Language: {profile.primary_language.upper()} primary, {profile.cultural_context} context
Sensitivity level: {profile.stigma_sensitivity} (for menstrual health/sanitation content)

{"USE these phrases naturally: " + ", ".join(f'"{p}"' for p in profile.signature_phrases) if profile.signature_phrases else ""}
{"AVOID these phrases: " + ", ".join(f'"{p}"' for p in profile.avoid_phrases) if profile.avoid_phrases else ""}

EXAMPLE POSTS (match this style):
{chr(10).join(f'Example {i+1}: {post}' for i, post in enumerate(profile.example_posts[:3]))}
"""
```

### 11.3 Continuous Voice Learning

When a user significantly edits AI-generated content (edit distance > 30% of original), the edit is flagged for voice profile learning:

```python
# backend/workers/ai_tasks.py
@shared_task(name="analyze_voice_edit")
def analyze_voice_edit_task(post_id: str, original: str, edited: str, org_id: str):
    """Analyze user edits to improve voice profile."""
    if edit_distance_ratio(original, edited) > 0.3:
        delta = extract_style_delta(original, edited)
        # delta contains: words_added, words_removed, structural_changes
        update_voice_profile_from_delta.delay(org_id, delta)
```

---

## 12. Testing Strategy

### 12.1 Test Categories

```
backend/tests/
├── unit/                   ← Pure function tests, no I/O
│   ├── test_prompt_builder.py
│   ├── test_hashtag_engine.py
│   ├── test_safety_classifier.py
│   └── test_voice_profile.py
├── integration/            ← Tests with real DB (test Supabase project)
│   ├── test_content_generation.py
│   ├── test_scheduling.py
│   └── test_publishing.py
└── fixtures/
    ├── sample_impact_data.json
    ├── sample_voice_profiles.json
    └── sample_posts.json
```

### 12.2 AI Testing Strategy

AI calls are expensive and non-deterministic. Testing strategy:

**For unit tests:** Mock all AI calls. Use pre-recorded responses in `fixtures/`.
```python
@pytest.fixture
def mock_ai_router(mocker):
    return mocker.patch(
        'services.ai_router.AIRouter.generate',
        return_value=load_fixture('linkedin_post_response.json')
    )
```

**For integration tests:** Use cheapest available model (GPT-4o-mini) with a hard token limit.
```python
@pytest.mark.integration
@pytest.mark.parametrize("platform", ["linkedin", "instagram"])
async def test_content_generation_quality(platform, test_org):
    result = await generate_post(platform, TEST_IMPACT_DATA, test_org)
    assert len(result.content) > 100
    assert result.quality_score >= 50
    assert result.safety_status != SafetyStatus.BLOCKED
```

**For prompt testing:** Dedicated prompt evaluation suite (separate from main tests).
```
backend/tests/evals/
├── eval_linkedin_quality.py
├── eval_safety_detection.py
└── eval_hindi_accuracy.py
```

Evals run weekly in CI, not on every commit. They evaluate:
- Output quality (scored by a "judge" model, typically GPT-4o)
- Safety detection rate (test set of known problematic content)
- Hindi accuracy (rated by a native speaker rubric)

### 12.3 Running Tests

```bash
# Unit tests (fast, no I/O)
cd backend && pytest tests/unit/ -v

# Integration tests (requires .env.test with test project credentials)
cd backend && pytest tests/integration/ -v --env=test

# Frontend tests
cd dashboard && npm run test

# Type checking
cd dashboard && npm run type-check
cd backend && mypy . --strict
```

---

## 13. Environment Variables & Secrets

### 13.1 Frontend Environment Variables

```bash
# dashboard/.env.local (never commit)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Safe to expose (RLS enforced in DB)

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000  # Change to prod URL in production

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 13.2 Backend Environment Variables

```bash
# backend/.env (never commit)

# Core
ENVIRONMENT=development  # development | staging | production
SECRET_KEY=              # 64+ random bytes; used for JWT signing
DEBUG=true

# Supabase (server-side — use service role key for admin operations)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # NEVER expose to frontend — admin key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Social Platform OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
META_APP_ID=             # For Instagram + Facebook
META_APP_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# Email (for notifications)
SENDGRID_API_KEY=
EMAIL_FROM=no-reply@brandora.ai

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

### 13.3 Secrets Management

- **Local:** `.env.local` / `.env` files, gitignored
- **Staging/Production:** Store in Railway.app environment variables (backend) + Vercel environment variables (frontend)
- **Rotation:** Social platform tokens rotate automatically via OAuth refresh. API keys are rotated quarterly.
- **NEVER:** Commit any secrets, log API keys, expose service role keys to frontend

---

## 14. Development Tasks

### 14.1 Initial Setup

```bash
# 1. Clone and install frontend
cd dashboard
npm install
cp .env.example .env.local
# Fill in Supabase URL and anon key from your Supabase project

# 2. Install backend dependencies
cd ../backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in all environment variables

# 3. Start Redis (required for Celery)
docker-compose up redis -d

# 4. Run database migrations
cd backend
python -m alembic upgrade head
# Or use Supabase CLI: supabase db push --local

# 5. Seed development data
supabase db seed

# 6. Start all services
# Terminal 1: Frontend
cd dashboard && npm run dev

# Terminal 2: Backend API
cd backend && uvicorn main:app --reload --port 8000

# Terminal 3: Celery worker
cd backend && celery -A workers.celery_app worker --loglevel=info -Q ai_generation_queue

# Terminal 4: Celery Beat (for scheduled tasks)
cd backend && celery -A workers.celery_app beat --loglevel=info
```

### 14.2 Common Development Tasks

```bash
# Add a new Shadcn UI component
cd dashboard && npx shadcn-ui@latest add [component-name]

# Generate TypeScript types from Supabase schema
cd dashboard && npx supabase gen types typescript --local > lib/database.types.ts

# Run linting
cd dashboard && npm run lint
cd backend && ruff check . && black --check .

# Format backend code
cd backend && black . && isort .

# Create a new database migration
# 1. Write SQL in backend/migrations/XXX_description.sql
# 2. Apply: supabase db push --local

# Check AI cost usage (development)
cd backend && python scripts/ai_cost_report.py --period today

# Test a specific prompt
cd backend && python scripts/test_prompt.py --task linkedin_post --input fixtures/sample_impact_data.json
```

---

## 15. Adding New Content Generation Features

Follow this exact pattern when adding a new content generation feature (e.g., a new post format):

### Step 1: Define the output model

```python
# backend/models/content.py
class YoutubeDescriptionOutput(BaseModel):
    description: str = Field(description="Full YouTube video description")
    timestamps: list[str] = Field(description="Suggested chapter timestamps")
    tags: list[str] = Field(description="YouTube tags, 15-20 items")
    quality_score: int = Field(ge=0, le=100)
    safety_flags: list[str] = Field(default=[])
```

### Step 2: Write the prompt

```python
# backend/prompts/youtube.py

YOUTUBE_DESCRIPTION_SYSTEM = """
You are a social impact video content specialist...
[Full system prompt with domain expertise, rules, format]
"""

def build_youtube_description_prompt(
    input_data: ContentRequest,
    org_profile: OrgProfile,
    voice_profile: BrandVoiceConfig,
) -> list[dict]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": YOUTUBE_DESCRIPTION_SYSTEM, "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": build_org_context(org_profile, voice_profile), "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": f"Generate YouTube description for:\n{input_data.model_dump_json()}"},
            ]
        }
    ]
```

### Step 3: Add routing entry in `ai_router.py`

```python
ROUTING_TABLE = {
    # ... existing entries ...
    "youtube_description": "gpt-4o",   # Add this line
}
```

### Step 4: Add to `ContentGeneratorService`

```python
# backend/services/content_generator.py
async def generate_youtube_description(
    self,
    request: ContentRequest,
    org_profile: OrgProfile,
) -> YoutubeDescriptionOutput:
    voice_profile = await self.voice_repo.get_active(org_profile.id)
    messages = build_youtube_description_prompt(request, org_profile, voice_profile)

    raw = await self.ai_router.generate(
        task="youtube_description",
        messages=messages,
        structured_output=YoutubeDescriptionOutput,
    )
    return YoutubeDescriptionOutput.model_validate(raw.parsed)
```

### Step 5: Add API endpoint

```python
# backend/routers/content.py
@router.post("/content/youtube-description", response_model=GenerationJobResponse)
async def generate_youtube_description(
    request: ContentGenerationRequest,
    current_user: User = Depends(get_current_user),
    service: ContentGeneratorService = Depends(get_content_service),
):
    job = await service.create_generation_job("youtube_description", request, current_user)
    generate_content_task.delay(job.id, current_user.plan)
    return GenerationJobResponse(job_id=job.id, status="queued")
```

### Step 6: Add frontend UI

```typescript
// Add "YouTube Description" to platform selector in ContentStudio
// Add YoutubePreview component in components/content/previews/
// Add platform type to SocialPlatform enum in lib/types.ts
```

### Step 7: Write tests

```python
# backend/tests/unit/test_youtube_description.py
async def test_youtube_description_generation(mock_ai_router, test_org):
    result = await service.generate_youtube_description(
        request=TEST_REQUEST,
        org_profile=test_org.profile,
    )
    assert len(result.description) > 200
    assert len(result.tags) >= 10
    assert result.quality_score >= 50
```

---

## 16. Adding New Social Media Platforms

Adding a new publishing platform (e.g., LinkedIn Newsletter, Pinterest):

### Step 1: Add platform type

```python
# backend/models/content.py
SocialPlatform = Literal["linkedin", "instagram", "twitter", "facebook", "pinterest"]  # Add here
```

```typescript
// dashboard/lib/types.ts
export type SocialPlatform = 'linkedin' | 'instagram' | 'twitter' | 'facebook' | 'pinterest'  // Add here
```

### Step 2: Create publisher class

```python
# backend/services/platform_publishers/pinterest.py
from .base import BasePlatformPublisher

class PinterestPublisher(BasePlatformPublisher):
    platform = "pinterest"

    async def publish(self, post: Post, credentials: PlatformCredentials) -> PublishResult:
        """Publish a pin to Pinterest."""
        # Pinterest API implementation
        client = await self._get_pinterest_client(credentials)
        result = await client.pins.create({
            "title": post.content[:100],
            "description": post.content,
            "board_id": credentials.board_id,
            "media_source": {"source_type": "url", "url": post.media_urls[0]} if post.media_urls else None,
        })
        return PublishResult(
            success=True,
            platform_post_id=result["id"],
            published_url=result["link"],
        )

    async def validate_credentials(self, credentials: PlatformCredentials) -> bool:
        # Verify Pinterest OAuth token is valid
        ...

    def get_content_requirements(self) -> ContentRequirements:
        return ContentRequirements(
            max_text_length=500,
            requires_image=True,
            supports_video=True,
            supports_carousel=False,
        )
```

### Step 3: Register publisher

```python
# backend/services/platform_publishers/__init__.py
PUBLISHERS = {
    "linkedin": LinkedInPublisher(),
    "instagram": InstagramPublisher(),
    "twitter": TwitterPublisher(),
    "facebook": FacebookPublisher(),
    "pinterest": PinterestPublisher(),   # Add here
}
```

### Step 4: Add OAuth flow

```python
# backend/routers/social_connections.py
@router.get("/auth/pinterest")
async def pinterest_oauth_start(current_user: User = Depends(get_current_user)):
    # Generate Pinterest OAuth URL
    ...

@router.get("/auth/pinterest/callback")
async def pinterest_oauth_callback(code: str, state: str):
    # Exchange code for tokens, store encrypted in DB
    ...
```

### Step 5: Add platform-specific prompt

```python
# backend/prompts/pinterest.py
PINTEREST_SYSTEM = """
You are a social impact visual content specialist...
Pinterest requires: keyword-rich descriptions, vertical image suggestions, board categorization
Audience: Active pinners interested in social causes, women's health, sustainable development
"""
```

### Step 6: Add platform to routing table

```python
# backend/services/ai_router.py
ROUTING_TABLE = {
    # ...existing...
    "pinterest_description": "gpt-4o-mini",  # Pinterest descriptions are simpler
}
```

---

## 17. Prompt Engineering Guidelines

### 17.1 Core Principles for Brandora AI Prompts

**1. Domain expertise must be embedded, not assumed**

Bad:
```
Write a LinkedIn post about menstrual hygiene.
```

Good:
```
You are a senior communications expert with 15 years of experience in the
menstrual health and WASH sector in India. You understand:
- How to discuss menstruation in ways that destigmatize while respecting cultural context
- The difference in language appropriate for NGO reports vs. social media vs. CSR compliance
- SDG 5 and SDG 6 frameworks and how to reference them authentically
- The specific vocabulary preferences of India's MHM/WASH professional community
```

**2. Audience specificity drives output quality**

Always include:
- Who is reading this? (NGO donors, CSR committee, community members, journalists)
- Where are they? (Urban India, rural India, global)
- What do they already know? (WASH basics, SDG framework, India context)
- What do you want them to feel/do after reading?

**3. Domain-specific "avoid" lists are critical**

Include explicit prohibitions specific to this sector:
```
NEVER USE:
- "Poor people" or "underprivileged" to describe beneficiaries
- "Feminine hygiene" (reinforces shame framing)
- "That time of month" (euphemism)
- "We helped the backward communities" (patronizing)
- "Victims of poor sanitation" (disempowering)
- Generic impact statements without specific numbers

ALWAYS USE:
- Beneficiary counts as specific as possible ("8,247 women" not "thousands")
- Active voice for beneficiaries ("Women now have access to..." not "Access was provided to women")
- Specific place names when appropriate
- SDG alignment where genuine
```

**4. Few-shot examples are the highest-leverage prompt component**

For every content type, include 2-3 gold-standard examples. These set the quality bar more reliably than any amount of instructions.

```python
# Maintain example banks in: backend/prompts/examples/
# linkedin_gold_examples.json
# instagram_gold_examples.json
# impact_story_gold_examples.json
```

**5. Structured output prevents parsing failures**

Always use `response_format` or structured output mode. Never rely on text parsing.
If a model doesn't support structured output, add explicit JSON format instructions and validate with a Pydantic model.

### 17.2 Prompt Testing Protocol

Before shipping a new or modified prompt:
1. Test with 5 different input scenarios (min/max content, different org types, different languages)
2. Check: quality score ≥ 70 on all 5
3. Check: safety system properly flags a known-bad test case
4. Check: output length within platform limits
5. Check: structured output parses without errors
6. A/B test against existing prompt for 48 hours (10% traffic) before full rollout

### 17.3 Hindi Prompt Guidelines

Hindi prompts have additional requirements:
- Specify script: Devanagari (default) vs. Romanized Hindi
- Specify register: formal (शुद्ध हिंदी), colloquial (बोलचाल), or mixed (Hinglish)
- Include Hindi-specific examples (not translations of English examples)
- Test with a native Hindi speaker before shipping

```python
HINDI_LINKEDIN_SYSTEM = """
आप भारत में स्वच्छता और मासिक धर्म स्वच्छता क्षेत्र के वरिष्ठ संचार विशेषज्ञ हैं।
...

[Note: Write this prompt ENTIRELY in Hindi — don't mix English instructions with Hindi examples]
"""
```

### 17.4 Prompt Version Control

```python
# Retrieve active prompt version at runtime
async def get_active_prompt(prompt_key: str) -> str:
    result = await db.table("prompt_versions") \
        .select("content") \
        .eq("prompt_key", prompt_key) \
        .eq("is_active", True) \
        .single() \
        .execute()
    return result.data["content"]
```

Never hardcode a prompt directly in service code when it affects content quality. Use the database. Exception: structural/format prompts (output schema instructions) can stay in code since they're tightly coupled to parsing logic.

---

## 18. Important Gotchas

### Gotcha 1: Supabase RLS blocks service role operations differently

When using `supabase-py` with the **service role key** (for admin operations from backend), RLS is bypassed by default. This is intentional for backend operations. But when using the **anon key** (for user-context operations), RLS applies.

In the backend:
- Use service role client for: migrations, admin operations, background workers
- Use user-context client (JWT from request) for: user-facing API operations

```python
# backend/database.py
admin_client = AsyncClient(SUPABASE_URL, SERVICE_ROLE_KEY)   # RLS bypassed
user_client = AsyncClient(SUPABASE_URL, ANON_KEY)             # RLS enforced

# In API endpoints — pass user JWT for proper RLS
async def get_user_db(token: str = Depends(get_bearer_token)):
    return user_client.auth.set_session(access_token=token, refresh_token="")
```

### Gotcha 2: Celery and async Python don't mix natively

Celery tasks are synchronous by default. Use `asyncio.run()` to run async code inside a Celery task — but be careful about creating new event loops in the wrong context.

```python
# CORRECT
@shared_task
def my_celery_task(arg):
    result = asyncio.run(my_async_function(arg))  # OK — creates new event loop
    return result

# WRONG — causes event loop errors
@shared_task
async def my_celery_task(arg):  # async def Celery task — DON'T DO THIS
    result = await my_async_function(arg)
```

Alternative: Use `celery-pool-asyncio` for native async Celery support (on the roadmap but not yet implemented).

### Gotcha 3: LinkedIn API has strict content policies for menstrual health content

LinkedIn's API can reject posts that contain certain terms related to bodily functions, even in a health/education context. We route LinkedIn content through an extra pre-publish filter that substitutes problematic terms:

```python
# backend/services/platform_publishers/linkedin.py

LINKEDIN_TERM_SUBSTITUTIONS = {
    "menstrual blood": "menstrual flow",
    "period blood": "menstrual discharge",
    # Add more as we discover LinkedIn's filter patterns
}

def pre_publish_filter(content: str) -> str:
    """Apply LinkedIn-specific content substitutions."""
    for original, replacement in LINKEDIN_TERM_SUBSTITUTIONS.items():
        content = content.replace(original, replacement)
    return content
```

If a LinkedIn post fails with a 422 error mentioning "content policy", log the specific content and update this filter.

### Gotcha 4: Instagram API requires image for posts, no text-only

Instagram Business API does not allow text-only posts via API (unlike posting directly in the app). Every Instagram post must include at least one media URL.

Our workaround for text-heavy posts:
- Auto-generate a "quote card" image (text on brand-colored background) using Pillow
- Use this as the required image attachment

```python
# backend/services/platform_publishers/instagram.py
async def ensure_media_attachment(post: Post) -> Post:
    if not post.media_urls:
        quote_card_url = await self.image_gen.create_quote_card(
            text=post.content[:280],  # Truncated for visual
            org_brand=post.org.brand_colors,
        )
        post.media_urls = [quote_card_url]
    return post
```

### Gotcha 5: Twitter/X API rate limits are brutal on the free tier

Twitter API v2 Free tier: 1,500 tweets per month per app. This is shared across all users of our app.

Current mitigation:
- Twitter publishing is only available on Growth plan and above
- Rate limit counter tracked in Redis; warns at 1,200/month
- If limit hit: posts queued for next month (user notified)

When we scale, we'll need Twitter API Basic ($100/month) or higher.

### Gotcha 6: OpenAI structured outputs and Anthropic JSON mode behave differently

OpenAI's `response_format={"type": "json_object"}` requires you to mention "JSON" in the prompt. Anthropic's JSON mode doesn't have this requirement but handles empty/optional fields differently.

In `ai_router.py`, the `format_for_provider()` method handles this abstraction — always use it, never call provider APIs directly.

### Gotcha 7: Redis cache invalidation for voice profiles

Voice profiles are cached in Redis for performance. When a user updates their voice profile, the cache must be explicitly invalidated:

```python
# backend/services/brand_voice.py
async def update_voice_profile(org_id: UUID, config: BrandVoiceConfig) -> VoiceProfile:
    profile = await self.repo.update(org_id, config)
    
    # MUST invalidate cache or old profile will be used for up to 1 hour
    await redis_client.delete(f"voice_profile:{org_id}")
    
    return profile
```

Forgetting this causes content to be generated with the old voice after updates — a confusing and hard-to-debug bug.

### Gotcha 8: Multi-language content and Supabase full-text search

Supabase's full-text search (`to_tsvector`) doesn't work well with Hindi (Devanagari). For Hindi content search, we use `pg_trgm` (trigram similarity) instead of `tsquery`.

```sql
-- For English content
CREATE INDEX idx_posts_content_fts ON posts USING gin(to_tsvector('english', content));

-- For Hindi content — use trigram instead
CREATE INDEX idx_posts_content_trgm ON posts USING gin(content gin_trgm_ops);
```

---

## 19. Deployment Architecture

### 19.1 Environments

| Environment | Frontend | Backend | Database | Purpose |
|---|---|---|---|---|
| Local | `localhost:3000` | `localhost:8000` | Supabase local | Development |
| Staging | `staging.brandora.ai` | `api.staging.brandora.ai` | Supabase staging project | QA + client demos |
| Production | `app.brandora.ai` | `api.brandora.ai` | Supabase production project | Live users |

### 19.2 Deployment Services

- **Frontend:** Vercel (Next.js native hosting, edge network, automatic preview deployments)
- **Backend:** Railway.app (auto-deploy from `main` branch, horizontal scaling, good Python support)
- **Database:** Supabase (managed PostgreSQL, Mumbai region)
- **Redis:** Railway.app (Redis plugin, same network as backend for low latency)
- **Celery Workers:** Railway.app (separate service from API — scaled independently)
- **Storage (images, PDFs):** Supabase Storage (S3-compatible, CDN)
- **Monitoring:** Sentry (error tracking) + PostHog (product analytics) + Uptime Robot (availability)

### 19.3 CI/CD Pipeline

```yaml
# GitHub Actions (abbreviated)
on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  test:
    - npm run type-check (frontend)
    - npm run lint (frontend)
    - pytest tests/unit/ (backend)
    - mypy . (backend)

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/dev'
    - Deploy frontend to Vercel (staging)
    - Deploy backend to Railway (staging)
    - Run supabase db push --staging

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    - Deploy frontend to Vercel (production)
    - Deploy backend to Railway (production)
    - Run supabase db push --production
```

---

*This CLAUDE.md is a living document. Update it whenever you make architectural decisions, discover important gotchas, or change patterns. An outdated CLAUDE.md is worse than no CLAUDE.md.*

*Last updated: May 2026*
*Maintained by: Founding Engineering Team*
