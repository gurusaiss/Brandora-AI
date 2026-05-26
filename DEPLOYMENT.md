# Brandora AI — Complete Deployment Guide

> **Stack**: FastAPI + Next.js 14 + PostgreSQL (Supabase) + Redis + Celery
> **Deployment Target**: Railway (MVP) → AWS (Production Scale)
> **Last Updated**: 2026-05-22

---

## Table of Contents

1. [Deployment Philosophy](#1-deployment-philosophy)
2. [Local Development Setup](#2-local-development-setup)
3. [Docker Configuration](#3-docker-configuration)
4. [Railway Deployment (MVP)](#4-railway-deployment-mvp)
5. [CI/CD with GitHub Actions](#5-cicd-with-github-actions)
6. [Environment Management](#6-environment-management)
7. [Database Migrations](#7-database-migrations)
8. [Monitoring Setup](#8-monitoring-setup)
9. [Security Hardening](#9-security-hardening)
10. [AWS Migration Plan (Month 6+)](#10-aws-migration-plan-month-6)
11. [Cost Optimization](#11-cost-optimization)
12. [Scaling Strategy](#12-scaling-strategy)

---

## 1. Deployment Philosophy

### The Two Phases

**Phase 1 — MVP (Months 1-5): Ship fast, stay cheap**
- Railway for all infrastructure. One command to deploy.
- Supabase for managed PostgreSQL + auth primitives.
- No Kubernetes, no VPCs, no on-call rotations.
- Single region (Mumbai / ap-south-1 equivalent).
- Target: < $100/month operational cost.
- Acceptable downtime: single-digit hours/year.

**Phase 2 — Production (Month 6+): Reliability and scale**
- Migrate to AWS ECS Fargate + RDS + ElastiCache.
- Multi-AZ for zero downtime deployments.
- CDN (CloudFront) in front of frontend.
- Auto-scaling based on queue depth and CPU.
- Target: 99.9% uptime SLA.
- Cost scales with usage, not fixed overhead.

### Core Deployment Principles

- **Infrastructure as Code from day one** — even on Railway, use `railway.toml` and GitHub Actions so nothing is clickops-only.
- **Immutable deployments** — Docker images are built once, tagged by git SHA, deployed without modification.
- **12-factor compliance** — All config via environment variables. Never commit secrets.
- **Health checks everywhere** — Every service has a `/health` endpoint. Railway and load balancers use them.
- **Rollback in < 5 minutes** — Every deployment is atomic; the previous Docker image is always available.

---

## 2. Local Development Setup

### 2.1 Prerequisites

| Tool         | Version  | Install                              |
|--------------|----------|--------------------------------------|
| Python       | 3.11+    | pyenv recommended                    |
| Node.js      | 20 LTS   | nvm recommended                      |
| Docker       | 24+      | Docker Desktop                       |
| Docker Compose | 2.20+  | Bundled with Docker Desktop          |
| Git          | 2.40+    | Standard                             |
| Railway CLI  | latest   | `npm install -g @railway/cli`        |
| pnpm         | 8+       | `npm install -g pnpm`               |
| uv           | latest   | `pip install uv` (fast Python deps)  |

### 2.2 Repository Structure

```
brandora-ai/
├── backend/               # FastAPI application
├── dashboard/             # Next.js 14 frontend
├── .github/
│   └── workflows/
├── docker-compose.yml     # Local development
├── docker-compose.prod.yml # Production reference
├── .env.example
└── Makefile               # Convenience commands
```

### 2.3 Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/brandora-ai.git
cd brandora-ai

# 2. Copy environment template
cp .env.example .env
# Edit .env with your actual values (see Section 6 for all variables)

# 3. Start all services via Docker Compose
docker compose up -d

# 4. Install backend dependencies (for IDE support / local testing)
cd backend
uv venv --python 3.11
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# 5. Run database migrations
docker compose exec backend alembic upgrade head

# 6. Seed development data
docker compose exec backend python -m app.scripts.seed_dev

# 7. Install frontend dependencies
cd ../dashboard
pnpm install

# 8. Verify everything is running
curl http://localhost:8000/health
curl http://localhost:3000

# 9. Access development tools
# FastAPI docs:  http://localhost:8000/docs
# Next.js app:   http://localhost:3000
# Redis insight: http://localhost:8001 (if redis/redisinsight enabled)
# Flower:        http://localhost:5555 (Celery monitoring)
```

### 2.4 Makefile Convenience Commands

```makefile
# Makefile at project root

.PHONY: up down logs migrate seed test lint format

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.scripts.seed_dev

test-backend:
	docker compose exec backend pytest tests/ -v --cov=app

test-frontend:
	cd dashboard && pnpm test

lint:
	docker compose exec backend ruff check app/
	cd dashboard && pnpm lint

format:
	docker compose exec backend ruff format app/
	cd dashboard && pnpm format

shell:
	docker compose exec backend python -m app.scripts.shell

reset-db:
	docker compose down postgres
	docker volume rm brandora_postgres_data
	docker compose up -d postgres
	sleep 3
	make migrate
	make seed
```

### 2.5 Environment Variables (.env.example)

```bash
# ============================================================
# BRANDORA AI — ENVIRONMENT VARIABLES
# Copy to .env and fill in all values before running
# NEVER commit .env to git
# ============================================================

# ---- Application ----
ENVIRONMENT=development           # development | staging | production
APP_NAME="Brandora AI"
APP_VERSION=1.0.0
DEBUG=true                        # Set to false in staging/production
SECRET_KEY=your-super-secret-key-minimum-32-chars-change-this
ALLOWED_HOSTS=localhost,127.0.0.1

# ---- API URLs ----
API_BASE_URL=http://localhost:8000
FRONTEND_BASE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# ---- Database (Supabase / PostgreSQL) ----
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/brandora_dev
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=40
DATABASE_POOL_TIMEOUT=30
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ---- Redis ----
REDIS_URL=redis://localhost:6379/0
REDIS_CELERY_URL=redis://localhost:6379/1
REDIS_CACHE_URL=redis://localhost:6379/2
REDIS_MAX_CONNECTIONS=50

# ---- JWT Configuration ----
JWT_SECRET_KEY=your-jwt-secret-minimum-32-chars-change-this
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# ---- AI Models ----
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_FALLBACK_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4096
OPENAI_TIMEOUT_SECONDS=30

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-5
ANTHROPIC_MAX_TOKENS=4096
ANTHROPIC_TIMEOUT_SECONDS=30

# Google Gemini
GOOGLE_AI_API_KEY=AIza...
GEMINI_DEFAULT_MODEL=gemini-1.5-flash
GEMINI_MAX_TOKENS=4096
GEMINI_TIMEOUT_SECONDS=30

# Model Routing
DEFAULT_AI_MODEL=auto             # auto | gpt4o | claude_sonnet | gemini_flash
AI_COST_OPTIMIZATION=true        # Route cheaper models for simple tasks

# ---- Social Platform APIs ----
# LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/v1/social-accounts/callback/linkedin

# Instagram / Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
INSTAGRAM_REDIRECT_URI=http://localhost:8000/api/v1/social-accounts/callback/instagram

# Twitter / X
TWITTER_API_KEY=your-twitter-api-key
TWITTER_API_SECRET=your-twitter-api-secret
TWITTER_BEARER_TOKEN=your-twitter-bearer-token
TWITTER_REDIRECT_URI=http://localhost:8000/api/v1/social-accounts/callback/twitter

# ---- Email ----
EMAIL_PROVIDER=resend             # resend | sendgrid | smtp
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=hello@brandora.ai
EMAIL_FROM_NAME="Brandora AI"

# ---- File Storage ----
STORAGE_PROVIDER=supabase         # supabase | s3 | local (dev only)
SUPABASE_STORAGE_BUCKET=brandora-media
# S3 (for production)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_S3_REGION=ap-south-1
AWS_CLOUDFRONT_DOMAIN=

# ---- Error Tracking ----
SENTRY_DSN=https://...@sentry.io/project-id
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1    # 10% of transactions traced
SENTRY_PROFILES_SAMPLE_RATE=0.1

# ---- Monitoring ----
BETTERSTACK_SOURCE_TOKEN=        # Log aggregation (optional)

# ---- Rate Limiting ----
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORAGE=redis
DEFAULT_RATE_LIMIT_PER_MINUTE=60
AUTH_RATE_LIMIT_PER_15MIN=20
CONTENT_GEN_RATE_LIMIT_PER_DAY_FREE=20
CONTENT_GEN_RATE_LIMIT_PER_DAY_PRO=200

# ---- Celery ----
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1
CELERY_MAX_RETRIES=3
CELERY_TASK_TIMEOUT=300          # 5 minutes max per task
CELERY_CONCURRENCY=4             # Worker concurrency

# ---- Features Flags ----
FEATURE_INSTAGRAM_PUBLISHING=true
FEATURE_TWITTER_PUBLISHING=false  # Disable until Twitter API quota obtained
FEATURE_AI_INSIGHTS=true
FEATURE_WEBHOOKS=true
FEATURE_REEL_SCRIPT=true

# ---- Misc ----
ADMIN_EMAIL=admin@brandora.ai    # Superadmin bootstrapping
ENCRYPTION_KEY=fernet-key-here  # For encrypting OAuth tokens at rest
LOG_LEVEL=INFO                   # DEBUG | INFO | WARNING | ERROR
```

### 2.6 First-Run Checklist

- [ ] `.env` file created with all required values
- [ ] `docker compose up -d` shows all containers healthy
- [ ] `GET http://localhost:8000/health` returns `{"status": "healthy"}`
- [ ] `GET http://localhost:3000` shows Brandora AI login page
- [ ] Database migrations run (`alembic upgrade head`)
- [ ] Dev seed data loaded
- [ ] API docs accessible at `http://localhost:8000/docs`
- [ ] Celery worker connected (`docker compose logs celery` shows "ready")
- [ ] Redis accessible (Flower at `http://localhost:5555`)
- [ ] At least one AI API key valid (test via `POST /api/v1/content/generate`)

---

## 3. Docker Configuration

### 3.1 Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
# ============================================================
# Brandora AI — FastAPI Backend
# Multi-stage build for minimal production image
# ============================================================

# ---- Stage 1: Dependencies ----
FROM python:3.11-slim AS deps

WORKDIR /app

# Install uv for fast dependency resolution
RUN pip install uv --no-cache-dir

# Copy dependency files first (Docker cache optimization)
COPY pyproject.toml uv.lock ./

# Install dependencies into /app/.venv
RUN uv venv /app/.venv && \
    uv pip install --python /app/.venv/bin/python -r pyproject.toml --no-cache

# ---- Stage 2: Builder ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Copy virtual environment from deps stage
COPY --from=deps /app/.venv /app/.venv

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# ---- Stage 3: Production ----
FROM python:3.11-slim AS production

# Security: run as non-root user
RUN groupadd --gid 1001 brandora && \
    useradd --uid 1001 --gid 1001 --no-create-home brandora

WORKDIR /app

# Install runtime system dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy from builder
COPY --from=builder --chown=brandora:brandora /app /app

# Set environment
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER brandora

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Use gunicorn + uvicorn workers for production
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
```

### 3.2 Frontend Dockerfile (`dashboard/Dockerfile`)

```dockerfile
# ============================================================
# Brandora AI — Next.js 14 Frontend
# Multi-stage build with standalone output
# ============================================================

# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build environment variables (public, safe to bake in)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_APP_VERSION

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- Stage 3: Production ----
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output (minimal, no node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

USER nextjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
```

### 3.3 Docker Compose for Local Development (`docker-compose.yml`)

```yaml
version: '3.9'

services:
  # ---- PostgreSQL ----
  postgres:
    image: postgres:16-alpine
    container_name: brandora_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: brandora_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/scripts/init_db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ---- Redis ----
  redis:
    image: redis:7-alpine
    container_name: brandora_redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ---- FastAPI Backend ----
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: builder          # Use builder stage for dev (includes dev deps)
    container_name: brandora_backend
    command: >
      uvicorn app.main:app
      --host 0.0.0.0
      --port 8000
      --reload
      --reload-dir /app/app
    volumes:
      - ./backend:/app          # Live code reload
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password@postgres:5432/brandora_dev
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/1
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ---- Celery Worker ----
  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: builder
    container_name: brandora_celery
    command: >
      celery -A app.workers.celery_app worker
      --loglevel=info
      --concurrency=2
      -Q default,content,analytics,scheduler
    volumes:
      - ./backend:/app
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password@postgres:5432/brandora_dev
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/1
    depends_on:
      - backend
      - redis

  # ---- Celery Beat (Scheduler) ----
  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: builder
    container_name: brandora_beat
    command: >
      celery -A app.workers.celery_app beat
      --loglevel=info
      --scheduler redbeat.RedBeatScheduler
    volumes:
      - ./backend:/app
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password@postgres:5432/brandora_dev
      CELERY_BROKER_URL: redis://redis:6379/1
    depends_on:
      - redis

  # ---- Flower (Celery Monitoring) ----
  flower:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: builder
    container_name: brandora_flower
    command: celery -A app.workers.celery_app flower --port=5555
    ports:
      - "5555:5555"
    env_file:
      - .env
    environment:
      CELERY_BROKER_URL: redis://redis:6379/1
    depends_on:
      - redis

  # ---- Next.js Frontend ----
  frontend:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
      target: deps             # Dev: use deps stage + volume mount
    container_name: brandora_frontend
    command: pnpm dev
    volumes:
      - ./dashboard:/app
      - /app/node_modules       # Don't override node_modules from image
      - /app/.next              # Next.js build cache
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
    name: brandora_postgres_data
  redis_data:
    name: brandora_redis_data
```

### 3.4 Docker Compose Production Reference (`docker-compose.prod.yml`)

```yaml
version: '3.9'

# Production compose — used for reference and local prod testing
# Actual production runs on Railway / AWS ECS (not docker-compose directly)

services:
  backend:
    image: ghcr.io/your-org/brandora-backend:${IMAGE_TAG:-latest}
    restart: always
    environment:
      ENVIRONMENT: production
      DEBUG: "false"
    env_file:
      - .env.prod
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  celery_worker:
    image: ghcr.io/your-org/brandora-backend:${IMAGE_TAG:-latest}
    restart: always
    command: >
      celery -A app.workers.celery_app worker
      --loglevel=warning
      --concurrency=4
      -Q default,content,analytics,scheduler
    env_file:
      - .env.prod
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

  frontend:
    image: ghcr.io/your-org/brandora-frontend:${IMAGE_TAG:-latest}
    restart: always
    environment:
      NODE_ENV: production
    env_file:
      - .env.frontend.prod
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

---

## 4. Railway Deployment (MVP)

### 4.1 Railway Project Structure

Create a Railway project with the following services:

```
Brandora AI (Railway Project)
├── brandora-backend      [FastAPI — from Dockerfile]
├── brandora-frontend     [Next.js — from Dockerfile]
├── brandora-worker       [Celery Worker — from same Dockerfile, different CMD]
├── brandora-beat         [Celery Beat — from same Dockerfile, different CMD]
└── Redis                 [Railway managed Redis plugin]
```

PostgreSQL is hosted on **Supabase** (not Railway) to use the free tier and avoid paying for Railway Postgres.

### 4.2 railway.toml Configuration

```toml
# railway.toml — root of repository

[build]
builder = "dockerfile"

# ---- Backend Service ----
[services.brandora-backend]
dockerfile = "backend/Dockerfile"
build_target = "production"

[services.brandora-backend.deploy]
start_command = "gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --workers 2 --bind 0.0.0.0:$PORT --timeout 120"
health_check_path = "/health"
health_check_timeout = 30
restart_policy_type = "on_failure"
restart_policy_max_retries = 3

[services.brandora-backend.build]
watch_patterns = ["backend/**"]

# ---- Frontend Service ----
[services.brandora-frontend]
dockerfile = "dashboard/Dockerfile"
build_target = "production"

[services.brandora-frontend.deploy]
start_command = "node server.js"
health_check_path = "/api/health"
health_check_timeout = 30

[services.brandora-frontend.build]
watch_patterns = ["dashboard/**"]
build_args = { NEXT_PUBLIC_API_URL = "$API_BASE_URL" }

# ---- Celery Worker ----
[services.brandora-worker]
dockerfile = "backend/Dockerfile"
build_target = "production"

[services.brandora-worker.deploy]
start_command = "celery -A app.workers.celery_app worker --loglevel=warning --concurrency=2 -Q default,content,analytics,scheduler"
restart_policy_type = "always"

# ---- Celery Beat ----
[services.brandora-beat]
dockerfile = "backend/Dockerfile"
build_target = "production"

[services.brandora-beat.deploy]
start_command = "celery -A app.workers.celery_app beat --loglevel=warning --scheduler redbeat.RedBeatScheduler"
restart_policy_type = "always"
```

### 4.3 Deploying to Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project (first time)
railway init

# 4. Link to existing project
railway link <project-id>

# 5. Deploy
railway up

# 6. View logs
railway logs --service brandora-backend

# 7. Run migrations in production
railway run --service brandora-backend alembic upgrade head

# 8. Open shell
railway shell --service brandora-backend
```

### 4.4 Environment Variables in Railway

Set these in each service's Railway dashboard or via CLI:

```bash
# Set an env variable for a service
railway variables set SECRET_KEY="your-secret" --service brandora-backend

# Copy variables from one service to another
# (Railway supports shared variables via reference: ${{backend.DATABASE_URL}})
```

**Variables shared across all backend services** (backend, worker, beat):
- All variables from `.env.example` with production values
- `DATABASE_URL` → Points to Supabase connection pooler URL (Transaction mode, port 6543)
- `REDIS_URL` → Railway Redis plugin URL (set automatically via `${{Redis.REDIS_URL}}`)
- `ENVIRONMENT=production`
- `DEBUG=false`

### 4.5 Supabase Integration

```bash
# Use the Supabase Transaction Pooler URL for the backend
# (Supabase Dashboard → Settings → Database → Connection Pooling → Transaction mode)
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

# Use the direct URL for Alembic migrations only (not for app runtime)
DIRECT_DATABASE_URL=postgresql+psycopg2://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Supabase Row-Level Security Setup**

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their organization's data
CREATE POLICY "org_isolation" ON content
  USING (org_id = (current_setting('app.current_org_id'))::uuid);

-- Set org context in FastAPI (in the database session factory)
-- SET LOCAL app.current_org_id = 'org-uuid-here';
```

### 4.6 Custom Domain Setup

```
1. In Railway: Go to service → Settings → Domains → Add Custom Domain
2. Add CNAME record in your DNS provider:
   api.brandora.ai  →  [service].railway.app
   app.brandora.ai  →  [frontend-service].railway.app

3. Railway auto-provisions TLS via Let's Encrypt
4. Set CORS_ORIGINS=https://app.brandora.ai in backend env vars
```

### 4.7 Estimated Monthly Cost (Railway MVP)

| Service              | Railway Plan    | Est. Monthly Cost |
|----------------------|-----------------|-------------------|
| Backend (FastAPI)    | Starter (~512MB RAM, 0.5 vCPU) | $10-15  |
| Frontend (Next.js)   | Starter (~256MB RAM) | $5-8           |
| Celery Worker        | Starter (~512MB RAM) | $10-15         |
| Celery Beat          | Starter (~128MB RAM) | $3-5           |
| Redis                | Railway managed (100MB) | $5           |
| **Subtotal Railway** |                 | **$33-48/month** |
| Supabase             | Free tier (500MB DB, 2GB transfer) | $0 |
| OpenAI / Anthropic / Gemini | Pay per use | $20-50/month |
| Sentry               | Developer plan  | $0-26/month |
| Resend Email         | Free (3000 emails/month) | $0 |
| **Total Estimate**   |                 | **$53-124/month** |

**Scaling note**: Railway Starter plan includes $5 free credit. Above assumes modest initial traffic (~100 daily active users).

---

## 5. CI/CD with GitHub Actions

### 5.1 Branch Strategy

```
main          →  Production deploy (manual trigger or tag)
dev           →  Staging deploy (auto on push)
feature/*     →  PR checks only (lint, test, type-check)
hotfix/*      →  Fast-track to main via PR
```

### 5.2 CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

env:
  PYTHON_VERSION: "3.11"
  NODE_VERSION: "20"

jobs:
  # ---- Backend Checks ----
  backend-lint:
    name: Backend — Lint & Format
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install uv
        run: pip install uv

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: backend/.venv
          key: ${{ runner.os }}-uv-${{ hashFiles('backend/pyproject.toml') }}

      - name: Install dependencies
        run: uv venv && uv pip install -r pyproject.toml --dev

      - name: Ruff lint
        run: .venv/bin/ruff check app/ --output-format=github

      - name: Ruff format check
        run: .venv/bin/ruff format --check app/

      - name: Mypy type check
        run: .venv/bin/mypy app/ --ignore-missing-imports

  backend-test:
    name: Backend — Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: brandora_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install uv and dependencies
        run: |
          pip install uv
          uv venv
          uv pip install -r pyproject.toml --dev

      - name: Run migrations
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:testpassword@localhost:5432/brandora_test
        run: .venv/bin/alembic upgrade head

      - name: Run tests with coverage
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:testpassword@localhost:5432/brandora_test
          REDIS_URL: redis://localhost:6379/0
          ENVIRONMENT: test
          SECRET_KEY: test-secret-key-minimum-32-characters
          JWT_SECRET_KEY: test-jwt-secret-minimum-32-characters
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_TEST }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}
        run: |
          .venv/bin/pytest tests/ \
            --cov=app \
            --cov-report=xml \
            --cov-report=term-missing \
            --cov-fail-under=70 \
            -v \
            --tb=short

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml
          flags: backend

  # ---- Frontend Checks ----
  frontend-lint:
    name: Frontend — Lint & Type Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: dashboard
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: dashboard/pnpm-lock.yaml

      - uses: pnpm/action-setup@v3
        with:
          version: latest

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: ESLint
        run: pnpm lint

      - name: TypeScript type check
        run: pnpm type-check

      - name: Next.js build check
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8000
        run: pnpm build

  # ---- Docker Build Test ----
  docker-build-test:
    name: Docker Build Test
    runs-on: ubuntu-latest
    needs: [backend-lint, backend-test, frontend-lint]
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build backend image
        uses: docker/build-push-action@v5
        with:
          context: backend
          push: false
          target: production
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build frontend image
        uses: docker/build-push-action@v5
        with:
          context: dashboard
          push: false
          target: production
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 5.3 Staging Deploy (`.github/workflows/deploy-staging.yml`)

```yaml
name: Deploy to Staging

on:
  push:
    branches: [dev]
  workflow_dispatch:

concurrency:
  group: staging-deploy
  cancel-in-progress: true

jobs:
  build-and-push:
    name: Build and Push Docker Images
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: ${{ steps.meta.outputs.version }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: |
            ghcr.io/${{ github.repository }}/backend
            ghcr.io/${{ github.repository }}/frontend
          tags: |
            type=sha,prefix=staging-,format=short
            type=raw,value=staging-latest

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: backend
          target: production
          push: true
          tags: ghcr.io/${{ github.repository }}/backend:staging-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: dashboard
          target: production
          push: true
          tags: ghcr.io/${{ github.repository }}/frontend:staging-${{ github.sha }}
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.STAGING_API_URL }}
            NEXT_PUBLIC_SENTRY_DSN=${{ secrets.SENTRY_DSN }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Railway Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy backend to staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
        run: |
          railway up \
            --service brandora-backend \
            --environment staging \
            --detach

      - name: Deploy worker to staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
        run: |
          railway up \
            --service brandora-worker \
            --environment staging \
            --detach

      - name: Deploy frontend to staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
        run: |
          railway up \
            --service brandora-frontend \
            --environment staging \
            --detach

      - name: Wait for deployment health
        run: |
          echo "Waiting 60s for services to start..."
          sleep 60
          curl -f ${{ secrets.STAGING_API_URL }}/health || exit 1
          echo "Staging deployment healthy"

      - name: Run smoke tests
        run: |
          # Basic smoke test suite against staging
          curl -f "${{ secrets.STAGING_API_URL }}/health"
          curl -f "${{ secrets.STAGING_APP_URL }}/api/health"

      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Staging deploy successful :rocket:",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Staging Deploy* :white_check_mark:\nBranch: `${{ github.ref_name }}`\nCommit: `${{ github.sha }}`\nURL: ${{ secrets.STAGING_APP_URL }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            { "text": "Staging deploy FAILED :x: — ${{ github.sha }}" }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 5.4 Production Deploy (`.github/workflows/deploy-production.yml`)

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'    # Trigger on version tags: v1.2.3
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Docker image tag to deploy'
        required: true
        default: 'latest'

concurrency:
  group: production-deploy
  cancel-in-progress: false          # Never cancel prod deployments

jobs:
  validate-tag:
    name: Validate Release Tag
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate semver tag
        run: |
          TAG="${{ github.ref_name }}"
          if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid tag format: $TAG. Expected v[MAJOR].[MINOR].[PATCH]"
            exit 1
          fi
          echo "Valid tag: $TAG"

  build-production:
    name: Build Production Images
    runs-on: ubuntu-latest
    needs: validate-tag
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend (production)
        uses: docker/build-push-action@v5
        with:
          context: backend
          target: production
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:${{ github.ref_name }}
            ghcr.io/${{ github.repository }}/backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push frontend (production)
        uses: docker/build-push-action@v5
        with:
          context: dashboard
          target: production
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/frontend:${{ github.ref_name }}
            ghcr.io/${{ github.repository }}/frontend:latest
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.PROD_API_URL }}
            NEXT_PUBLIC_SENTRY_DSN=${{ secrets.SENTRY_DSN }}
            NEXT_PUBLIC_APP_VERSION=${{ github.ref_name }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build-production
    environment: production           # Requires manual approval in GitHub
    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Run pre-deploy database migration
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: |
          echo "Running database migrations..."
          railway run \
            --service brandora-backend \
            --environment production \
            "alembic upgrade head"
          echo "Migrations complete"

      - name: Deploy backend to production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: |
          railway up \
            --service brandora-backend \
            --environment production \
            --detach

      - name: Deploy Celery worker
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: |
          railway up \
            --service brandora-worker \
            --environment production \
            --detach

      - name: Deploy Celery beat
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: |
          railway up \
            --service brandora-beat \
            --environment production \
            --detach

      - name: Deploy frontend to production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
        run: |
          railway up \
            --service brandora-frontend \
            --environment production \
            --detach

      - name: Health check (with retry)
        run: |
          for i in {1..10}; do
            if curl -f "${{ secrets.PROD_API_URL }}/health"; then
              echo "Production is healthy!"
              exit 0
            fi
            echo "Attempt $i failed, retrying in 15s..."
            sleep 15
          done
          echo "Production health check failed after 10 attempts!"
          exit 1

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
          tag_name: ${{ github.ref_name }}

      - name: Notify Slack — Production Deploy
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": ":tada: Production deploy *${{ github.ref_name }}* succeeded!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Deploy Successful* :rocket:\nVersion: `${{ github.ref_name }}`\nURL: ${{ secrets.PROD_APP_URL }}\nDeployed by: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

### Required GitHub Secrets

| Secret                        | Description                              |
|-------------------------------|------------------------------------------|
| `RAILWAY_TOKEN_STAGING`       | Railway API token for staging env        |
| `RAILWAY_TOKEN_PRODUCTION`    | Railway API token for production env     |
| `STAGING_API_URL`             | Staging API base URL                     |
| `STAGING_APP_URL`             | Staging frontend URL                     |
| `PROD_API_URL`                | Production API base URL                  |
| `PROD_APP_URL`                | Production frontend URL                  |
| `OPENAI_API_KEY_TEST`         | OpenAI key for CI tests (limited quota)  |
| `ANTHROPIC_API_KEY_TEST`      | Anthropic key for CI tests               |
| `SENTRY_DSN`                  | Sentry DSN for error tracking            |
| `SLACK_WEBHOOK_URL`           | Slack notification webhook               |
```

---

## 6. Environment Management

### 6.1 Environment Matrix

| Variable Category        | Development    | Staging        | Production     |
|--------------------------|----------------|----------------|----------------|
| `DEBUG`                  | `true`         | `false`        | `false`        |
| `LOG_LEVEL`              | `DEBUG`        | `INFO`         | `WARNING`      |
| `SENTRY_TRACES_SAMPLE`   | `0`            | `0.5`          | `0.1`          |
| `DATABASE_POOL_SIZE`     | `5`            | `10`           | `20`           |
| `CELERY_CONCURRENCY`     | `2`            | `4`            | `8`            |
| AI Rate Limits           | Relaxed        | Standard       | Plan-enforced  |
| OAuth Redirect URIs      | localhost:8000 | staging domain | prod domain    |

### 6.2 Secrets Rotation Strategy

**Rotation Schedule**
| Secret                   | Rotation Frequency | Method                     |
|--------------------------|--------------------|-----------------------------|
| `JWT_SECRET_KEY`         | Every 90 days      | New key + 24h overlap window|
| `SECRET_KEY`             | Every 180 days     | Rolling deploy              |
| `ENCRYPTION_KEY`         | Every 180 days     | Re-encrypt stored tokens    |
| Social OAuth Secrets     | As needed (breach) | Platform dashboard          |
| AI API Keys              | Every 90 days      | Platform dashboard          |
| Database Password        | Every 90 days      | Supabase dashboard          |
| `RAILWAY_TOKEN`          | Every 90 days      | Railway dashboard           |

**JWT Key Rotation Procedure (Zero-Downtime)**
1. Generate new `JWT_SECRET_KEY_NEW`
2. Update `app/core/security.py` to accept tokens signed by either old or new key
3. Deploy this version
4. Update env var to new key value
5. Wait 2 hours (longer than max access token lifetime)
6. Remove old key acceptance from code
7. Deploy final version

### 6.3 Feature Flags

Feature flags are stored as environment variables and checked at runtime:

```python
# app/core/config.py
class Settings(BaseSettings):
    feature_instagram_publishing: bool = True
    feature_twitter_publishing: bool = False
    feature_ai_insights: bool = True
    feature_webhooks: bool = True
    feature_reel_script: bool = True
    feature_founder_post: bool = True
    feature_carousel_gen: bool = True
```

For more complex rollouts (per-org, percentage), use a simple Redis-backed feature flag table.

---

## 7. Database Migrations

### 7.1 Alembic Setup

```ini
# alembic.ini
[alembic]
script_location = alembic
file_template = %%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s
prepend_sys_path = .
sqlalchemy.url = postgresql+psycopg2://%(DB_USER)s:%(DB_PASSWORD)s@%(DB_HOST)s/%(DB_NAME)s
```

```python
# alembic/env.py
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.core.config import settings
from app.schemas import Base  # Import all ORM models

config = context.config
config.set_main_option("sqlalchemy.url", settings.DIRECT_DATABASE_URL)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### 7.2 Migration Workflow

```bash
# Create a new migration (auto-detect model changes)
alembic revision --autogenerate -m "add_campaign_analytics_table"

# Review the generated migration file before applying!
# Always check: alembic/versions/YYYYMMDD_HHMM_xxx_add_campaign_analytics_table.py

# Apply all pending migrations
alembic upgrade head

# Apply next migration only
alembic upgrade +1

# Rollback last migration
alembic downgrade -1

# Rollback to a specific revision
alembic downgrade abc123def456

# Show current revision
alembic current

# Show migration history
alembic history --verbose

# Verify that autogenerate detects everything correctly
alembic check
```

### 7.3 Zero-Downtime Migration Strategy

For production, migrations that could lock tables must follow this pattern:

**Safe operations (can run with traffic):**
- `ADD COLUMN` with a default value
- `CREATE INDEX CONCURRENTLY`
- `CREATE TABLE`
- `DROP INDEX`

**Unsafe operations (require maintenance window or special handling):**
- `DROP COLUMN`
- `ALTER COLUMN TYPE`
- `ADD NOT NULL CONSTRAINT` without a default
- `RENAME COLUMN`

**Pattern for zero-downtime column renames:**

```python
# Step 1: Deploy — add new column, write to both old and new
# Migration:
op.add_column('content', sa.Column('content_text', sa.Text))
# App: writes to both 'text' and 'content_text'

# Step 2: Backfill data
op.execute("UPDATE content SET content_text = text WHERE content_text IS NULL")

# Step 3: Deploy — read from new column, write to both
# (next deploy)

# Step 4: Deploy — stop writing to old column
# (next deploy)

# Step 5: Drop old column
op.drop_column('content', 'text')
```

**Migration in CI/CD**

The production workflow runs `alembic upgrade head` before deploying new application code. This is safe only for forward-compatible migrations. The Alembic revision is pinned so rollbacks are always possible.

---

## 8. Monitoring Setup

### 8.1 Sentry Configuration

**Backend (`backend/app/main.py`)**
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENVIRONMENT,
    release=f"brandora@{settings.APP_VERSION}",
    traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
    profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
    integrations=[
        FastApiIntegration(transaction_style="endpoint"),
        SqlalchemyIntegration(),
        CeleryIntegration(monitor_beat_tasks=True),
        RedisIntegration(),
    ],
    # Never send PII to Sentry
    send_default_pii=False,
    before_send=lambda event, hint: scrub_sensitive_data(event),
)
```

**Frontend (`dashboard/app/layout.tsx`)**
```typescript
// dashboard/sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.5,
  integrations: [
    Sentry.replayIntegration(),
  ],
});
```

### 8.2 Structured Logging

All backend logs are structured JSON for easy ingestion:

```python
# app/core/logging.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(settings.LOG_LEVEL)),
)

# Usage in services:
log = structlog.get_logger()
log.info("content.generated", content_id=content_id, model=model_used, tokens=tokens_used, org_id=org_id)
```

### 8.3 Uptime Monitoring

**UptimeRobot (Free tier — sufficient for MVP)**
- Monitor `https://api.brandora.ai/health` — every 5 minutes
- Monitor `https://app.brandora.ai` — every 5 minutes
- Alert to: Slack + email
- Public status page at `https://status.brandora.ai`

**Better Uptime (Recommended upgrade at $7/month)**
- 30-second check intervals
- Multi-region checks (prevents false positives)
- On-call escalation
- Status page with custom domain

### 8.4 Railway Built-in Metrics

Railway provides per-service metrics in the dashboard:
- CPU usage
- Memory usage
- Network I/O
- Deployment history

Export metrics to a Grafana dashboard via the Railway API for historical trending.

### 8.5 Application Performance Monitoring

```python
# app/core/middleware.py — Request timing middleware
@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    start_time = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start_time) * 1000

    # Log slow requests
    if duration_ms > 2000:
        log.warning(
            "slow_request",
            path=request.url.path,
            method=request.method,
            duration_ms=round(duration_ms),
            status_code=response.status_code,
        )

    response.headers["X-Response-Time"] = f"{duration_ms:.0f}ms"
    return response
```

### 8.6 Celery Task Monitoring

Use **Flower** in development and **Sentry Crons** in production for critical scheduled tasks.

```python
# app/workers/celery_app.py
from celery import Celery
import sentry_sdk

app = Celery("brandora")

# Monitor critical beat tasks with Sentry
@app.task(bind=True)
def check_due_posts(self):
    with sentry_sdk.monitor(monitor_slug="check-due-posts"):
        # ... task logic
```

---

## 9. Security Hardening

### 9.1 HTTPS Enforcement

Railway automatically provisions TLS. For the FastAPI backend:

```python
# app/main.py
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if settings.ENVIRONMENT == "production":
    app.add_middleware(HTTPSRedirectMiddleware)
```

### 9.2 Security Headers

```python
# app/core/middleware.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'nonce-{nonce}'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.brandora.ai; "
            "frame-ancestors 'none'"
        )
        # Remove server fingerprinting
        del response.headers["server"]
        return response
```

### 9.3 CORS Configuration

```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware

origins = settings.CORS_ORIGINS.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # Explicit list — never use "*" in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Organization-ID", "X-Idempotency-Key"],
    max_age=3600,                   # Cache preflight for 1 hour
)
```

### 9.4 Rate Limiting with Redis

```python
# app/core/middleware.py
from redis.asyncio import Redis
from fastapi import Request, HTTPException

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis: Redis):
        super().__init__(app)
        self.redis = redis

    async def dispatch(self, request: Request, call_next):
        # Get identifier (user_id > api_key > IP)
        identifier = await self._get_identifier(request)
        endpoint_group = self._get_endpoint_group(request.url.path)
        limit, window = self._get_limit(endpoint_group, request.state.user_tier)

        key = f"rl:{identifier}:{endpoint_group}"
        current = await self.redis.incr(key)

        if current == 1:
            await self.redis.expire(key, window)

        if current > limit:
            ttl = await self.redis.ttl(key)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Try again in {ttl} seconds.",
                    "retry_after": ttl,
                },
                headers={"Retry-After": str(ttl)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - current))
        return response
```

### 9.5 Input Validation and SQL Injection Prevention

```python
# All inputs validated via Pydantic models — no raw query construction
# SQLAlchemy ORM used exclusively — parameterized queries by default
# File uploads validated by MIME type and file signature, not just extension

# app/utils/file_validator.py
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def validate_upload(file: UploadFile) -> None:
    # Check file size
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError("File too large. Maximum size is 10MB.")
    await file.seek(0)

    # Check MIME type from content (not just headers)
    import magic
    mime = magic.from_buffer(content[:2048], mime=True)
    if mime not in ALLOWED_MIME_TYPES:
        raise ValidationError(f"File type {mime} not allowed.")
```

### 9.6 OAuth Token Encryption at Rest

Social OAuth tokens contain sensitive access credentials. They are encrypted at rest using Fernet symmetric encryption:

```python
# app/integrations/token_encryption.py
from cryptography.fernet import Fernet

class TokenEncryptor:
    def __init__(self, key: str):
        self.fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, token: str) -> str:
        return self.fernet.encrypt(token.encode()).decode()

    def decrypt(self, encrypted_token: str) -> str:
        return self.fernet.decrypt(encrypted_token.encode()).decode()
```

---

## 10. AWS Migration Plan (Month 6+)

### 10.1 Migration Triggers

Migrate from Railway to AWS when **any two** of these conditions are met:
- Monthly Railway bill exceeds $300
- Single-region latency becomes a user complaint
- Need > 4 Celery workers concurrently
- Require > 4GB RAM for any single service
- Compliance requirements demand VPC isolation
- Database needs read replicas (>10,000 daily active users)

### 10.2 AWS Services Mapping

| Current (Railway)         | AWS Equivalent               | Notes                        |
|---------------------------|------------------------------|------------------------------|
| Railway FastAPI service   | ECS Fargate                  | Serverless containers        |
| Railway Next.js service   | ECS Fargate + CloudFront     | CDN for static assets        |
| Railway Redis plugin      | ElastiCache (Redis 7)        | Managed, multi-AZ optional   |
| Railway Celery workers    | ECS Fargate (separate task def) | Scale independently       |
| Supabase PostgreSQL       | RDS PostgreSQL (or keep Supabase) | RDS for full control   |
| Railway domain + TLS      | ACM + ALB                    | Application Load Balancer    |
| Railway logs              | CloudWatch Logs              | Log aggregation + alerting   |
| File storage (Supabase)   | S3 + CloudFront              | CDN for media files          |
| Manual scaling            | ECS Auto Scaling             | CPU/memory-based             |

### 10.3 AWS Architecture Diagram (Target State)

```
                     CloudFront CDN
                          |
         ┌────────────────┼────────────────┐
         |                |                |
      Static          API (ALB)        Media (S3)
      Assets         /api/v1/*          /media/*
         |                |
    ECS (Next.js)   ECS (FastAPI x2)
                          |
                    ┌─────┼──────┐
                    |            |
               ElastiCache    RDS (Primary)
                (Redis)           |
                    |        RDS (Read Replica)
              ECS Celery
              Workers (x4)
```

### 10.4 Migration Steps

**Week 1: Preparation**
```bash
# 1. Set up AWS account structure
# - Create IAM roles for ECS tasks (least privilege)
# - Set up ECR repositories for Docker images
# - Configure VPC with public/private subnets in ap-south-1

# 2. Start pushing images to ECR alongside GHCR
# (update CI to push to both registries)

# 3. Set up Terraform infrastructure
terraform init
terraform plan
terraform apply
```

**Week 2: Database Migration**
```bash
# Option A: Migrate Supabase → RDS
# 1. Create RDS PostgreSQL 16 instance in same region as Railway
# 2. Use pg_dump + pg_restore for initial migration
pg_dump $SUPABASE_URL -F c -f brandora_backup.dump
pg_restore -d $RDS_URL brandora_backup.dump

# 3. Set up logical replication for ongoing sync during cutover
# 4. Test RDS with staging traffic
# 5. Swap DATABASE_URL in production (requires deploy)

# Option B: Keep Supabase (simpler, recommended unless > 50k users)
# Just update connection strings and enable connection pooling via PgBouncer
```

**Week 3: Compute Migration**
```bash
# 1. Create ECS cluster
# 2. Create task definitions for backend, frontend, worker, beat
# 3. Deploy to ECS in parallel with Railway (blue/green)
# 4. Route 10% traffic to AWS via weighted DNS
# 5. Monitor error rates
# 6. Gradually shift to 50% → 100%
# 7. Decommission Railway services
```

**Week 4: Final Cutover**
- Update DNS to point to ALB
- Verify CloudFront is serving Next.js static files
- Monitor 24h before decommissioning Railway
- Update all OAuth redirect URIs to new domain

### 10.5 Cost Comparison

| Service           | Railway MVP | AWS Production |
|-------------------|-------------|----------------|
| Compute (backend + workers) | $35-50/month | $80-150/month (ECS Fargate) |
| Database          | $0 (Supabase free) | $30-80/month (RDS t3.medium) |
| Redis             | $5/month    | $30-50/month (ElastiCache t3.micro) |
| CDN/Networking    | $0          | $10-30/month (CloudFront) |
| Load Balancer     | $0          | $20/month (ALB) |
| Total             | $40-55/month | $170-330/month |

AWS cost is 3-5x higher but provides multi-AZ reliability, auto-scaling, and production SLA. Justify the jump at $10k+ MRR.

### 10.6 Terraform Basics (Infrastructure as Code)

```hcl
# infrastructure/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "brandora-terraform-state"
    key    = "production/terraform.tfstate"
    region = "ap-south-1"
  }
}

provider "aws" {
  region = "ap-south-1"
}

module "vpc" {
  source = "./modules/vpc"
  name   = "brandora-prod"
}

module "ecs" {
  source       = "./modules/ecs"
  vpc_id       = module.vpc.vpc_id
  subnet_ids   = module.vpc.private_subnet_ids
  backend_image = "ghcr.io/your-org/brandora-backend:latest"
  frontend_image = "ghcr.io/your-org/brandora-frontend:latest"
}

module "rds" {
  source        = "./modules/rds"
  vpc_id        = module.vpc.vpc_id
  subnet_ids    = module.vpc.private_subnet_ids
  instance_class = "db.t3.medium"
  multi_az      = true
}

module "elasticache" {
  source        = "./modules/elasticache"
  vpc_id        = module.vpc.vpc_id
  subnet_ids    = module.vpc.private_subnet_ids
  node_type     = "cache.t3.micro"
}
```

---

## 11. Cost Optimization

### 11.1 Railway MVP Cost Breakdown

```
Month 1-3 (Bootstrap):
  Railway Starter plan:          $0-20/month (usage-based)
  Supabase free tier:            $0/month
  OpenAI API (limited users):    $5-20/month
  Anthropic API:                 $5-10/month
  Sentry free tier:              $0/month
  Total:                         $10-50/month

Month 4-6 (Growth, 100+ users):
  Railway services (4 services): $40-60/month
  Supabase Pro (if needed):      $25/month
  AI APIs:                       $50-150/month
  Resend email (paid):           $20/month
  Better Uptime:                 $7/month
  Sentry Team:                   $26/month
  Total:                         $168-288/month
```

### 11.2 AI API Cost Management

AI API costs are the primary variable cost. Strategies to manage them:

**Model Routing for Cost**
```python
# app/utils/model_router.py
def select_model(task_type: str, quality_requirement: str, org_plan: str) -> str:
    """Route to cheapest model that meets quality requirements."""

    # Fast/cheap for hashtags, reformatting, short content
    if task_type in ["hashtag_generation", "repurpose_short", "metadata"]:
        return "gemini_flash"  # ~$0.075 per 1M tokens

    # Best quality for flagship content
    if task_type in ["csr_story", "founder_post"] or quality_requirement == "premium":
        if org_plan == "enterprise":
            return "gpt4o"    # ~$5 per 1M tokens
        return "claude_sonnet"  # ~$3 per 1M tokens

    # Default: Claude Sonnet (best quality/cost ratio for content)
    return "claude_sonnet"
```

**Prompt Caching**
- Use Anthropic prompt caching for brand voice / system prompts (saves ~90% on cached tokens)
- Cache results for identical generation requests within 5 minutes (Redis TTL)

**Token Budgeting**
```python
# Hard limits per org per day
TOKEN_LIMITS = {
    "free": 100_000,
    "pro": 2_000_000,
    "enterprise": 20_000_000,
}
```

### 11.3 Supabase Free Tier Limits

| Resource        | Free Limit      | Action at Limit              |
|-----------------|-----------------|------------------------------|
| Database size   | 500 MB          | Upgrade to Pro ($25/month)   |
| Bandwidth       | 5 GB/month      | Upgrade or optimize queries  |
| API requests    | 50,000/day      | Upgrade or add caching       |
| Auth users      | Unlimited        | N/A                          |
| Edge Functions  | 500,000/month   | Upgrade                      |
| Storage         | 1 GB            | Upgrade                      |

**Optimization**: Add Redis caching layer before database for all read-heavy endpoints (content history, analytics overview). Target 80% cache hit rate for repeated reads.

### 11.4 CDN Strategy

**MVP**: Supabase Storage with built-in CDN for uploaded images.

**Scale**: Add Cloudflare free tier in front of both frontend and backend:
- Static asset caching (Next.js `/_next/static/*`) — 100% cache hit
- API responses with `Cache-Control` headers — selective caching
- DDoS protection at no extra cost
- Estimated bandwidth savings: 60-70%

---

## 12. Scaling Strategy

### 12.1 Scaling Triggers

| Metric                    | Threshold      | Action                              |
|---------------------------|----------------|-------------------------------------|
| CPU (backend)             | > 70% avg 5min | Add 1 more Railway replica          |
| Memory (backend)          | > 80%          | Upgrade to next Railway plan tier   |
| Celery queue depth        | > 50 pending   | Scale worker count by 2             |
| API response time P95     | > 3 seconds    | Profile + optimize before scaling   |
| Database connections      | > 80% pool     | Increase pool size or add PgBouncer |
| Redis memory              | > 80%          | Increase Redis memory limit         |

### 12.2 Horizontal Scaling (Railway)

```bash
# Scale a Railway service to multiple instances
railway up --service brandora-backend --replicas 3

# Auto-scaling is not available on Railway — manual scaling only
# Set up UptimeRobot alert on slow response → trigger manual scale-up
```

### 12.3 Database Read Replicas

When read traffic exceeds write traffic by 5:1 (typical at 1000+ DAU):

1. **Supabase approach**: Supabase Pro includes 1 read replica. Route analytics queries to replica:
   ```python
   # app/core/database.py
   async def get_read_db():
       """Use read replica for non-mutating operations."""
       async with read_replica_session_factory() as session:
           yield session
   ```

2. **RDS approach (AWS)**: Aurora PostgreSQL with auto-scaling read replicas.

### 12.4 Celery Worker Scaling

```python
# app/workers/celery_app.py — Queue configuration
app = Celery("brandora")
app.conf.task_routes = {
    "app.workers.content_tasks.*": {"queue": "content"},
    "app.workers.analytics_tasks.*": {"queue": "analytics"},
    "app.workers.scheduler_tasks.*": {"queue": "scheduler"},
    "app.workers.maintenance_tasks.*": {"queue": "maintenance"},
}

# Priority queues: content > scheduler > analytics > maintenance
app.conf.task_queue_max_priority = 10
app.conf.task_default_priority = 5
```

Scale workers per queue independently:
```bash
# High-priority content generation workers
celery -A app.workers.celery_app worker -Q content --concurrency=8

# Scheduler workers (must be single process for accuracy)
celery -A app.workers.celery_app worker -Q scheduler --concurrency=1

# Analytics workers (can be delayed)
celery -A app.workers.celery_app worker -Q analytics --concurrency=4
```

### 12.5 Redis Clustering

Redis is used for: rate limiting, Celery broker, session cache, feature flags.

At scale, split into dedicated Redis instances per use case:
```
redis-db-0:  Celery broker + results
redis-db-1:  Rate limiting (TTL-heavy, can be separate)
redis-db-2:  Application cache (content, analytics)
```

Redis Cluster (6 nodes, 3 shards × 2 replicas) when single instance exceeds 8GB memory or 50k ops/sec.

### 12.6 Database Connection Pooling

```python
# app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,           # Keep 20 connections alive
    max_overflow=40,        # Burst up to 60 total connections
    pool_timeout=30,        # Wait max 30s for a connection
    pool_recycle=3600,      # Recycle connections every hour
    pool_pre_ping=True,     # Validate connections before use
    echo=settings.DEBUG,
)
```

For Supabase, always use the **Transaction mode pooler** (port 6543), not the direct connection (port 5432). The pooler supports up to 2500 concurrent connections via PgBouncer.

---

*End of DEPLOYMENT.md*
