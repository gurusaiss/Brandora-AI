# Brandora AI — System Architecture

**Version:** 1.0.0
**Last Updated:** 2026-05-22
**Status:** Production Blueprint

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [AI Pipeline Architecture](#5-ai-pipeline-architecture)
6. [Content Generation Pipeline](#6-content-generation-pipeline)
7. [Queue Architecture](#7-queue-architecture)
8. [Scheduling Pipeline](#8-scheduling-pipeline)
9. [Database Architecture](#9-database-architecture)
10. [Caching Strategy](#10-caching-strategy)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [File Storage](#12-file-storage)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [API Gateway Pattern](#14-api-gateway-pattern)
15. [Security Architecture](#15-security-architecture)
16. [Complete System Diagram](#16-complete-system-diagram)

---

## 1. Architecture Overview

Brandora AI is a multi-tenant SaaS platform built for NGO directors, CSR managers, and social media managers operating in the sanitation and menstrual hygiene space. The platform combines AI-driven content generation, cross-platform scheduling, and campaign analytics into a single unified product.

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BRANDORA AI PLATFORM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────────┐          ┌──────────────────────────────────┐   │
│   │   Next.js 14 Frontend │◄────────►│        FastAPI Backend           │   │
│   │   (Vercel / Railway)  │  HTTPS   │        (Railway)                 │   │
│   │                       │  REST    │                                  │   │
│   │  • App Router         │  +SSE    │  • Content Module                │   │
│   │  • Tailwind + Shadcn  │          │  • Campaign Module               │   │
│   │  • Zustand + RQ       │          │  • Scheduler Module              │   │
│   │  • Supabase Auth      │          │  • Analytics Module              │   │
│   └──────────────────────┘          │  • AI Module                     │   │
│                                      │  • Auth Module                   │   │
│                                      └────────────┬─────────────────────┘   │
│                                                   │                         │
│          ┌────────────────────────────────────────┼─────────────────────┐  │
│          │                                        │                     │  │
│          ▼                                        ▼                     ▼  │
│   ┌─────────────┐    ┌─────────────────┐   ┌──────────────┐   ┌──────────┐│
│   │  Supabase   │    │  Redis (Upstash) │   │  Celery      │   │  AI APIs ││
│   │             │    │                 │   │  Workers     │   │          ││
│   │ • Postgres  │    │  • Session Cache│   │              │   │ • OpenAI ││
│   │ • Auth      │    │  • Task Queue   │   │  • Content   │   │ • Claude ││
│   │ • Storage   │    │  • AI Output    │   │  • Schedule  │   │ • Gemini ││
│   │ • Realtime  │    │    Cache        │   │  • Analytics │   │          ││
│   └─────────────┘    └─────────────────┘   └──────────────┘   └──────────┘│
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    SOCIAL PLATFORM APIs                             │  │
│   │   LinkedIn API   │   Instagram Graph API   │   Twitter/X API        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Philosophy

### Why This Architecture?

**Separation of Concerns at Service Boundaries**
The frontend and backend are fully decoupled. The Next.js app is a pure presentation layer; all business logic lives in FastAPI. This allows independent scaling, independent deployment, and independent testing.

**Async-First Backend**
FastAPI with Python's asyncio handles I/O-bound work (AI API calls, database queries, HTTP to social platforms) concurrently without blocking threads. AI generation calls that take 3–8 seconds per request become non-blocking, allowing the server to serve other users simultaneously.

**Queue-Offloaded Heavy Work**
Content generation, bulk campaign scheduling, and analytics aggregation are offloaded to Celery workers. The API always responds immediately with a task ID; the client polls or receives SSE updates. This prevents timeout failures on slow AI responses.

**Multi-Tenant by Default**
PostgreSQL Row Level Security (RLS) enforces data isolation at the database layer. Even if application logic has a bug, organizations cannot see each other's data. This is a zero-trust approach to multi-tenancy.

**AI Model Routing**
No single AI provider is hardcoded. A model router selects GPT-4o, Claude Sonnet, or Gemini Flash based on task type, cost budget, and speed requirements. This prevents vendor lock-in and optimizes cost.

### Key Tradeoffs

| Decision | Chosen | Alternative | Reason |
|---|---|---|---|
| Background tasks | Celery + Redis | FastAPI BackgroundTasks | Celery is persistent, retryable, and monitorable |
| Auth | Supabase Auth | Auth0 / custom JWT | Supabase gives RLS + Postgres integration natively |
| ORM | SQLAlchemy async | Prisma / Tortoise | Mature ecosystem, async support, Alembic migration tooling |
| AI provider | Multi-router | Single provider | Cost optimization + resilience |
| Deployment | Railway | AWS ECS / GKE | Speed of MVP deployment, lower ops overhead |
| Queue broker | Redis | RabbitMQ | Simpler ops, doubles as cache layer |

### Scalability Rationale

The MVP runs on Railway with a single backend pod and 2 Celery workers. The architecture supports horizontal scaling without changes:
- FastAPI is stateless — add pods behind Railway's load balancer
- Celery workers scale independently — add workers for burst capacity
- Supabase handles PostgreSQL read replicas and PgBouncer connection pooling natively
- Redis (Upstash) is serverless and scales automatically

---

## 3. Frontend Architecture

### Next.js 14 App Router Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   └── layout.tsx              # Auth layout (no sidebar)
│
├── (dashboard)/
│   ├── layout.tsx              # Dashboard shell (sidebar + topbar)
│   ├── page.tsx                # Dashboard home / overview
│   │
│   ├── generate/
│   │   ├── page.tsx            # Content generation hub
│   │   ├── [platform]/
│   │   │   └── page.tsx        # Platform-specific generation
│   │   └── repurpose/
│   │       └── page.tsx        # Repurposing engine
│   │
│   ├── campaigns/
│   │   ├── page.tsx            # Campaign list
│   │   ├── new/
│   │   │   └── page.tsx        # Campaign creation wizard
│   │   └── [id]/
│   │       ├── page.tsx        # Campaign detail
│   │       └── edit/
│   │           └── page.tsx
│   │
│   ├── scheduler/
│   │   ├── page.tsx            # Calendar view
│   │   └── queue/
│   │       └── page.tsx        # Scheduling queue
│   │
│   ├── analytics/
│   │   ├── page.tsx            # Analytics overview
│   │   └── [platform]/
│   │       └── page.tsx        # Per-platform analytics
│   │
│   ├── brand/
│   │   ├── page.tsx            # Brand profile settings
│   │   └── voice/
│   │       └── page.tsx        # Voice cloning setup
│   │
│   └── settings/
│       ├── page.tsx
│       ├── team/
│       │   └── page.tsx
│       └── integrations/
│           └── page.tsx        # Social account OAuth connections
│
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts        # NextAuth API route
│   └── webhooks/
│       └── supabase/
│           └── route.ts        # Supabase webhook handler
│
├── layout.tsx                  # Root layout (providers)
└── globals.css
```

### Component Hierarchy

```
RootLayout (providers: QueryClient, AuthProvider, ThemeProvider)
└── DashboardLayout
    ├── Sidebar (NavigationMenu, OrgSwitcher)
    ├── Topbar (Notifications, UserMenu)
    └── PageContent
        ├── Page-level components (data fetching via server components)
        └── Feature components (client islands)
            ├── ContentGenerator
            │   ├── PlatformSelector
            │   ├── InputForm (topic, tone, brand voice)
            │   ├── GenerationProgress (SSE stream)
            │   └── OutputCards (per-platform results)
            ├── CampaignBuilder
            │   ├── CampaignWizard (multi-step)
            │   ├── PostComposer
            │   └── BulkScheduler
            ├── SchedulerCalendar
            │   ├── CalendarView (FullCalendar or custom)
            │   ├── DraggablePost
            │   └── TimeSlotOptimizer
            └── Shared
                ├── PostCard
                ├── PlatformBadge
                ├── AiThinkingSpinner
                ├── RichTextEditor (Tiptap)
                └── MediaUploader
```

### State Management Strategy

**Zustand** — global client state (non-server-synced):
```typescript
// stores/useGenerationStore.ts
interface GenerationStore {
  activePlatforms: Platform[];
  currentDraft: DraftContent | null;
  generationStatus: 'idle' | 'generating' | 'done' | 'error';
  setDraft: (draft: DraftContent) => void;
  setStatus: (status: GenerationStatus) => void;
}

// stores/useOrgStore.ts
interface OrgStore {
  currentOrg: Organization | null;
  brandProfile: BrandProfile | null;
  setOrg: (org: Organization) => void;
}
```

**TanStack Query (React Query)** — server state, caching, background refetch:
```typescript
// hooks/useContentGenerations.ts
export function useContentGenerations(params: QueryParams) {
  return useQuery({
    queryKey: ['content-generations', params],
    queryFn: () => api.content.list(params),
    staleTime: 1000 * 60 * 5,    // 5 minutes
    gcTime: 1000 * 60 * 30,      // 30 minutes
  });
}

// hooks/useGenerateMutation.ts
export function useGenerateMutation() {
  return useMutation({
    mutationFn: api.content.generate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-generations'] }),
  });
}
```

**Rule of thumb:**
- UI state (modal open, accordion expanded) → local `useState`
- Cross-component UI state (active org, platform selection) → Zustand
- Server data (posts, campaigns, analytics) → TanStack Query
- Form state → React Hook Form

### API Integration Layer

```typescript
// lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
});

// Attach Supabase JWT to every request
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// lib/api/content.ts
export const contentApi = {
  generate: (payload: GenerateRequest) =>
    apiClient.post<GenerateResponse>('/api/v1/content/generate', payload),
  list: (params: ListParams) =>
    apiClient.get<PaginatedResponse<ContentGeneration>>('/api/v1/content', { params }),
  repurpose: (id: string, formats: Platform[]) =>
    apiClient.post<RepurposeResponse>(`/api/v1/content/${id}/repurpose`, { formats }),
};
```

### Real-Time Updates

**Server-Sent Events (SSE)** for AI generation streaming:
```typescript
// hooks/useGenerationStream.ts
export function useGenerationStream(taskId: string | null) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [status, setStatus] = useState<TaskStatus>('pending');

  useEffect(() => {
    if (!taskId) return;
    const session = await supabase.auth.getSession();
    const es = new EventSource(
      `${API_URL}/api/v1/content/stream/${taskId}?token=${session.data.session?.access_token}`
    );
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'chunk') setChunks(prev => [...prev, data.content]);
      if (data.type === 'done') { setStatus('done'); es.close(); }
      if (data.type === 'error') { setStatus('error'); es.close(); }
    };
    return () => es.close();
  }, [taskId]);

  return { chunks, status };
}
```

**Supabase Realtime** for notifications and post status updates:
```typescript
// hooks/useRealtimeNotifications.ts
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      addNotification(payload.new as Notification);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [userId]);
```

### Authentication Flow

```
User clicks "Login"
        │
        ▼
Supabase Auth (email/password or Google OAuth)
        │
        ▼
Supabase issues JWT access_token + refresh_token
        │
        ▼
Next.js stores session via supabase-js (localStorage + cookies)
        │
        ▼
Every API request: Authorization: Bearer <access_token>
        │
        ▼
FastAPI validates JWT against Supabase JWKS endpoint
        │
        ▼
FastAPI extracts user_id + org_id from JWT claims
        │
        ▼
PostgreSQL RLS uses auth.uid() to filter rows
```

---

## 4. Backend Architecture

### FastAPI Application Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, middleware, routers
│   ├── config.py               # Pydantic Settings (env vars)
│   ├── dependencies.py         # Shared DI: db session, current user, org
│   │
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py       # Aggregates all routers
│   │       ├── content.py      # /content endpoints
│   │       ├── campaigns.py    # /campaigns endpoints
│   │       ├── scheduler.py    # /scheduler endpoints
│   │       ├── analytics.py    # /analytics endpoints
│   │       ├── auth.py         # /auth endpoints (profile, tokens)
│   │       ├── users.py        # /users endpoints
│   │       ├── brand.py        # /brand endpoints
│   │       └── social.py       # /social-accounts endpoints
│   │
│   ├── core/
│   │   ├── auth.py             # JWT validation, current_user dependency
│   │   ├── database.py         # SQLAlchemy async engine + session factory
│   │   ├── redis.py            # Redis client singleton
│   │   ├── storage.py          # Supabase Storage client
│   │   └── exceptions.py       # Custom HTTP exception classes
│   │
│   ├── models/                 # SQLAlchemy ORM models (mirrors DB schema)
│   │   ├── organization.py
│   │   ├── user.py
│   │   ├── content.py
│   │   ├── campaign.py
│   │   ├── analytics.py
│   │   └── ...
│   │
│   ├── schemas/                # Pydantic request/response schemas
│   │   ├── content.py
│   │   ├── campaign.py
│   │   └── ...
│   │
│   ├── services/               # Business logic layer
│   │   ├── content_service.py
│   │   ├── campaign_service.py
│   │   ├── scheduler_service.py
│   │   ├── analytics_service.py
│   │   └── brand_service.py
│   │
│   ├── ai/                     # AI pipeline (Section 5)
│   │   ├── router.py           # Model router
│   │   ├── prompts/            # Prompt templates
│   │   ├── chains/             # LangChain chains
│   │   ├── parsers.py          # Output parsers
│   │   └── cache.py            # Semantic cache
│   │
│   └── tasks/                  # Celery tasks (Section 7)
│       ├── celery_app.py
│       ├── content_tasks.py
│       ├── schedule_tasks.py
│       └── analytics_tasks.py
│
├── alembic/                    # Database migrations
│   ├── env.py
│   └── versions/
│
├── tests/
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

### Module Breakdown

**Content Module** (`api/v1/content.py` + `services/content_service.py`)
- `POST /content/generate` — triggers AI generation (enqueues Celery task, returns task_id)
- `GET /content/stream/{task_id}` — SSE endpoint for real-time generation streaming
- `GET /content` — paginated list of all generations for org
- `POST /content/{id}/repurpose` — repurpose existing content to new formats
- `PUT /content/{id}` — save edits to generated content
- `DELETE /content/{id}` — soft delete

**Campaigns Module** (`api/v1/campaigns.py`)
- Full CRUD for campaigns and campaign posts
- Bulk scheduling: assign multiple posts to a campaign with optimal time distribution

**Scheduler Module** (`api/v1/scheduler.py`)
- `POST /scheduler/posts` — schedule a post
- `GET /scheduler/calendar` — get posts for calendar view
- `POST /scheduler/optimal-times` — calculate best posting times per platform
- `DELETE /scheduler/posts/{id}` — cancel a scheduled post

**Analytics Module** (`api/v1/analytics.py`)
- `GET /analytics/overview` — aggregated metrics across all platforms
- `GET /analytics/posts/{id}` — per-post engagement breakdown
- `POST /analytics/sync` — trigger manual analytics pull from social APIs

**AI Module** (`ai/`) — internal, not exposed directly; called by services

**Auth Module** (`api/v1/auth.py`)
- JWT validation middleware
- `GET /auth/me` — current user profile
- `POST /auth/api-keys` — generate API keys for integrations

### Dependency Injection Patterns

```python
# app/dependencies.py

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = verify_supabase_jwt(token)   # validates against Supabase JWKS
    user = await UserRepository(db).get_by_supabase_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_org(
    user: User = Depends(get_current_user),
    org_id: UUID = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    membership = await MembershipRepository(db).get(user.id, org_id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return membership.organization
```

### Async Request Handling

FastAPI runs on uvicorn with asyncio. All database calls use SQLAlchemy's async engine, and all AI API calls use async HTTP clients (httpx). The request lifecycle never blocks the event loop.

```python
# Concurrent AI calls using asyncio.gather
async def generate_all_platforms(request: GenerateRequest) -> dict:
    tasks = [
        ai_router.generate(request, platform="linkedin"),
        ai_router.generate(request, platform="instagram"),
        ai_router.generate(request, platform="twitter"),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return {platform: result for platform, result in zip(platforms, results)}
```

### Background Task Architecture

Long-running tasks (>2s) are never handled synchronously. Flow:

```
API Request → Validate input → Enqueue Celery task → Return {task_id, status: "queued"}
                                        │
                                        ▼
                                Celery Worker picks up task
                                        │
                                        ▼
                                Executes work (AI call, DB write, API call)
                                        │
                                        ▼
                                Updates task status in Redis
                                        │
                                        ▼
                                Client polls GET /tasks/{task_id} or receives SSE push
```

---

## 5. AI Pipeline Architecture

### Multi-Model Router

```python
# app/ai/router.py

class ModelRouter:
    """
    Routes AI requests to the optimal model based on:
    - Task type (creative writing, structured output, classification)
    - User subscription tier (free → Gemini Flash, pro → Claude Sonnet, enterprise → GPT-4o)
    - Cost budget (track token spend per org per month)
    - Response latency requirements
    """

    MODEL_CONFIGS = {
        "gpt-4o": {
            "provider": "openai",
            "cost_per_1k_input": 0.005,
            "cost_per_1k_output": 0.015,
            "max_tokens": 128000,
            "best_for": ["structured_output", "complex_reasoning", "founder_voice"],
            "avg_latency_ms": 4000,
        },
        "claude-sonnet-3-5": {
            "provider": "anthropic",
            "cost_per_1k_input": 0.003,
            "cost_per_1k_output": 0.015,
            "max_tokens": 200000,
            "best_for": ["long_form", "nuanced_tone", "csr_storytelling"],
            "avg_latency_ms": 3500,
        },
        "gemini-flash-1-5": {
            "provider": "google",
            "cost_per_1k_input": 0.000075,
            "cost_per_1k_output": 0.0003,
            "max_tokens": 1000000,
            "best_for": ["bulk_generation", "hashtag_research", "quick_repurpose"],
            "avg_latency_ms": 1500,
        },
    }

    async def route(self, task: AITask, org: Organization) -> str:
        # Check monthly budget
        spend = await self.get_monthly_spend(org.id)
        if spend > org.subscription.monthly_ai_budget:
            return "gemini-flash-1-5"  # cheapest fallback

        # Route by task type
        if task.type in ["founder_voice", "complex_campaign"]:
            return "gpt-4o"
        if task.type in ["csr_story", "long_form_linkedin"]:
            return "claude-sonnet-3-5"
        return "gemini-flash-1-5"
```

### Model Selection Logic

```
Task Type                   → Primary Model      → Fallback
─────────────────────────────────────────────────────────────
Founder voice post          → GPT-4o             → Claude Sonnet
CSR impact story            → Claude Sonnet      → GPT-4o
LinkedIn long-form article  → Claude Sonnet      → GPT-4o
Instagram caption           → Gemini Flash       → Claude Sonnet
Twitter/X thread            → Gemini Flash       → Claude Sonnet
Hashtag generation          → Gemini Flash       → GPT-4o
Carousel outline            → GPT-4o             → Claude Sonnet
Reel script                 → GPT-4o             → Claude Sonnet
Bulk campaign (>10 posts)   → Gemini Flash       → Gemini Flash
Festival post               → Gemini Flash       → Claude Sonnet
Repurposing (1→5 formats)   → Gemini Flash       → Claude Sonnet
```

### Prompt Chain Architecture

```python
# app/ai/chains/content_chain.py
from langchain.chains import SequentialChain

class ContentGenerationChain:
    """
    Chain: Intent Extraction → Platform Adaptation → Tone Application → Quality Check
    """

    def build(self, request: GenerateRequest) -> SequentialChain:
        return SequentialChain(
            chains=[
                IntentExtractionChain(request),     # Extract core message, audience
                PlatformAdaptationChain(request),   # Adapt for LinkedIn/Instagram/Twitter
                ToneApplicationChain(request),      # Apply brand voice
                QualityScoringChain(request),       # Score and optionally regenerate
            ],
            input_variables=["topic", "platform", "brand_voice", "context"],
            output_variables=["content", "hashtags", "quality_score", "metadata"],
        )
```

### Output Parsing and Structured Response Handling

All AI outputs are parsed into validated Pydantic models to prevent malformed responses from propagating:

```python
# app/ai/parsers.py
from pydantic import BaseModel, validator

class LinkedInPostOutput(BaseModel):
    hook: str                           # Opening line (max 150 chars)
    body: str                           # Main content (400-1300 chars)
    cta: str                            # Call to action
    hashtags: list[str]                 # 3-5 hashtags
    emoji_usage: str                    # "none" | "minimal" | "moderate"
    estimated_reach_score: float        # 0.0-1.0

class InstagramCaptionOutput(BaseModel):
    caption: str                        # Max 2200 chars
    hashtags: list[str]                 # 5-30 hashtags
    first_comment_hashtags: list[str]   # Additional hashtags for first comment
    alt_text: str                       # Accessibility alt text suggestion

class TwitterThreadOutput(BaseModel):
    tweets: list[str]                   # Each tweet max 280 chars
    thread_hook: str                    # First tweet optimized for engagement
    cta_tweet: str                      # Final CTA tweet

# Parser with retry logic
class StructuredOutputParser:
    async def parse_with_retry(self, raw_output: str, model: type[BaseModel], max_retries: int = 3):
        for attempt in range(max_retries):
            try:
                # Try JSON extraction first
                json_match = re.search(r'\{.*\}', raw_output, re.DOTALL)
                if json_match:
                    return model.model_validate_json(json_match.group())
            except ValidationError as e:
                if attempt == max_retries - 1:
                    raise AIParseError(f"Failed to parse output after {max_retries} attempts: {e}")
                # Ask LLM to fix its own output
                raw_output = await self.ask_llm_to_fix(raw_output, e)
```

### Token Budgeting and Cost Optimization

```python
# app/ai/budget.py

class TokenBudgetManager:
    MONTHLY_LIMITS = {
        "free":       {"usd": 2.00,  "requests": 50},
        "starter":    {"usd": 15.00, "requests": 500},
        "pro":        {"usd": 60.00, "requests": 2000},
        "enterprise": {"usd": 300.00,"requests": 10000},
    }

    async def check_and_reserve(self, org_id: UUID, estimated_tokens: int, model: str) -> bool:
        """Atomically check budget and reserve tokens. Returns False if budget exceeded."""
        estimated_cost = self.estimate_cost(estimated_tokens, model)
        key = f"budget:{org_id}:{datetime.now().strftime('%Y-%m')}"
        # Atomic increment in Redis
        new_spend = await redis.incrbyfloat(key, estimated_cost)
        await redis.expire(key, 86400 * 35)  # 35-day TTL
        limit = self.MONTHLY_LIMITS[org.subscription_tier]["usd"]
        if new_spend > limit:
            await redis.incrbyfloat(key, -estimated_cost)  # rollback
            return False
        return True

    async def record_actual_usage(self, org_id: UUID, usage: TokenUsage, model: str):
        """Record actual usage after completion; adjust reservation."""
        actual_cost = self.estimate_cost(usage.total_tokens, model)
        await db.insert(AIUsageLog(org_id=org_id, model=model, ...))
```

### Caching Layer — Redis Semantic Cache

```python
# app/ai/cache.py

class SemanticCache:
    """
    Cache AI outputs by semantic similarity, not exact string match.
    Uses text-embedding-3-small to embed prompts and cosine similarity to find cache hits.
    """
    SIMILARITY_THRESHOLD = 0.95   # 95% similar = cache hit
    TTL_SECONDS = 86400 * 7       # 7-day cache

    async def get(self, prompt: str, platform: str) -> CachedOutput | None:
        embedding = await self.embed(prompt)
        # Search Redis vector store (using Redis Search module)
        results = await redis.ft("cache_idx").search(
            Query(f"*=>[KNN 5 @embedding $vec AS score]")
            .sort_by("score")
            .paging(0, 1)
            .dialect(2),
            query_params={"vec": embedding.tobytes()},
        )
        if results.docs and float(results.docs[0].score) > self.SIMILARITY_THRESHOLD:
            return CachedOutput(**json.loads(results.docs[0].output))
        return None

    async def set(self, prompt: str, platform: str, output: dict):
        embedding = await self.embed(prompt)
        cache_key = f"cache:{uuid4()}"
        await redis.hset(cache_key, mapping={
            "embedding": embedding.tobytes(),
            "output": json.dumps(output),
            "platform": platform,
            "created_at": datetime.utcnow().isoformat(),
        })
        await redis.expire(cache_key, self.TTL_SECONDS)
```

### Retry Logic and Fallback Chains

```python
# app/ai/retry.py
import tenacity

class AIClientWithRetry:
    @tenacity.retry(
        wait=tenacity.wait_exponential(multiplier=1, min=2, max=30),
        stop=tenacity.stop_after_attempt(3),
        retry=tenacity.retry_if_exception_type((RateLimitError, APITimeoutError)),
        before_sleep=tenacity.before_sleep_log(logger, logging.WARNING),
    )
    async def call_with_fallback(self, task: AITask) -> str:
        primary_model = await self.router.route(task)
        try:
            return await self.call_model(primary_model, task)
        except (ModelOverloadedError, APIError) as e:
            logger.warning(f"Primary model {primary_model} failed: {e}. Falling back.")
            fallback_model = self.FALLBACK_MAP[primary_model]
            return await self.call_model(fallback_model, task)
```

### Rate Limiting Per User/Tier

```python
# app/api/v1/content.py — Rate limiting via Redis sliding window

RATE_LIMITS = {
    "free":       {"requests": 10, "window_seconds": 3600},   # 10/hour
    "starter":    {"requests": 50, "window_seconds": 3600},   # 50/hour
    "pro":        {"requests": 200, "window_seconds": 3600},  # 200/hour
    "enterprise": {"requests": 1000, "window_seconds": 3600}, # 1000/hour
}

async def check_rate_limit(org: Organization = Depends(get_current_org)):
    limit = RATE_LIMITS[org.subscription_tier]
    key = f"ratelimit:{org.id}:{int(time.time() // limit['window_seconds'])}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, limit["window_seconds"])
    if count > limit["requests"]:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

---

## 6. Content Generation Pipeline

### Full Pipeline Flow

```
User Input
    │
    ├── topic / brief
    ├── target platform(s)
    ├── brand voice profile
    ├── campaign context (optional)
    └── additional notes
         │
         ▼
    [1] INPUT VALIDATION & SANITIZATION
    ├── Length check (topic: 10-500 chars)
    ├── Content policy screening (profanity, NSFW)
    └── Budget check (token budget available?)
         │
         ▼
    [2] INTENT EXTRACTION
    ├── Core message identification
    ├── Audience inference (NGO donors, CSR stakeholders, general public)
    ├── Content type classification (awareness, impact story, CTA, educational)
    └── Tone recommendation
         │
         ▼
    [3] CONTEXT ENRICHMENT
    ├── Brand voice profile injection
    ├── Recent campaign context injection
    ├── Festival/awareness day check
    └── Industry-specific terminology lookup
         │
         ▼
    [4] PLATFORM ADAPTATION
    ├── LinkedIn: Long-form, professional, data-backed, no emoji overuse
    ├── Instagram: Visual-first, emoji-friendly, story-driven, CTA-heavy
    ├── Twitter/X: Punchy, thread-able, hashtag-strategic, conversational
    └── Cross-platform: Consistent message, adapted format
         │
         ▼
    [5] AI GENERATION (via Model Router)
    ├── Parallel generation across platforms (asyncio.gather)
    ├── Streaming output via SSE to frontend
    └── Structured output parsing
         │
         ▼
    [6] QUALITY SCORING
    ├── Readability score (Flesch-Kincaid)
    ├── Brand voice alignment (cosine similarity vs. brand voice embedding)
    ├── Platform best-practice compliance (length, hashtag count, etc.)
    ├── Engagement potential score (ML model trained on platform data)
    └── Auto-regenerate if score < threshold
         │
         ▼
    [7] POST-PROCESSING
    ├── Hashtag research & injection (trending + evergreen)
    ├── Emoji optimization
    ├── CTA strength scoring
    └── Metadata extraction (word count, reading time, estimated reach)
         │
         ▼
    [8] OUTPUT DELIVERY
    ├── Stream chunks to frontend via SSE
    ├── Persist to content_generations table
    └── Return structured ContentGenerationResult
```

### Repurposing Engine: 1 Idea → 5 Formats

```python
# app/ai/chains/repurpose_chain.py

class RepurposeEngine:
    """
    Takes a seed piece of content (or just a topic) and generates:
    1. LinkedIn post (professional, 600-1200 chars)
    2. Instagram caption (story-driven, with hashtags)
    3. Twitter/X thread (5-7 tweets)
    4. Instagram Reel script (60-90 second talking points)
    5. Carousel slide outline (6-8 slides with copy per slide)
    """

    async def repurpose(self, seed: SeedContent, org: Organization) -> RepurposeResult:
        # All 5 formats generated in parallel
        tasks = {
            "linkedin":   self.generate_linkedin(seed, org),
            "instagram":  self.generate_instagram(seed, org),
            "twitter":    self.generate_twitter_thread(seed, org),
            "reel":       self.generate_reel_script(seed, org),
            "carousel":   self.generate_carousel(seed, org),
        }
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        return RepurposeResult(
            source_id=seed.id,
            formats={key: result for key, result in zip(tasks.keys(), results) if not isinstance(result, Exception)},
            failed_formats=[key for key, result in zip(tasks.keys(), results) if isinstance(result, Exception)],
        )

    async def generate_carousel(self, seed: SeedContent, org: Organization) -> CarouselOutline:
        prompt = CAROUSEL_PROMPT_TEMPLATE.format(
            content=seed.text,
            brand_voice=org.brand_profile.voice_description,
            industry="sanitation/menstrual hygiene",
            slide_count=7,
        )
        raw = await self.ai_client.generate(prompt, model="gpt-4o")
        return self.parser.parse(raw, CarouselOutline)
```

### Brand Voice Injection Pipeline

```python
# app/ai/brand_voice.py

class BrandVoiceInjector:
    """
    Encodes an organization's brand voice into the prompt context.

    Brand voice dimensions:
    - Formality: 1-5 (1=casual/conversational, 5=formal/corporate)
    - Empathy: 1-5 (emotional resonance level)
    - Data-drivenness: 1-5 (facts and stats emphasis)
    - Boldness: 1-5 (direct calls-to-action, provocative statements)
    - Storytelling: 1-5 (narrative vs. informational)
    """

    def build_voice_context(self, profile: BrandVoiceProfile) -> str:
        return f"""
BRAND VOICE GUIDELINES:
- Organization: {profile.org_name}
- Mission: {profile.mission_statement}
- Tone: {profile.tone_descriptors}  (e.g., "compassionate, urgent, evidence-based")
- Avoid: {profile.avoid_list}       (e.g., "corporate jargon, passive voice, vague language")
- Signature phrases: {profile.signature_phrases}
- Example posts for reference:
{self.format_examples(profile.example_posts[:3])}
        """
```

### CSR Storytelling Pipeline

```python
# app/ai/chains/csr_chain.py

CSR_STORY_STRUCTURE = """
CSR STORYTELLING FRAMEWORK (for {org_name}):

1. HOOK (1-2 sentences): Start with a compelling statistic or human story
2. PROBLEM (2-3 sentences): The specific sanitation/hygiene challenge addressed
3. INTERVENTION (3-4 sentences): What the organization did — specific, measurable
4. IMPACT (3-4 sentences): Quantified outcomes (lives reached, schools covered, etc.)
5. CALL TO ACTION (1-2 sentences): What the reader can do next

Impact metrics available: {impact_data}
Beneficiary stories: {story_snippets}
Campaign name: {campaign_name}
"""
```

### Founder Voice Cloning Pipeline

```python
# app/ai/founder_voice.py

class FounderVoiceCloner:
    """
    Analyzes sample posts/writing from the founder and extracts stylistic patterns:
    - Sentence length distribution
    - Vocabulary preferences
    - Personal anecdote frequency
    - Signature opening patterns
    - Emoji usage patterns
    - Hashtag style (strategic vs. descriptive)
    """

    async def analyze_samples(self, samples: list[str]) -> FounderVoiceProfile:
        analysis_prompt = FOUNDER_ANALYSIS_PROMPT.format(samples="\n---\n".join(samples))
        raw = await self.ai_client.generate(analysis_prompt, model="gpt-4o")
        return self.parser.parse(raw, FounderVoiceProfile)

    async def generate_in_voice(self, topic: str, profile: FounderVoiceProfile) -> str:
        generation_prompt = FOUNDER_VOICE_PROMPT.format(
            topic=topic,
            voice_profile=profile.model_dump_json(indent=2),
        )
        return await self.ai_client.generate(generation_prompt, model="gpt-4o")
```

---

## 7. Queue Architecture

### Celery + Redis Broker Setup

```python
# app/tasks/celery_app.py

from celery import Celery

celery_app = Celery(
    "brandora",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.content_tasks",
        "app.tasks.schedule_tasks",
        "app.tasks.analytics_tasks",
        "app.tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,             # Ack only after task completes (prevents loss on worker crash)
    worker_prefetch_multiplier=1,    # One task at a time per worker (AI tasks are heavy)
    result_expires=86400,            # Results expire after 24h

    # Priority queues
    task_queues={
        "high":    {"exchange": "high",    "routing_key": "high"},
        "default": {"exchange": "default", "routing_key": "default"},
        "low":     {"exchange": "low",     "routing_key": "low"},
    },
    task_default_queue="default",
    task_routes={
        "app.tasks.content_tasks.generate_content":  {"queue": "high"},
        "app.tasks.schedule_tasks.publish_post":     {"queue": "high"},
        "app.tasks.analytics_tasks.sync_analytics":  {"queue": "low"},
        "app.tasks.content_tasks.bulk_generate":     {"queue": "low"},
    },
)
```

### Task Types

**Content Generation Tasks** (`tasks/content_tasks.py`)
```python
@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue="high",
    soft_time_limit=120,   # Kill gracefully after 2 min
    time_limit=150,         # Hard kill after 2.5 min
)
def generate_content(self, task_id: str, request_data: dict, org_id: str):
    """Single content generation task. Updates Redis status throughout."""
    try:
        # Update status: generating
        redis.hset(f"task:{task_id}", "status", "generating")
        result = asyncio.run(content_service.generate(request_data, org_id))
        redis.hset(f"task:{task_id}", mapping={"status": "done", "result": result.json()})
        return result.dict()
    except Exception as exc:
        redis.hset(f"task:{task_id}", "status", "error")
        raise self.retry(exc=exc)

@celery_app.task(queue="low")
def bulk_generate(campaign_id: str, org_id: str):
    """Generate all posts for a campaign in parallel sub-tasks."""
    campaign = db.get_campaign(campaign_id)
    group(generate_content.s(post.id, post.request_data, org_id) for post in campaign.posts)()
```

**Scheduling Tasks** (`tasks/schedule_tasks.py`)
```python
@celery_app.task(queue="high")
def publish_post(scheduled_post_id: str):
    """Called by Celery Beat at scheduled time. Publishes post to social platform."""
    post = db.get_scheduled_post(scheduled_post_id)
    platform_client = get_platform_client(post.platform, post.social_account)
    result = platform_client.publish(post)
    db.mark_published(scheduled_post_id, result.platform_post_id)
    analytics_tasks.track_new_post.delay(result.platform_post_id, post.platform)
```

**Analytics Tasks** (`tasks/analytics_tasks.py`)
```python
@celery_app.task(queue="low")
def sync_analytics(org_id: str, platform: str):
    """Pull fresh analytics from platform APIs. Runs every 4 hours via Celery Beat."""
    social_account = db.get_social_account(org_id, platform)
    client = get_platform_client(platform, social_account)
    posts = db.get_recent_published_posts(org_id, platform, days=7)
    for post in posts:
        metrics = client.get_post_metrics(post.platform_post_id)
        db.upsert_post_analytics(post.id, metrics)
```

### Priority Queues

```
HIGH queue   → generate_content, publish_post (user-facing, time-sensitive)
DEFAULT queue → send_notification, process_webhook
LOW queue    → sync_analytics, bulk_generate, cleanup_expired_tasks
```

### Dead Letter Queue Handling

```python
# Tasks that fail after all retries go to the dead letter queue
celery_app.conf.task_queues["dead_letter"] = {
    "exchange": "dead_letter",
    "routing_key": "dead_letter",
}

# Dead letter handler — logs to database for manual review
@celery_app.task(queue="dead_letter")
def handle_dead_letter(task_name: str, task_id: str, error: str, args: dict):
    db.insert(FailedTask(task_name=task_name, task_id=task_id, error=error, args=args))
    # Alert ops team via Sentry
    sentry_sdk.capture_message(f"Dead letter: {task_name} {task_id}", level="error")
```

### Task Monitoring — Flower

Flower is deployed alongside Celery workers, accessible at `/flower` (password-protected):
- Real-time task monitoring
- Worker health status
- Queue depth graphs
- Failed task inspection and re-queueing

---

## 8. Scheduling Pipeline

### Social Media OAuth Flows

```
User clicks "Connect LinkedIn"
         │
         ▼
Backend generates OAuth state (CSRF token) → stores in Redis (5-min TTL)
         │
         ▼
Redirect user to LinkedIn OAuth URL with state + scopes
(w_member_social, r_basicprofile, r_organization_social, rw_organization_admin)
         │
         ▼
LinkedIn redirects to /api/v1/social/oauth/callback/linkedin?code=...&state=...
         │
         ▼
Backend validates state → exchanges code for access_token + refresh_token
         │
         ▼
Tokens encrypted (AES-256) and stored in social_accounts table
         │
         ▼
User sees "LinkedIn Connected ✓" in dashboard
```

Platform-specific OAuth scopes:
- **LinkedIn:** `w_member_social` `r_organization_social` `rw_organization_admin`
- **Instagram/Meta:** `instagram_basic` `instagram_content_publish` `instagram_manage_insights`
- **Twitter/X:** `tweet.read` `tweet.write` `users.read` `offline.access`

### Post Scheduling Data Flow

```
User schedules post in dashboard
         │
         ▼
POST /api/v1/scheduler/posts
  { content_id, platform, social_account_id, scheduled_at, media_urls }
         │
         ▼
Creates scheduled_posts record (status: "scheduled")
         │
         ▼
Celery Beat checks scheduled_posts every minute:
  SELECT * FROM scheduled_posts
  WHERE scheduled_at <= NOW() + INTERVAL '2 minutes'
  AND status = 'scheduled'
         │
         ▼
For each due post: enqueue publish_post.apply_async(eta=scheduled_at)
         │
         ▼
At scheduled_at: Celery worker calls Platform API
         │
         ├── Success: update status="published", store platform_post_id
         └── Failure: increment retry_count, reschedule with backoff
                     After 3 failures: status="failed", notify user
```

### Optimal Time Calculation

```python
# app/services/scheduler_service.py

class OptimalTimeCalculator:
    """
    Calculates best posting times based on:
    1. Platform best-practice defaults (research-backed)
    2. Organization's historical engagement data (post-MVP)
    3. Target audience timezone
    """

    PLATFORM_DEFAULTS = {
        "linkedin": {
            "best_days": ["tuesday", "wednesday", "thursday"],
            "best_hours_utc": [7, 8, 9, 12, 17, 18],   # Adjusted per user timezone
            "avoid": ["saturday", "sunday"],
        },
        "instagram": {
            "best_days": ["monday", "tuesday", "wednesday", "friday"],
            "best_hours_utc": [6, 7, 8, 9, 11, 12, 19, 20],
            "avoid": [],
        },
        "twitter": {
            "best_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "best_hours_utc": [8, 9, 12, 15, 17, 18],
            "avoid": ["sunday"],
        },
    }

    def suggest_times(
        self, platform: str, count: int, user_timezone: str, start_date: date
    ) -> list[datetime]:
        tz = pytz.timezone(user_timezone)
        slots = []
        current = datetime.combine(start_date, time(0, 0), tzinfo=tz)
        config = self.PLATFORM_DEFAULTS[platform]
        while len(slots) < count:
            if current.strftime("%A").lower() in config["best_days"]:
                for hour in config["best_hours_utc"]:
                    candidate = current.replace(hour=hour)
                    if self.is_slot_available(candidate, platform):
                        slots.append(candidate.astimezone(pytz.utc))
            current += timedelta(days=1)
        return slots[:count]
```

### Platform API Rate Limit Management

```python
# app/core/platform_clients.py

class RateLimitedPlatformClient:
    """Tracks API rate limits per platform and enforces backoff."""

    RATE_LIMITS = {
        "linkedin_share": {"calls": 100, "per_day": True},
        "instagram_publish": {"calls": 50, "per_hour": True},
        "twitter_tweet": {"calls": 300, "per_15min": True},
    }

    async def call_with_rate_limit(self, endpoint: str, payload: dict) -> dict:
        limit = self.RATE_LIMITS[endpoint]
        key = f"ratelimit:platform:{self.platform}:{endpoint}:{self.window_key(limit)}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, self.window_seconds(limit))
        if count > limit["calls"]:
            wait = await redis.ttl(key)
            raise PlatformRateLimitError(f"Rate limit hit for {endpoint}. Retry in {wait}s")
        return await self.http_client.post(endpoint, json=payload)
```

---

## 9. Database Architecture

### Supabase PostgreSQL Structure Overview

Supabase provides:
- PostgreSQL 15 with full SQL support
- PgBouncer connection pooling (transaction mode, 10,000 connections)
- Row Level Security enforced at the database layer
- Real-time via Postgres logical replication → WebSocket broadcast

All tables live in the `public` schema. Auth tables live in Supabase's `auth` schema (managed by Supabase).

### Row Level Security Strategy

Every table with multi-tenant data has RLS enabled. The core pattern:

```sql
-- Every table has org_id column
-- RLS policy checks org_id against user's active organization
-- Users get their org_id from JWT custom claims

CREATE POLICY "org_isolation" ON content_generations
  USING (org_id = (current_setting('app.current_org_id'))::uuid);

-- The FastAPI backend sets this at the start of each request:
-- SET LOCAL app.current_org_id = '<org_id>';
```

### Indexing Strategy

- **Primary keys:** UUID with `gen_random_uuid()` default
- **Foreign keys:** Always indexed
- **Time-based queries:** BRIN indexes on `created_at`, B-tree on `scheduled_at`
- **Full-text search:** GIN index on content text columns
- **Partial indexes:** e.g., `WHERE status = 'scheduled'` for scheduler queries
- **Composite indexes:** `(org_id, created_at DESC)` for list queries (most common pattern)

### Connection Pooling

PgBouncer in transaction mode (via Supabase):
- Pool size: 25 connections per app instance
- Transaction mode: connection returned to pool after each transaction
- Direct connection only for migrations (Alembic)

### Data Partitioning for Analytics

The `post_analytics` and `analytics_snapshots` tables are partitioned by month using PostgreSQL declarative partitioning:

```sql
CREATE TABLE post_analytics (
    -- ... columns
) PARTITION BY RANGE (recorded_at);

CREATE TABLE post_analytics_2025_01 PARTITION OF post_analytics
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

New partitions are created automatically by a monthly cron task.

---

## 10. Caching Strategy

### Redis L1 Cache — Hot Data and Sessions

| Key Pattern | Data | TTL |
|---|---|---|
| `session:{user_id}` | User session data | 24 hours |
| `org:{org_id}:profile` | Organization + brand profile | 1 hour |
| `org:{org_id}:social_accounts` | Connected social accounts | 30 minutes |
| `user:{user_id}:orgs` | User's organizations | 1 hour |
| `task:{task_id}` | Celery task status + result | 24 hours |
| `ratelimit:{org_id}:{window}` | Rate limit counters | Window duration |
| `budget:{org_id}:{month}` | Monthly AI spend counter | 35 days |

### CDN Caching — Static Assets

Supabase Storage media assets are served via Supabase CDN (Cloudflare-backed):
- `Cache-Control: public, max-age=31536000, immutable` for media uploads
- `Cache-Control: public, max-age=3600` for profile images

### API Response Caching

```python
# Selective response caching for expensive, rarely-changing endpoints
@router.get("/analytics/overview")
@cache(ttl=300, key_fn=lambda req: f"analytics:{req.org.id}:{date.today()}")
async def get_analytics_overview(org: Organization = Depends(get_current_org)):
    ...

# Festival calendar (changes monthly at most)
@router.get("/content/festival-calendar")
@cache(ttl=86400, key_fn=lambda req: f"festivals:{date.today().strftime('%Y-%m')}")
async def get_festival_calendar():
    ...
```

### AI Output Caching — Semantic Similarity

See Section 5 for the full semantic cache implementation. Cache hit rates target >30% for steady-state usage patterns (users generating similar content over time).

---

## 11. Authentication & Authorization

### Supabase Auth with JWT

Supabase Auth handles:
- Email/password signup and login
- Email verification and password reset flows
- Google OAuth (for convenience)
- JWT issuance (RS256, signed with Supabase project key)
- Refresh token rotation

Custom JWT claims injected via Supabase `auth.hook`:
```json
{
  "sub": "user-uuid",
  "email": "user@org.com",
  "app_metadata": {
    "org_ids": ["org-uuid-1"],
    "active_org": "org-uuid-1",
    "role": "admin"
  },
  "exp": 3600
}
```

### RBAC Model

| Role | Permissions |
|---|---|
| `owner` | All permissions, billing management, org deletion |
| `admin` | All content ops, team management, integrations |
| `manager` | Create/edit campaigns, schedule posts, view analytics |
| `editor` | Generate content, edit drafts, cannot publish |
| `viewer` | Read-only access to analytics and published content |

Enforced at two levels:
1. **API level:** FastAPI dependency checks role from JWT claims before handler executes
2. **Database level:** RLS policies check `user_organization_memberships.role`

### API Key Management

Organizations can generate API keys for programmatic access (webhooks, integrations):
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 of the key (never stored in plain text)
    key_prefix TEXT NOT NULL,          -- First 8 chars, shown in UI (e.g. "brd_a1b2")
    name TEXT,
    scopes TEXT[],                     -- ['content:read', 'content:write', 'analytics:read']
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### OAuth for Social Platforms

Platform OAuth tokens stored encrypted in `social_accounts` table:
- Encryption: AES-256-GCM with org-specific key derived from master secret
- Token refresh: Celery Beat task refreshes tokens before expiry (checks every 6 hours)
- Revocation: Stored in Redis with TTL until next sync

---

## 12. File Storage

### Supabase Storage for Media Assets

Bucket structure:
```
brandora-media/
├── {org_id}/
│   ├── uploads/         # User-uploaded images/videos
│   ├── generated/       # AI-generated media (future)
│   └── brand/           # Logos, brand assets
```

Storage policies:
```sql
-- Users can only upload to their org's bucket path
CREATE POLICY "org_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'brandora-media' AND
    (storage.foldername(name))[1] = (SELECT org_id::text
      FROM user_organization_memberships
      WHERE user_id = auth.uid() LIMIT 1)
  );
```

### Image Optimization Pipeline

```
User uploads image
       │
       ▼
Supabase Storage (original file stored)
       │
       ▼
Supabase Image Transformation (on-demand):
  - Thumbnail: ?width=200&height=200&resize=cover
  - Preview: ?width=800&quality=80
  - Social-optimized: ?width=1200&height=630 (OG image)
       │
       ▼
CDN delivers optimized version with cache headers
```

---

## 13. Monitoring & Observability

### Structured JSON Logging

```python
# app/core/logging.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)

# Usage in request handler:
log = structlog.get_logger()
log.info(
    "content.generated",
    org_id=str(org.id),
    user_id=str(user.id),
    platform=request.platform,
    model_used=result.model,
    tokens_used=result.token_count,
    latency_ms=elapsed,
)
```

### APM — Sentry

```python
# main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENVIRONMENT,
    traces_sample_rate=0.1,    # 10% of requests traced for performance
    profiles_sample_rate=0.1,
    integrations=[
        FastApiIntegration(transaction_style="endpoint"),
        CeleryIntegration(monitor_beat_tasks=True),
        SqlalchemyIntegration(),
    ],
)
```

### Metrics — Prometheus (Post-MVP)

Prometheus metrics exported at `/metrics` (behind internal auth):
- `brandora_content_generation_total{platform, model, status}`
- `brandora_ai_tokens_used_total{model, org_tier}`
- `brandora_posts_published_total{platform, status}`
- `brandora_task_duration_seconds{task_name, queue}`
- `brandora_active_social_accounts{platform}`

Grafana dashboards for:
- AI cost per org per day
- Content generation success/error rates
- Celery queue depth over time
- Platform API error rates

### Uptime Monitoring

- **BetterStack** (or similar): HTTP checks every 60 seconds on `/api/v1/health`
- **Health check endpoint:**
```python
@app.get("/api/v1/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    # Check DB, Redis, and Celery worker connectivity
    await db.execute(text("SELECT 1"))
    await redis.ping()
    celery_inspect = celery_app.control.inspect(timeout=3)
    workers = celery_inspect.ping() or {}
    return {
        "status": "healthy",
        "database": "ok",
        "redis": "ok",
        "celery_workers": len(workers),
        "version": settings.APP_VERSION,
    }
```

---

## 14. API Gateway Pattern

### Rate Limiting

Applied at two levels:
1. **Infrastructure level (Railway):** Basic DDoS protection, IP-based rate limiting
2. **Application level (FastAPI middleware):** Per-org, per-tier rate limiting in Redis

### Auth Middleware

```python
# app/main.py
app.add_middleware(
    SupabaseAuthMiddleware,
    public_paths=["/api/v1/health", "/api/v1/auth/login", "/api/v1/webhooks"],
)

# Middleware flow:
# 1. Extract Bearer token from Authorization header
# 2. Verify JWT signature against Supabase JWKS endpoint (cached in Redis 1hr)
# 3. Attach user claims to request state
# 4. Set PostgreSQL role and org_id for RLS: SET LOCAL app.current_org_id = '...'
```

### Request Routing

All external requests pass through a single entry point:
```
Client → Railway Load Balancer → FastAPI (uvicorn) → Router → Handler
                                                              │
                                          ┌──────────────────┤
                                          │                  │
                                     Sync response      Async (enqueue)
                                          │                  │
                                     Return data       Return task_id
```

### CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,   # ["https://app.brandora.ai"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Organization-Id"],
)
```

---

## 15. Security Architecture

### HTTPS

All traffic is TLS 1.2+. Railway terminates TLS at the load balancer. HTTP → HTTPS redirect enforced. HSTS header set with 1-year max-age.

### Input Validation

All inputs validated by Pydantic v2 at API boundaries. No raw SQL string concatenation — all queries use SQLAlchemy parameterized statements.

### SQL Injection Prevention

SQLAlchemy ORM with parameterized queries everywhere. Direct SQL only in Alembic migrations and RLS policy definitions (reviewed manually).

### Secrets Management

- All secrets in Railway environment variables, never in code
- Supabase JWT secret never exposed to frontend
- Platform OAuth secrets never logged
- API keys stored as SHA-256 hashes only

### Security Headers

```python
app.add_middleware(
    SecurityHeadersMiddleware,
    headers={
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; ...",
    }
)
```

### Social OAuth Token Security

- Platform tokens encrypted with AES-256-GCM before database storage
- Encryption key stored in Railway secrets, not in database
- Tokens never logged or included in API responses
- Token refresh happens server-side only

---

## 16. Complete System Diagram

```
═══════════════════════════════════════════════════════════════════════════════
                         BRANDORA AI — COMPLETE SYSTEM
═══════════════════════════════════════════════════════════════════════════════

  USERS                  FRONTEND                    BACKEND
  ──────────────────────────────────────────────────────────────────────────
  NGO Director      ┌────────────────────┐      ┌─────────────────────────┐
  CSR Manager  ────►│  Next.js 14        │─────►│  FastAPI (Python 3.11)  │
  Social Manager    │  App Router        │      │                         │
  Founder           │  Tailwind/Shadcn   │◄─────│  /api/v1/              │
                    │  Zustand+RQ        │ REST │  ├── content/           │
                    │  Supabase-js Auth  │ +SSE │  ├── campaigns/         │
                    └────────────────────┘      │  ├── scheduler/         │
                              │                 │  ├── analytics/         │
                              │ Auth            │  ├── brand/             │
                              ▼                 │  ├── social/            │
                    ┌─────────────────┐         │  └── auth/              │
                    │ Supabase Auth   │         └────────────┬────────────┘
                    │ (JWT + OAuth)   │                      │
                    └─────────────────┘          ┌──────────┼──────────┐
                                                 │          │          │
  ──────────────────────────────────────── DATA LAYER ──────┼──────────┼──
                                                 │          │          │
                    ┌────────────────────┐        ▼          ▼          ▼
                    │   Supabase         │  ┌─────────┐ ┌────────┐ ┌────────┐
                    │                   │  │ SQLAlch │ │ Redis  │ │Celery  │
                    │ ┌──────────────┐  │  │emy ORM  │ │ Cache  │ │Workers │
                    │ │ PostgreSQL   │◄─┼──┤ Queries │ │        │ │        │
                    │ │ (RLS)        │  │  └─────────┘ │Sessions│ │content │
                    │ │              │  │              │AI Cache│ │schedule│
                    │ │ • orgs       │  │              │RateLim.│ │analytic│
                    │ │ • users      │  │              │TaskStat│ └────────┘
                    │ │ • content    │  │              │BudgetTr│     │
                    │ │ • campaigns  │  │              └────────┘     │
                    │ │ • scheduled  │  │                             │
                    │ │ • analytics  │  │              ┌──────────────┘
                    │ └──────────────┘  │              ▼
                    │                   │        ┌─────────────────────────┐
                    │ ┌──────────────┐  │        │   AI MODEL ROUTER       │
                    │ │  Storage     │  │        │                         │
                    │ │  (CDN)       │  │        │  ┌─────────────────┐    │
                    │ └──────────────┘  │        │  │ GPT-4o          │    │
                    │                   │        │  │ (OpenAI API)    │    │
                    │ ┌──────────────┐  │        │  └─────────────────┘    │
                    │ │  Realtime    │  │        │  ┌─────────────────┐    │
                    │ │  (Postgres   │  │        │  │ Claude Sonnet   │    │
                    │ │  replication)│  │        │  │ (Anthropic API) │    │
                    │ └──────────────┘  │        │  └─────────────────┘    │
                    └────────────────────┘        │  ┌─────────────────┐    │
                                                 │  │ Gemini Flash    │    │
  ── EXTERNAL PLATFORMS ───────────────────────  │  │ (Google API)    │    │
                                                 │  └─────────────────┘    │
  ┌──────────────┐ ┌──────────────┐ ┌──────────┐│                         │
  │  LinkedIn    │ │  Instagram   │ │ Twitter/ ││  Pipeline:              │
  │  API         │ │  Graph API   │ │ X API    ││  Intent → Adapt →       │
  │              │ │              │ │          ││  Tone → Score → Output  │
  │  OAuth       │ │  OAuth       │ │  OAuth   ││                         │
  │  Publishing  │ │  Publishing  │ │  Publish ││  Semantic Cache (Redis) │
  │  Analytics   │ │  Insights    │ │  Metrics ││  Token Budget Tracker   │
  └──────────────┘ └──────────────┘ └──────────┘└─────────────────────────┘
         ▲                ▲               ▲
         └────────────────┴───────────────┘
                   Celery publish_post tasks
                   (scheduled via Celery Beat)


  ── MONITORING & OPS ─────────────────────────────────────────────────────

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   Sentry     │  │  Flower      │  │  BetterStack │  │  Railway     │
  │   APM +      │  │  Celery      │  │  Uptime      │  │  Deployment  │
  │   Error      │  │  Monitoring  │  │  Monitoring  │  │  Logs        │
  │   Tracking   │  │              │  │              │  │              │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

═══════════════════════════════════════════════════════════════════════════════
```

---

*End of SYSTEM_ARCHITECTURE.md*
