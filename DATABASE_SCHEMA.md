# Brandora AI — Database Schema

**Version:** 1.0.0
**Last Updated:** 2026-05-22
**Database:** PostgreSQL 15 via Supabase
**Status:** Production Blueprint

---

## Table of Contents

1. [Schema Design Philosophy](#1-schema-design-philosophy)
2. [Complete Table Definitions](#2-complete-table-definitions)
3. [Entity Relationship Description](#3-entity-relationship-description)
4. [Index Strategy](#4-index-strategy)
5. [RLS Policies](#5-rls-policies)
6. [Migration Strategy](#6-migration-strategy)
7. [Seed Data](#7-seed-data)

---

## 1. Schema Design Philosophy

### Multi-Tenant Architecture

Brandora AI is a multi-tenant SaaS platform. Every piece of data belongs to an `organization`. The `organizations` table is the root of the tenant tree. Every data table carries an `org_id` foreign key and relies on PostgreSQL Row Level Security (RLS) to enforce strict isolation between tenants at the database layer — not just the application layer.

This means:
- Even if application code has a bug that omits a `WHERE org_id = ?` clause, data cannot cross tenant boundaries
- Supabase's RLS is enforced by the PostgreSQL engine itself, not middleware
- RLS policies use `current_setting('app.current_org_id')` which the FastAPI backend sets at the start of each request using `SET LOCAL`

### Design Principles

1. **UUIDs everywhere** — All primary keys are UUIDs (`gen_random_uuid()`). No sequential integers in external-facing keys to prevent enumeration attacks.
2. **Soft deletes** — Records are never hard-deleted. `deleted_at TIMESTAMPTZ` is set instead. Indexes filter out deleted rows.
3. **Audit trail** — All significant mutations captured in `audit_logs`.
4. **UTC timestamps** — All timestamps stored in UTC with timezone (`TIMESTAMPTZ`). Display timezone is a user preference.
5. **Normalize where sensible** — Join tables instead of JSON blobs for structured relationships. JSON/JSONB only for truly schemaless data (AI metadata, platform-specific analytics fields).
6. **Index foreign keys** — Every FK column has a corresponding index.
7. **Constraints enforce invariants** — Business rules encoded as CHECK constraints wherever feasible, not only in application code.

---

## 2. Complete Table Definitions

### Enable Required Extensions

```sql
-- Run once per database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- For full-text search
CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector for AI embeddings (optional, future)
```

---

### 2.1 organizations

```sql
-- ============================================================
-- organizations
-- Root entity for multi-tenant isolation.
-- Each NGO, CSR team, or agency is one organization.
-- ============================================================

CREATE TABLE organizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,           -- URL-safe identifier e.g. "wateraid-india"
    description         TEXT,
    website_url         TEXT,
    logo_url            TEXT,
    industry            TEXT NOT NULL DEFAULT 'ngos_sanitation',
                        -- 'ngos_sanitation' | 'csr_hygiene' | 'advocacy' | 'research' | 'other'
    country             TEXT NOT NULL DEFAULT 'IN',     -- ISO 3166-1 alpha-2
    timezone            TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    subscription_tier   TEXT NOT NULL DEFAULT 'free'
                        CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE organizations IS 'Root multi-tenant entity. Every piece of data is scoped to an org.';
COMMENT ON COLUMN organizations.slug IS 'Unique URL-safe identifier. Used in API paths and UI.';
COMMENT ON COLUMN organizations.subscription_tier IS 'Controls feature gates and AI budget limits.';

-- Indexes
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_subscription_tier ON organizations(subscription_tier);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON organizations
    FOR SELECT USING (
        id = (current_setting('app.current_org_id', TRUE))::uuid
        OR id IN (
            SELECT org_id FROM user_organization_memberships
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
    );

CREATE POLICY "org_update" ON organizations
    FOR UPDATE USING (
        id = (current_setting('app.current_org_id', TRUE))::uuid
        AND EXISTS (
            SELECT 1 FROM user_organization_memberships
            WHERE org_id = organizations.id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND deleted_at IS NULL
        )
    );
```

---

### 2.2 users

```sql
-- ============================================================
-- users
-- Application users, linked to Supabase auth.users.
-- One user can belong to multiple organizations.
-- ============================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_uid        UUID NOT NULL UNIQUE,           -- References auth.users(id)
    email               TEXT NOT NULL UNIQUE,
    full_name           TEXT,
    avatar_url          TEXT,
    phone               TEXT,
    preferred_timezone  TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    last_active_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'Application user profiles. Linked 1:1 to Supabase auth.users.';
COMMENT ON COLUMN users.supabase_uid IS 'Foreign key to Supabase auth.users(id). Used for JWT auth.';

CREATE INDEX idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (supabase_uid = auth.uid());

CREATE POLICY "users_select_team" ON users
    FOR SELECT USING (
        id IN (
            SELECT user_id FROM user_organization_memberships
            WHERE org_id = (current_setting('app.current_org_id', TRUE))::uuid
              AND deleted_at IS NULL
        )
    );

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (supabase_uid = auth.uid());
```

---

### 2.3 user_organization_memberships

```sql
-- ============================================================
-- user_organization_memberships
-- Join table: users <-> organizations with role assignment.
-- A user can be a member of multiple organizations with different roles.
-- ============================================================

CREATE TABLE user_organization_memberships (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'editor'
                        CHECK (role IN ('owner', 'admin', 'manager', 'editor', 'viewer')),
    invited_by          UUID REFERENCES users(id),
    invitation_email    TEXT,                           -- Email if invited before they signed up
    invitation_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    invited_at          TIMESTAMPTZ,
    joined_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT unique_user_org UNIQUE (user_id, org_id)
);

COMMENT ON TABLE user_organization_memberships IS 'Maps users to organizations with RBAC roles.';
COMMENT ON COLUMN user_organization_memberships.role IS 'owner > admin > manager > editor > viewer';

CREATE INDEX idx_memberships_user_id ON user_organization_memberships(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_org_id ON user_organization_memberships(org_id) WHERE deleted_at IS NULL;

CREATE TRIGGER memberships_updated_at
    BEFORE UPDATE ON user_organization_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE user_organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select" ON user_organization_memberships
    FOR SELECT USING (
        user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid())
        OR org_id = (current_setting('app.current_org_id', TRUE))::uuid
    );
```

---

### 2.4 brand_profiles

```sql
-- ============================================================
-- brand_profiles
-- An organization's core brand settings: tone, industry context,
-- mission, and communication preferences. Used to inject brand
-- context into all AI generation prompts.
-- ============================================================

CREATE TABLE brand_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    mission_statement       TEXT,
    tagline                 TEXT,
    target_audience         TEXT,                       -- Free-form description
    primary_beneficiaries   TEXT,                       -- Who the org serves
    key_impact_areas        TEXT[],                     -- ['menstrual hygiene', 'school sanitation', ...]
    tone_formal             SMALLINT NOT NULL DEFAULT 3 CHECK (tone_formal BETWEEN 1 AND 5),
    tone_empathy            SMALLINT NOT NULL DEFAULT 3 CHECK (tone_empathy BETWEEN 1 AND 5),
    tone_data_driven        SMALLINT NOT NULL DEFAULT 3 CHECK (tone_data_driven BETWEEN 1 AND 5),
    tone_boldness           SMALLINT NOT NULL DEFAULT 3 CHECK (tone_boldness BETWEEN 1 AND 5),
    tone_storytelling       SMALLINT NOT NULL DEFAULT 3 CHECK (tone_storytelling BETWEEN 1 AND 5),
    tone_descriptors        TEXT[],                     -- ['compassionate', 'urgent', 'evidence-based']
    avoid_list              TEXT[],                     -- Words/phrases to avoid
    signature_phrases       TEXT[],                     -- Brand's signature expressions
    hashtag_strategy        TEXT NOT NULL DEFAULT 'mixed'
                            CHECK (hashtag_strategy IN ('minimal', 'moderate', 'aggressive', 'mixed')),
    emoji_usage             TEXT NOT NULL DEFAULT 'minimal'
                            CHECK (emoji_usage IN ('none', 'minimal', 'moderate', 'expressive')),
    primary_language        TEXT NOT NULL DEFAULT 'en',
    additional_languages    TEXT[],
    logo_url                TEXT,
    color_palette           JSONB,                      -- { "primary": "#1A73E8", "secondary": "#..." }
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE brand_profiles IS 'Brand voice and identity settings. 1:1 with organizations.';
COMMENT ON COLUMN brand_profiles.tone_formal IS '1=casual/conversational, 5=formal/corporate';
COMMENT ON COLUMN brand_profiles.key_impact_areas IS 'The specific causes and areas the org focuses on.';

CREATE INDEX idx_brand_profiles_org_id ON brand_profiles(org_id);

CREATE TRIGGER brand_profiles_updated_at
    BEFORE UPDATE ON brand_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_profiles_org_isolation" ON brand_profiles
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.5 social_accounts

```sql
-- ============================================================
-- social_accounts
-- OAuth-connected social media accounts.
-- Tokens stored encrypted (AES-256-GCM at application layer).
-- ============================================================

CREATE TABLE social_accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    connected_by            UUID NOT NULL REFERENCES users(id),
    platform                TEXT NOT NULL
                            CHECK (platform IN ('linkedin', 'instagram', 'twitter', 'facebook')),
    platform_account_id     TEXT NOT NULL,              -- Platform's user/page ID
    platform_account_name   TEXT,                       -- Display name on platform
    platform_account_type   TEXT NOT NULL DEFAULT 'personal'
                            CHECK (platform_account_type IN ('personal', 'page', 'organization')),
    profile_picture_url     TEXT,
    -- Tokens encrypted at application layer before insert
    access_token_encrypted  TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,
    scopes                  TEXT[],                     -- Granted OAuth scopes
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at            TIMESTAMPTZ,
    follower_count          INTEGER,
    connection_metadata     JSONB,                      -- Platform-specific extra data
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT unique_platform_account UNIQUE (org_id, platform, platform_account_id)
);

COMMENT ON TABLE social_accounts IS 'OAuth-connected social media accounts per organization.';
COMMENT ON COLUMN social_accounts.access_token_encrypted IS 'AES-256-GCM encrypted. Never stored in plain text.';

CREATE INDEX idx_social_accounts_org_id ON social_accounts(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_social_accounts_platform ON social_accounts(org_id, platform) WHERE deleted_at IS NULL;
CREATE INDEX idx_social_accounts_token_expires ON social_accounts(token_expires_at) WHERE is_active = TRUE;

CREATE TRIGGER social_accounts_updated_at
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_org_isolation" ON social_accounts
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.6 content_generations

```sql
-- ============================================================
-- content_generations
-- Every AI-generated piece of content. The core content record.
-- One generation can produce output for multiple platforms.
-- ============================================================

CREATE TABLE content_generations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    -- Input
    input_topic         TEXT NOT NULL,                  -- User's input prompt/topic
    input_context       TEXT,                           -- Additional context provided
    target_platforms    TEXT[] NOT NULL,                -- ['linkedin', 'instagram', 'twitter']
    generation_type     TEXT NOT NULL DEFAULT 'single'
                        CHECK (generation_type IN ('single', 'repurpose', 'campaign_bulk', 'template')),

    -- AI metadata
    model_used          TEXT NOT NULL,                  -- 'gpt-4o' | 'claude-sonnet-3-5' | 'gemini-flash-1-5'
    prompt_version      TEXT,                           -- Version of prompt template used
    tokens_input        INTEGER,
    tokens_output       INTEGER,
    generation_cost_usd NUMERIC(10, 6),
    latency_ms          INTEGER,

    -- Output (per-platform content stored in content_outputs join table)

    -- Quality
    quality_score       NUMERIC(3, 2),                  -- 0.00-1.00 composite score
    brand_alignment     NUMERIC(3, 2),                  -- Cosine similarity vs. brand voice

    -- Status
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'generating', 'done', 'failed', 'archived')),
    error_message       TEXT,

    -- User edits
    is_edited           BOOLEAN NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE content_generations IS 'Master record for each AI content generation request.';
COMMENT ON COLUMN content_generations.generation_type IS 'single=one-off, repurpose=1->N formats, campaign_bulk=batch, template=template-based';

CREATE INDEX idx_content_generations_org_id ON content_generations(org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_generations_campaign ON content_generations(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_content_generations_status ON content_generations(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_generations_created_by ON content_generations(created_by);

CREATE TRIGGER content_generations_updated_at
    BEFORE UPDATE ON content_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE content_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_generations_org_isolation" ON content_generations
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.7 content_outputs

```sql
-- ============================================================
-- content_outputs
-- Per-platform generated content for a content_generation.
-- One generation → multiple outputs (one per platform).
-- ============================================================

CREATE TABLE content_outputs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id       UUID NOT NULL REFERENCES content_generations(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL
                        CHECK (platform IN ('linkedin', 'instagram', 'twitter', 'reel_script', 'carousel')),
    content_text        TEXT NOT NULL,                  -- Main generated text
    hashtags            TEXT[],
    hook                TEXT,                           -- Opening line (LinkedIn/Twitter)
    cta                 TEXT,                           -- Call to action
    structured_data     JSONB,                          -- Platform-specific structured output
                        -- LinkedIn: { "hook", "body", "cta", "emoji_usage" }
                        -- Twitter: { "tweets": [...] }
                        -- Carousel: { "slides": [{"heading": "...", "body": "..."}] }
                        -- Reel: { "scenes": [{"duration_sec": 10, "script": "..."}] }
    character_count     INTEGER GENERATED ALWAYS AS (char_length(content_text)) STORED,
    word_count          INTEGER,
    reading_time_sec    INTEGER,
    engagement_score    NUMERIC(3, 2),                  -- 0.00-1.00 predicted engagement
    is_selected         BOOLEAN NOT NULL DEFAULT FALSE, -- User marked as preferred variant
    user_edited_text    TEXT,                           -- If user edited post-generation
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE content_outputs IS 'Per-platform AI output for a content_generation. One row per platform.';
COMMENT ON COLUMN content_outputs.structured_data IS 'Platform-specific structured content (tweets array, carousel slides, reel scenes, etc.)';

CREATE INDEX idx_content_outputs_generation_id ON content_outputs(generation_id);
CREATE INDEX idx_content_outputs_org_platform ON content_outputs(org_id, platform, created_at DESC);

CREATE TRIGGER content_outputs_updated_at
    BEFORE UPDATE ON content_outputs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE content_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_outputs_org_isolation" ON content_outputs
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.8 campaigns

```sql
-- ============================================================
-- campaigns
-- A named campaign groups related content and posts around
-- a theme (e.g., "World Menstrual Hygiene Day 2025",
-- "Q3 CSR Impact Report Launch").
-- ============================================================

CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    name                TEXT NOT NULL,
    description         TEXT,
    campaign_type       TEXT NOT NULL DEFAULT 'awareness'
                        CHECK (campaign_type IN ('awareness', 'fundraising', 'impact_story',
                                                 'event', 'csr_report', 'advocacy', 'other')),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    target_platforms    TEXT[],
    start_date          DATE,
    end_date            DATE,
    goal_description    TEXT,
    target_reach        INTEGER,                        -- Desired impressions/reach
    target_engagements  INTEGER,
    hashtag_set_id      UUID REFERENCES hashtag_sets(id) ON DELETE SET NULL,
    cover_image_url     TEXT,
    total_posts         INTEGER NOT NULL DEFAULT 0,     -- Denormalized counter
    published_posts     INTEGER NOT NULL DEFAULT 0,     -- Denormalized counter
    metadata            JSONB,                          -- Extra campaign-specific data
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE campaigns IS 'Groups of related content around a theme or event.';

CREATE INDEX idx_campaigns_org_id ON campaigns(org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_status ON campaigns(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);

CREATE TRIGGER campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_org_isolation" ON campaigns
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.9 campaign_posts

```sql
-- ============================================================
-- campaign_posts
-- Posts (content_outputs) assigned to a campaign.
-- Tracks the status of each post within the campaign lifecycle.
-- ============================================================

CREATE TABLE campaign_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content_output_id   UUID REFERENCES content_outputs(id) ON DELETE SET NULL,
    platform            TEXT NOT NULL,
    post_order          INTEGER NOT NULL DEFAULT 0,     -- Order within campaign
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'failed', 'cancelled')),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE campaign_posts IS 'Links content outputs to campaigns with approval workflow.';

CREATE INDEX idx_campaign_posts_campaign_id ON campaign_posts(campaign_id);
CREATE INDEX idx_campaign_posts_status ON campaign_posts(campaign_id, status);
CREATE INDEX idx_campaign_posts_org_id ON campaign_posts(org_id);

CREATE TRIGGER campaign_posts_updated_at
    BEFORE UPDATE ON campaign_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_posts_org_isolation" ON campaign_posts
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.10 scheduled_posts

```sql
-- ============================================================
-- scheduled_posts
-- The scheduling queue. Celery Beat reads this table to
-- enqueue publish tasks at the right time.
-- ============================================================

CREATE TABLE scheduled_posts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scheduled_by            UUID NOT NULL REFERENCES users(id),
    content_output_id       UUID NOT NULL REFERENCES content_outputs(id),
    social_account_id       UUID NOT NULL REFERENCES social_accounts(id),
    campaign_id             UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_post_id        UUID REFERENCES campaign_posts(id) ON DELETE SET NULL,

    platform                TEXT NOT NULL,
    scheduled_at            TIMESTAMPTZ NOT NULL,
    timezone                TEXT NOT NULL DEFAULT 'UTC',

    -- Final content to publish (may differ from generated if user edited)
    final_text              TEXT NOT NULL,
    final_hashtags          TEXT[],
    media_urls              TEXT[],
    structured_content      JSONB,                      -- Twitter threads, etc.

    -- Status tracking
    status                  TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'processing', 'published', 'failed', 'cancelled')),
    celery_task_id          TEXT,                       -- Celery task UUID for monitoring
    retry_count             SMALLINT NOT NULL DEFAULT 0,
    max_retries             SMALLINT NOT NULL DEFAULT 3,
    last_error              TEXT,
    published_at            TIMESTAMPTZ,                -- Actual publish time

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE scheduled_posts IS 'Scheduling queue. Celery Beat polls this to enqueue publish tasks.';
COMMENT ON COLUMN scheduled_posts.final_text IS 'The exact text to publish. May differ from AI output if user edited.';

-- Critical query: "find posts due in the next 5 minutes"
CREATE INDEX idx_scheduled_posts_due ON scheduled_posts(scheduled_at)
    WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_posts_org ON scheduled_posts(org_id, scheduled_at DESC);
CREATE INDEX idx_scheduled_posts_campaign ON scheduled_posts(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_scheduled_posts_social_account ON scheduled_posts(social_account_id);

CREATE TRIGGER scheduled_posts_updated_at
    BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_posts_org_isolation" ON scheduled_posts
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.11 published_posts

```sql
-- ============================================================
-- published_posts
-- Immutable record of every post successfully published.
-- Source of truth for analytics and history.
-- ============================================================

CREATE TABLE published_posts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id),
    scheduled_post_id       UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
    social_account_id       UUID NOT NULL REFERENCES social_accounts(id),
    campaign_id             UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    platform                TEXT NOT NULL,
    platform_post_id        TEXT NOT NULL,              -- Platform's internal ID for the post
    platform_post_url       TEXT,                       -- Permalink to the post
    published_at            TIMESTAMPTZ NOT NULL,
    published_text          TEXT NOT NULL,
    published_hashtags      TEXT[],
    published_media_urls    TEXT[],

    -- Initial metrics snapshot (updated by analytics sync)
    initial_likes           INTEGER NOT NULL DEFAULT 0,
    initial_comments        INTEGER NOT NULL DEFAULT 0,
    initial_shares          INTEGER NOT NULL DEFAULT 0,
    initial_impressions     INTEGER NOT NULL DEFAULT 0,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE published_posts IS 'Immutable log of all successfully published posts.';
COMMENT ON COLUMN published_posts.platform_post_id IS 'The ID assigned by the social platform. Used to fetch analytics.';

CREATE UNIQUE INDEX idx_published_posts_platform_id ON published_posts(platform, platform_post_id);
CREATE INDEX idx_published_posts_org_id ON published_posts(org_id, published_at DESC);
CREATE INDEX idx_published_posts_campaign ON published_posts(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_published_posts_social_account ON published_posts(social_account_id);

ALTER TABLE published_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published_posts_org_isolation" ON published_posts
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.12 hashtag_sets

```sql
-- ============================================================
-- hashtag_sets
-- Saved collections of hashtags for reuse across posts.
-- Can be associated with campaigns or used standalone.
-- ============================================================

CREATE TABLE hashtag_sets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    name                TEXT NOT NULL,
    description         TEXT,
    platform            TEXT                            -- NULL = all platforms
                        CHECK (platform IN ('linkedin', 'instagram', 'twitter', NULL)),
    hashtags            TEXT[] NOT NULL,
    is_default          BOOLEAN NOT NULL DEFAULT FALSE, -- One default per platform per org
    usage_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE hashtag_sets IS 'Saved hashtag collections for reuse. Can be campaign-level or org-level defaults.';

CREATE INDEX idx_hashtag_sets_org_id ON hashtag_sets(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hashtag_sets_platform ON hashtag_sets(org_id, platform) WHERE deleted_at IS NULL;

-- Only one default per platform per org
CREATE UNIQUE INDEX idx_hashtag_sets_one_default ON hashtag_sets(org_id, platform)
    WHERE is_default = TRUE AND deleted_at IS NULL;

CREATE TRIGGER hashtag_sets_updated_at
    BEFORE UPDATE ON hashtag_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE hashtag_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hashtag_sets_org_isolation" ON hashtag_sets
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.13 hashtag_performance

```sql
-- ============================================================
-- hashtag_performance
-- Tracks engagement performance of individual hashtags
-- over time. Enables hashtag strategy optimization.
-- ============================================================

CREATE TABLE hashtag_performance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    hashtag             TEXT NOT NULL,
    platform            TEXT NOT NULL,
    published_post_id   UUID REFERENCES published_posts(id) ON DELETE CASCADE,
    impressions         INTEGER,
    engagements         INTEGER,
    reach               INTEGER,
    recorded_at         DATE NOT NULL DEFAULT CURRENT_DATE
);

COMMENT ON TABLE hashtag_performance IS 'Per-post, per-hashtag performance metrics for hashtag strategy optimization.';

CREATE INDEX idx_hashtag_perf_org ON hashtag_performance(org_id, hashtag, platform);
CREATE INDEX idx_hashtag_perf_date ON hashtag_performance(org_id, recorded_at DESC);

ALTER TABLE hashtag_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hashtag_performance_org_isolation" ON hashtag_performance
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.14 content_templates

```sql
-- ============================================================
-- content_templates
-- Reusable prompt templates with pre-filled structure.
-- System templates (org_id IS NULL) available to all users.
-- Org-specific templates are private.
-- ============================================================

CREATE TABLE content_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = system template
    created_by          UUID REFERENCES users(id),
    name                TEXT NOT NULL,
    description         TEXT,
    category            TEXT NOT NULL
                        CHECK (category IN ('awareness', 'impact_story', 'fundraising',
                                            'event', 'educational', 'csr_report',
                                            'festival', 'founder_voice', 'other')),
    platform            TEXT                            -- NULL = multi-platform
                        CHECK (platform IN ('linkedin', 'instagram', 'twitter', 'all', NULL)),
    prompt_template     TEXT NOT NULL,                  -- Prompt with {{variable}} placeholders
    variables           JSONB,                          -- { "variables": [{"name": "...", "label": "...", "required": true}] }
    example_output      TEXT,                           -- Example AI output for preview
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE, -- Shown in template gallery
    usage_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE content_templates IS 'Reusable prompt templates. org_id=NULL means system-wide template.';
COMMENT ON COLUMN content_templates.variables IS 'JSON array of variable definitions for the prompt template.';

CREATE INDEX idx_content_templates_org ON content_templates(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_templates_category ON content_templates(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_templates_featured ON content_templates(is_featured) WHERE is_featured = TRUE;

CREATE TRIGGER content_templates_updated_at
    BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

-- Users can see system templates AND their org's templates
CREATE POLICY "content_templates_select" ON content_templates
    FOR SELECT USING (
        org_id IS NULL                                      -- System templates
        OR org_id = (current_setting('app.current_org_id', TRUE))::uuid  -- Org templates
    );

CREATE POLICY "content_templates_write" ON content_templates
    FOR ALL USING (
        org_id = (current_setting('app.current_org_id', TRUE))::uuid
    );
```

---

### 2.15 brand_voice_profiles

```sql
-- ============================================================
-- brand_voice_profiles
-- Stores founder voice analysis results and brand voice
-- cloning data. One org can have multiple voice profiles
-- (e.g., one for the founder, one for the organization itself).
-- ============================================================

CREATE TABLE brand_voice_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by              UUID NOT NULL REFERENCES users(id),
    name                    TEXT NOT NULL,               -- "CEO Voice", "Org Voice", "Campaign Tone"
    profile_type            TEXT NOT NULL DEFAULT 'organization'
                            CHECK (profile_type IN ('organization', 'founder', 'campaign')),
    sample_posts            TEXT[],                      -- Raw sample text used for analysis
    analysis_result         JSONB,                       -- Detailed AI analysis of voice patterns
    -- Analysis structure:
    -- {
    --   "avg_sentence_length": 12.5,
    --   "vocabulary_complexity": 0.6,
    --   "personal_anecdote_rate": 0.3,
    --   "opening_patterns": ["I was...", "Here's the thing..."],
    --   "emoji_frequency": 0.1,
    --   "exclamation_rate": 0.05,
    --   "signature_phrases": [...],
    --   "preferred_hashtag_style": "descriptive"
    -- }
    system_prompt           TEXT,                        -- Generated system prompt encapsulating the voice
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    samples_count           SMALLINT NOT NULL DEFAULT 0,
    last_trained_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE brand_voice_profiles IS 'Stores analyzed voice profiles for brand voice cloning. One org can have multiple.';

CREATE INDEX idx_voice_profiles_org_id ON brand_voice_profiles(org_id) WHERE is_active = TRUE;

CREATE TRIGGER voice_profiles_updated_at
    BEFORE UPDATE ON brand_voice_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE brand_voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_profiles_org_isolation" ON brand_voice_profiles
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.16 festival_calendar

```sql
-- ============================================================
-- festival_calendar
-- Awareness days, international observances, and festivals
-- relevant to sanitation, health, and NGO/CSR content.
-- System-managed (org_id IS NULL) + org-specific entries.
-- ============================================================

CREATE TABLE festival_calendar (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = global
    name                TEXT NOT NULL,
    description         TEXT,
    event_date          DATE NOT NULL,
    is_recurring_annual BOOLEAN NOT NULL DEFAULT TRUE,
    category            TEXT NOT NULL
                        CHECK (category IN ('menstrual_hygiene', 'water_sanitation', 'health',
                                            'women_empowerment', 'international_day', 'national_india',
                                            'csr', 'environmental', 'education', 'other')),
    hashtags            TEXT[],                         -- Suggested hashtags for this day
    content_ideas       TEXT[],                         -- AI-generated content angle ideas
    platforms           TEXT[],                         -- Best platforms for this event
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    source_url          TEXT,                           -- Reference (UN, WHO, GOI, etc.)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE festival_calendar IS 'Awareness days and festivals for content planning. System entries have org_id=NULL.';

CREATE INDEX idx_festival_calendar_date ON festival_calendar(event_date);
CREATE INDEX idx_festival_calendar_category ON festival_calendar(category);
CREATE INDEX idx_festival_calendar_recurring ON festival_calendar(is_recurring_annual, event_date);

CREATE TRIGGER festival_calendar_updated_at
    BEFORE UPDATE ON festival_calendar
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE festival_calendar ENABLE ROW LEVEL SECURITY;

-- All users can see global calendar; org users see their custom entries
CREATE POLICY "festival_calendar_select" ON festival_calendar
    FOR SELECT USING (
        org_id IS NULL
        OR org_id = (current_setting('app.current_org_id', TRUE))::uuid
    );

CREATE POLICY "festival_calendar_write" ON festival_calendar
    FOR ALL USING (
        org_id = (current_setting('app.current_org_id', TRUE))::uuid
    );
```

---

### 2.17 analytics_snapshots

```sql
-- ============================================================
-- analytics_snapshots
-- Periodic snapshots of overall account-level analytics
-- pulled from social platform APIs.
-- Partitioned by month for query performance.
-- ============================================================

CREATE TABLE analytics_snapshots (
    id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    social_account_id   UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    snapshot_date       DATE NOT NULL,

    -- Account-level metrics
    follower_count      INTEGER,
    following_count     INTEGER,
    total_posts         INTEGER,

    -- Period metrics (for the 24h before snapshot)
    period_impressions  INTEGER,
    period_reach        INTEGER,
    period_engagements  INTEGER,
    period_new_followers INTEGER,
    period_profile_views INTEGER,

    -- Raw platform response for future use
    raw_data            JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, snapshot_date)    -- Required for partitioning
) PARTITION BY RANGE (snapshot_date);

-- Create monthly partitions for current year + next year
CREATE TABLE analytics_snapshots_2025_01 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE analytics_snapshots_2025_02 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE analytics_snapshots_2025_03 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE analytics_snapshots_2025_04 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE analytics_snapshots_2025_05 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE analytics_snapshots_2025_06 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE analytics_snapshots_2025_07 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE analytics_snapshots_2025_08 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE analytics_snapshots_2025_09 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE analytics_snapshots_2025_10 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE analytics_snapshots_2025_11 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE analytics_snapshots_2025_12 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE analytics_snapshots_2026_01 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- Additional partitions created automatically by monthly Celery task

COMMENT ON TABLE analytics_snapshots IS 'Daily account-level analytics snapshots. Partitioned by month.';

CREATE INDEX idx_analytics_snapshots_org ON analytics_snapshots(org_id, snapshot_date DESC);
CREATE INDEX idx_analytics_snapshots_account ON analytics_snapshots(social_account_id, snapshot_date DESC);

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_snapshots_org_isolation" ON analytics_snapshots
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.18 post_analytics

```sql
-- ============================================================
-- post_analytics
-- Per-post analytics metrics updated by analytics sync tasks.
-- Partitioned by month based on recorded_at.
-- ============================================================

CREATE TABLE post_analytics (
    id                  UUID NOT NULL DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    published_post_id   UUID NOT NULL REFERENCES published_posts(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,

    -- Core engagement metrics
    impressions         INTEGER NOT NULL DEFAULT 0,
    reach               INTEGER NOT NULL DEFAULT 0,
    likes               INTEGER NOT NULL DEFAULT 0,
    comments            INTEGER NOT NULL DEFAULT 0,
    shares              INTEGER NOT NULL DEFAULT 0,
    saves               INTEGER NOT NULL DEFAULT 0,
    clicks              INTEGER NOT NULL DEFAULT 0,
    video_views         INTEGER NOT NULL DEFAULT 0,     -- For video/reel posts
    video_watch_time_sec INTEGER NOT NULL DEFAULT 0,

    -- Calculated metrics
    engagement_rate     NUMERIC(6, 4) GENERATED ALWAYS AS (
                            CASE WHEN impressions > 0
                            THEN (likes + comments + shares + saves)::NUMERIC / impressions
                            ELSE 0 END
                        ) STORED,

    -- Platform-specific metrics stored in JSONB
    platform_metrics    JSONB,
    -- LinkedIn: { "dwell_time", "reactions_breakdown", "follower_reach" }
    -- Instagram: { "story_views", "profile_visits", "accounts_engaged" }
    -- Twitter: { "retweets", "quote_tweets", "link_clicks", "bookmarks" }

    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    snapshot_type       TEXT NOT NULL DEFAULT 'periodic'
                        CHECK (snapshot_type IN ('initial', 'periodic', 'final')),

    PRIMARY KEY (id, recorded_at)  -- Required for partitioning
) PARTITION BY RANGE (recorded_at);

-- Monthly partitions (same pattern as analytics_snapshots)
CREATE TABLE post_analytics_2025_01 PARTITION OF post_analytics
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE post_analytics_2025_02 PARTITION OF post_analytics
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... (same monthly pattern through 2026)
CREATE TABLE post_analytics_2026_01 PARTITION OF post_analytics
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

COMMENT ON TABLE post_analytics IS 'Time-series engagement metrics per published post. Partitioned by month.';

CREATE INDEX idx_post_analytics_post ON post_analytics(published_post_id, recorded_at DESC);
CREATE INDEX idx_post_analytics_org ON post_analytics(org_id, recorded_at DESC);

ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_analytics_org_isolation" ON post_analytics
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.19 content_ideas

```sql
-- ============================================================
-- content_ideas
-- Saved content ideas, topic bank, and briefs.
-- Users can save ideas before generating full content.
-- ============================================================

CREATE TABLE content_ideas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    brief               TEXT,
    content_angle       TEXT,                           -- Unique angle or hook
    target_audience     TEXT,
    platforms           TEXT[],
    festival_id         UUID REFERENCES festival_calendar(id) ON DELETE SET NULL,
    tags                TEXT[],
    status              TEXT NOT NULL DEFAULT 'idea'
                        CHECK (status IN ('idea', 'approved', 'in_progress', 'generated', 'published', 'rejected')),
    priority            SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE content_ideas IS 'Topic bank for content planning. Ideas before they become generations.';

CREATE INDEX idx_content_ideas_org ON content_ideas(org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_ideas_status ON content_ideas(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_ideas_campaign ON content_ideas(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE TRIGGER content_ideas_updated_at
    BEFORE UPDATE ON content_ideas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_ideas_org_isolation" ON content_ideas
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.20 repurposed_content

```sql
-- ============================================================
-- repurposed_content
-- Tracks repurposing relationships: which content was
-- repurposed from which source, and what formats were created.
-- ============================================================

CREATE TABLE repurposed_content (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_generation_id    UUID NOT NULL REFERENCES content_generations(id),
    target_generation_id    UUID NOT NULL REFERENCES content_generations(id),
    repurpose_type          TEXT NOT NULL
                            CHECK (repurpose_type IN ('platform_adapt', 'format_change',
                                                       'length_change', 'tone_change', 'full_repurpose')),
    source_platform         TEXT,
    target_platform         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE repurposed_content IS 'Tracks lineage of repurposed content. Source → Target generation relationship.';

CREATE INDEX idx_repurposed_content_source ON repurposed_content(source_generation_id);
CREATE INDEX idx_repurposed_content_target ON repurposed_content(target_generation_id);
CREATE INDEX idx_repurposed_content_org ON repurposed_content(org_id);

ALTER TABLE repurposed_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repurposed_content_org_isolation" ON repurposed_content
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.21 ai_usage_logs

```sql
-- ============================================================
-- ai_usage_logs
-- Records every AI API call with model, token counts, and cost.
-- Used for billing, budget tracking, and optimization analysis.
-- ============================================================

CREATE TABLE ai_usage_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    generation_id       UUID REFERENCES content_generations(id) ON DELETE SET NULL,
    task_type           TEXT NOT NULL,
    model               TEXT NOT NULL,
    provider            TEXT NOT NULL
                        CHECK (provider IN ('openai', 'anthropic', 'google')),
    tokens_input        INTEGER NOT NULL DEFAULT 0,
    tokens_output       INTEGER NOT NULL DEFAULT 0,
    tokens_cached       INTEGER NOT NULL DEFAULT 0,     -- Tokens served from cache (free)
    cost_usd            NUMERIC(12, 8) NOT NULL DEFAULT 0,
    latency_ms          INTEGER,
    was_cached          BOOLEAN NOT NULL DEFAULT FALSE,
    was_fallback        BOOLEAN NOT NULL DEFAULT FALSE, -- True if primary model failed
    error_code          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_usage_logs IS 'Append-only log of all AI API calls for cost tracking and optimization.';

CREATE INDEX idx_ai_usage_logs_org ON ai_usage_logs(org_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_model ON ai_usage_logs(model, created_at DESC);
-- For monthly billing aggregation
CREATE INDEX idx_ai_usage_logs_monthly ON ai_usage_logs(org_id, date_trunc('month', created_at));

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_logs_org_isolation" ON ai_usage_logs
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

### 2.22 subscription_plans

```sql
-- ============================================================
-- subscription_plans
-- Plan definitions. System-managed (not per-org).
-- ============================================================

CREATE TABLE subscription_plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL UNIQUE,        -- 'free', 'starter', 'pro', 'enterprise'
    display_name            TEXT NOT NULL,               -- 'Free', 'Starter', 'Professional', 'Enterprise'
    description             TEXT,
    price_monthly_inr       NUMERIC(10, 2),
    price_yearly_inr        NUMERIC(10, 2),
    price_monthly_usd       NUMERIC(10, 2),
    price_yearly_usd        NUMERIC(10, 2),

    -- Feature limits
    max_team_members        INTEGER,                     -- NULL = unlimited
    max_social_accounts     INTEGER,
    max_campaigns           INTEGER,
    max_scheduled_posts_per_month INTEGER,
    ai_budget_usd_monthly   NUMERIC(10, 2),
    ai_requests_per_hour    INTEGER,
    max_brand_voice_profiles INTEGER,
    max_campaigns_active    INTEGER,

    -- Feature flags
    feature_repurposing     BOOLEAN NOT NULL DEFAULT FALSE,
    feature_founder_voice   BOOLEAN NOT NULL DEFAULT FALSE,
    feature_bulk_campaign   BOOLEAN NOT NULL DEFAULT FALSE,
    feature_advanced_analytics BOOLEAN NOT NULL DEFAULT FALSE,
    feature_api_access      BOOLEAN NOT NULL DEFAULT FALSE,
    feature_white_label     BOOLEAN NOT NULL DEFAULT FALSE,

    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order              SMALLINT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subscription_plans IS 'Plan definitions with feature limits. Managed by Brandora team.';

-- RLS: Everyone can read plans; only service role can write
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON subscription_plans FOR SELECT USING (is_active = TRUE);
```

---

### 2.23 organization_subscriptions

```sql
-- ============================================================
-- organization_subscriptions
-- Current subscription state for each organization.
-- Tracks Razorpay/Stripe subscription IDs for payment reconciliation.
-- ============================================================

CREATE TABLE organization_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES subscription_plans(id),
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('trialing', 'active', 'past_due',
                                              'cancelled', 'paused', 'expired')),
    payment_provider        TEXT CHECK (payment_provider IN ('razorpay', 'stripe', 'manual')),
    provider_subscription_id TEXT,                       -- Razorpay/Stripe subscription ID
    provider_customer_id    TEXT,
    billing_cycle           TEXT NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    trial_end               TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
    metadata                JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organization_subscriptions IS 'Active subscription state per org. 1:1 with organizations.';

CREATE INDEX idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_org_subscriptions_period_end ON organization_subscriptions(current_period_end)
    WHERE status IN ('active', 'trialing');

CREATE TRIGGER org_subscriptions_updated_at
    BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_subscriptions_select" ON organization_subscriptions
    FOR SELECT USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);

-- Trigger: sync subscription_tier on organizations when subscription changes
CREATE OR REPLACE FUNCTION sync_org_subscription_tier()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE organizations
    SET subscription_tier = (
        SELECT name FROM subscription_plans WHERE id = NEW.plan_id
    )
    WHERE id = NEW.org_id;
    RETURN NEW;
END; $$;

CREATE TRIGGER sync_subscription_tier
    AFTER INSERT OR UPDATE ON organization_subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_org_subscription_tier();
```

---

### 2.24 audit_logs

```sql
-- ============================================================
-- audit_logs
-- Append-only record of significant data mutations.
-- Used for compliance, debugging, and security review.
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,           -- 'content.generated', 'post.published', 'member.invited', etc.
    resource_type   TEXT NOT NULL,           -- 'content_generation', 'campaign', 'social_account', etc.
    resource_id     UUID,
    before_state    JSONB,                   -- Snapshot before mutation (for UPDATE/DELETE)
    after_state     JSONB,                   -- Snapshot after mutation
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,                   -- Extra context
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Append-only compliance and security audit log.';

-- BRIN index for time-range queries on large table
CREATE INDEX idx_audit_logs_created_brin ON audit_logs USING BRIN (created_at);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- Audit logs are insert-only; no updates or deletes
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);

-- Only application service role can insert
CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT WITH CHECK (TRUE);

-- No updates or deletes on audit logs (enforced by missing policies for UPDATE/DELETE)
```

---

### 2.25 notifications

```sql
-- ============================================================
-- notifications
-- In-app notifications. Used with Supabase Realtime to push
-- live notifications to the frontend.
-- ============================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL
                    CHECK (type IN (
                        'content.ready', 'post.published', 'post.failed',
                        'campaign.completed', 'analytics.synced',
                        'team.invited', 'team.joined',
                        'subscription.expiring', 'subscription.renewed',
                        'ai_budget.warning', 'ai_budget.exceeded',
                        'token.refresh_failed'
                    )),
    title           TEXT NOT NULL,
    body            TEXT,
    resource_type   TEXT,
    resource_id     UUID,
    action_url      TEXT,                           -- Deep link in the app
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'In-app notifications. INSERT triggers Supabase Realtime push to frontend.';

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read)
    WHERE is_read = FALSE;

-- Auto-mark read_at when is_read set to TRUE
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER notification_read_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION set_notification_read_at();

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON notifications
    USING (user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()));
```

---

### 2.26 webhook_events

```sql
-- ============================================================
-- webhook_events
-- Inbound webhook events from social platforms and payment
-- providers. Processed asynchronously by Celery workers.
-- ============================================================

CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT NOT NULL
                    CHECK (source IN ('linkedin', 'instagram', 'twitter', 'razorpay', 'stripe')),
    event_type      TEXT NOT NULL,                      -- Platform-specific event type
    payload         JSONB NOT NULL,                     -- Raw webhook payload
    signature       TEXT,                               -- Webhook signature for verification
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
    processor_task_id TEXT,                             -- Celery task ID that processed this
    processed_at    TIMESTAMPTZ,
    error_message   TEXT,
    retry_count     SMALLINT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,                        -- Prevent double-processing
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE webhook_events IS 'Inbound webhooks from platforms and payment providers. Processed by Celery workers.';

CREATE INDEX idx_webhook_events_status ON webhook_events(status, created_at DESC)
    WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_events_source ON webhook_events(source, event_type);
-- BRIN on large append-only table
CREATE INDEX idx_webhook_events_created_brin ON webhook_events USING BRIN (created_at);

-- Webhook events: insert-only from outside, no RLS needed (handled by API key at controller level)
```

---

### 2.27 api_keys

```sql
-- ============================================================
-- api_keys
-- API keys for programmatic access and integrations.
-- Key stored as SHA-256 hash only — never in plain text.
-- ============================================================

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    key_prefix      TEXT NOT NULL,          -- First 8 chars, shown in UI: "brd_a1b2"
    key_hash        TEXT NOT NULL UNIQUE,   -- SHA-256 hash of full key
    scopes          TEXT[] NOT NULL DEFAULT '{}',
                    -- ['content:read', 'content:write', 'analytics:read', 'schedule:write', 'admin']
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE api_keys IS 'API keys for integrations. Only the SHA-256 hash of the key is stored.';

CREATE INDEX idx_api_keys_org ON api_keys(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_org_isolation" ON api_keys
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

---

## 3. Entity Relationship Description

```
organizations (1)─────────────────────────────────── (N) user_organization_memberships
     │                                                              │
     │                                                         (N) users
     │
     ├──(1)── brand_profiles
     │
     ├──(N)── social_accounts
     │
     ├──(N)── brand_voice_profiles
     │
     ├──(N)── hashtag_sets
     │
     ├──(N)── content_templates
     │
     ├──(N)── campaigns ─────────────────────────── (N) campaign_posts
     │             │
     │             └──(N)── content_ideas
     │
     ├──(N)── content_generations ──────────────── (N) content_outputs
     │             │                                         │
     │             └──(1:N)── repurposed_content ────────── │
     │
     ├──(N)── scheduled_posts ──────────────────── (N) published_posts
     │             │                                         │
     │             └── [references social_accounts]         └──(N)── post_analytics
     │
     ├──(N)── analytics_snapshots
     │
     ├──(1)── organization_subscriptions ──────── (1) subscription_plans
     │
     ├──(N)── ai_usage_logs
     │
     ├──(N)── audit_logs
     │
     ├──(N)── notifications
     │
     └──(N)── api_keys


festival_calendar ──── (1:N) content_ideas (optional)
                  ──── (system entries have org_id = NULL)

webhook_events ──── standalone (no FK to org; processed before org context known)
```

### Key Relationship Notes

1. **organizations → users** is many-to-many via `user_organization_memberships`. A user joins multiple orgs; an org has multiple users.

2. **content_generations → content_outputs** is 1:N. One generation request can produce outputs for multiple platforms simultaneously (LinkedIn, Instagram, Twitter in parallel).

3. **content_outputs → scheduled_posts → published_posts** is the publishing pipeline. A content output becomes a scheduled post, which on publication becomes an immutable published post.

4. **published_posts → post_analytics** is 1:N (time-series). Analytics are collected multiple times for each post (initial, periodic, final snapshots).

5. **repurposed_content** creates a self-referential graph on `content_generations` (source_generation_id → target_generation_id), capturing the content lineage tree.

6. **festival_calendar** has a dual nature: global entries (org_id = NULL) visible to all, plus org-specific custom events.

---

## 4. Index Strategy

### Index Summary Table

| Table | Index | Type | Purpose |
|---|---|---|---|
| organizations | slug | B-tree | Lookup by URL slug |
| users | supabase_uid | B-tree | JWT auth lookup (hot path) |
| users | email | B-tree | Login lookup |
| user_organization_memberships | user_id | B-tree | Find orgs for a user |
| user_organization_memberships | org_id | B-tree | Find members of an org |
| content_generations | (org_id, created_at DESC) | B-tree composite | Paginated list queries |
| content_generations | (org_id, status) | B-tree composite | Filter by status |
| scheduled_posts | scheduled_at WHERE status='scheduled' | Partial B-tree | Celery Beat scheduler query |
| published_posts | (platform, platform_post_id) | B-tree unique | Prevent duplicate publish |
| published_posts | (org_id, published_at DESC) | B-tree composite | Timeline queries |
| post_analytics | (published_post_id, recorded_at DESC) | B-tree composite | Analytics time-series |
| ai_usage_logs | (org_id, date_trunc('month', created_at)) | B-tree | Monthly billing |
| audit_logs | created_at | BRIN | Time-range scan on append-only table |
| hashtag_sets | (org_id, platform) WHERE is_default=TRUE | Unique partial | One default per platform |
| api_keys | key_hash WHERE is_active=TRUE | B-tree | API authentication (hot path) |
| notifications | (user_id, is_read) WHERE is_read=FALSE | Partial B-tree | Unread notification count |

### Index Design Rationale

**Partial indexes** (WHERE clause) dramatically reduce index size when a condition applies to only a fraction of rows:
- `WHERE deleted_at IS NULL` — most queries only touch live records
- `WHERE status = 'scheduled'` — scheduled_posts query only needs pending items
- `WHERE is_active = TRUE` — API keys, social accounts mostly queried when active

**Composite indexes** — column order matters. Put the most selective filter first:
- `(org_id, created_at DESC)` — org_id is the partition key (equality filter), created_at is for sort/range

**BRIN indexes** on append-only tables (audit_logs, webhook_events) are 100-1000x smaller than B-tree and still effective for time-range queries because rows are physically ordered by insertion time.

---

## 5. RLS Policies

### Core Pattern

All multi-tenant tables follow this pattern:

```sql
-- 1. Enable RLS
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

-- 2. Isolate by org_id using current_setting
CREATE POLICY "<table>_org_isolation" ON <table>
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
```

### Setting the Org Context

The FastAPI backend sets this at the start of each request inside the database session:

```sql
-- Set at the start of every request (via SQLAlchemy event or middleware)
SET LOCAL app.current_org_id = '<org-uuid-from-jwt>';
```

The `LOCAL` qualifier means this setting resets at the end of the transaction, preventing context leakage.

### Complete RLS Policy Reference

```sql
-- ─────────────────────────────────────────────────
-- TABLES WITH SIMPLE ORG ISOLATION
-- (all follow the same pattern)
-- ─────────────────────────────────────────────────

-- brand_profiles, social_accounts, content_generations, content_outputs,
-- campaigns, campaign_posts, scheduled_posts, published_posts,
-- hashtag_sets, hashtag_performance, brand_voice_profiles,
-- post_analytics, analytics_snapshots, content_ideas, repurposed_content,
-- ai_usage_logs, api_keys

-- Pattern:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<table>_org_isolation" ON <table>
    USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);


-- ─────────────────────────────────────────────────
-- SPECIAL POLICIES
-- ─────────────────────────────────────────────────

-- organizations: user must be a member to see the org
CREATE POLICY "org_select" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM user_organization_memberships
            WHERE user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid())
              AND deleted_at IS NULL
        )
    );

-- users: see yourself + teammates in current org
CREATE POLICY "users_select" ON users
    FOR SELECT USING (
        supabase_uid = auth.uid()
        OR id IN (
            SELECT user_id FROM user_organization_memberships
            WHERE org_id = (current_setting('app.current_org_id', TRUE))::uuid
              AND deleted_at IS NULL
        )
    );

-- content_templates: see system templates + org templates
CREATE POLICY "content_templates_select" ON content_templates
    FOR SELECT USING (
        org_id IS NULL
        OR org_id = (current_setting('app.current_org_id', TRUE))::uuid
    );

-- festival_calendar: see global + org-specific
CREATE POLICY "festival_calendar_select" ON festival_calendar
    FOR SELECT USING (
        org_id IS NULL
        OR org_id = (current_setting('app.current_org_id', TRUE))::uuid
    );

-- notifications: see only own notifications
CREATE POLICY "notifications_own" ON notifications
    USING (user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()));

-- subscription_plans: public read
CREATE POLICY "plans_public_read" ON subscription_plans
    FOR SELECT USING (is_active = TRUE);

-- audit_logs: read own org's logs; insert-only (no update/delete policies)
CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT USING (org_id = (current_setting('app.current_org_id', TRUE))::uuid);
CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT WITH CHECK (TRUE);  -- Application inserts only; no user-facing insert


-- ─────────────────────────────────────────────────
-- ROLE-BASED WRITE RESTRICTIONS
-- ─────────────────────────────────────────────────

-- Admins/owners can manage team members
CREATE POLICY "memberships_manage" ON user_organization_memberships
    FOR ALL USING (
        org_id = (current_setting('app.current_org_id', TRUE))::uuid
        AND EXISTS (
            SELECT 1 FROM user_organization_memberships m2
            WHERE m2.org_id = user_organization_memberships.org_id
              AND m2.user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid())
              AND m2.role IN ('owner', 'admin')
              AND m2.deleted_at IS NULL
        )
    );

-- Only admins/owners can delete social accounts
CREATE POLICY "social_accounts_delete" ON social_accounts
    FOR DELETE USING (
        org_id = (current_setting('app.current_org_id', TRUE))::uuid
        AND EXISTS (
            SELECT 1 FROM user_organization_memberships
            WHERE org_id = social_accounts.org_id
              AND user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid())
              AND role IN ('owner', 'admin')
              AND deleted_at IS NULL
        )
    );
```

---

## 6. Migration Strategy

### Alembic Setup

```python
# alembic/env.py
from app.core.database import SYNC_DATABASE_URL  # Use sync URL for migrations
from app.models import *  # Import all models so Alembic detects them

target_metadata = Base.metadata

def run_migrations_online():
    connectable = create_engine(SYNC_DATABASE_URL)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
        )
        with context.begin_transaction():
            context.run_migrations()
```

### Migration Conventions

```bash
# Create a new migration (auto-detect changes from models)
alembic revision --autogenerate -m "add_campaign_analytics_columns"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Show migration history
alembic history --verbose
```

### Migration File Conventions

```python
# alembic/versions/20250601_001_add_campaign_analytics.py

"""add campaign analytics columns

Revision ID: 20250601_001
Revises: 20250520_003
Create Date: 2025-06-01 10:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = '20250601_001'
down_revision = '20250520_003'


def upgrade():
    # Always non-destructive: add columns with defaults
    op.add_column('campaigns', sa.Column(
        'total_impressions', sa.Integer(), nullable=False, server_default='0'
    ))
    # Create new index
    op.create_index('idx_campaigns_impressions', 'campaigns', ['org_id', 'total_impressions'])


def downgrade():
    op.drop_index('idx_campaigns_impressions')
    op.drop_column('campaigns', 'total_impressions')
```

### Migration Rules

1. **Never rename columns in a single migration** — add new column, migrate data, drop old column in separate PRs
2. **New columns must have defaults** — no nullable violations on existing rows
3. **Index creation uses CONCURRENTLY** — avoid table locks in production:
   ```python
   op.execute("CREATE INDEX CONCURRENTLY idx_new ON table(col)")
   ```
4. **Always write a downgrade** — every migration is reversible
5. **RLS policies in migrations** — any new table gets its RLS policy in the same migration
6. **Test on staging first** — run `alembic upgrade head` on staging, verify, then production
7. **Monthly partition creation** — automated via Celery Beat task (not Alembic):

```python
# app/tasks/analytics_tasks.py
@celery_app.task
def create_next_month_partitions():
    """Runs on the 25th of each month to create next month's partitions."""
    next_month = date.today().replace(day=1) + relativedelta(months=1)
    month_start = next_month.strftime('%Y-%m-%d')
    month_end = (next_month + relativedelta(months=1)).strftime('%Y-%m-%d')
    year_month = next_month.strftime('%Y_%m')

    db.execute(f"""
        CREATE TABLE IF NOT EXISTS post_analytics_{year_month}
        PARTITION OF post_analytics
        FOR VALUES FROM ('{month_start}') TO ('{month_end}');

        CREATE TABLE IF NOT EXISTS analytics_snapshots_{year_month}
        PARTITION OF analytics_snapshots
        FOR VALUES FROM ('{month_start}') TO ('{month_end}');
    """)
```

---

## 7. Seed Data

### Initial Seed Script

```sql
-- ================================================================
-- BRANDORA AI — SEED DATA
-- Run once after initial migration
-- ================================================================

-- ── 1. SUBSCRIPTION PLANS ────────────────────────────────────────

INSERT INTO subscription_plans (
    name, display_name, description,
    price_monthly_inr, price_yearly_inr,
    price_monthly_usd, price_yearly_usd,
    max_team_members, max_social_accounts, max_campaigns,
    max_scheduled_posts_per_month, ai_budget_usd_monthly, ai_requests_per_hour,
    max_brand_voice_profiles, max_campaigns_active,
    feature_repurposing, feature_founder_voice, feature_bulk_campaign,
    feature_advanced_analytics, feature_api_access, feature_white_label,
    sort_order
) VALUES
(
    'free', 'Free', 'For individuals and small teams getting started',
    0, 0, 0, 0,
    2, 1, 2,
    20, 2.00, 10,
    1, 1,
    FALSE, FALSE, FALSE,
    FALSE, FALSE, FALSE,
    0
),
(
    'starter', 'Starter', 'For growing NGOs and CSR teams',
    2999, 29999, 35, 350,
    5, 3, 10,
    100, 15.00, 50,
    2, 5,
    TRUE, FALSE, FALSE,
    FALSE, FALSE, FALSE,
    1
),
(
    'pro', 'Professional', 'For established organizations with active social media',
    7999, 79999, 95, 950,
    15, 10, 50,
    500, 60.00, 200,
    5, 20,
    TRUE, TRUE, TRUE,
    TRUE, FALSE, FALSE,
    2
),
(
    'enterprise', 'Enterprise', 'For large organizations and agencies managing multiple brands',
    19999, 199999, 249, 2490,
    NULL, NULL, NULL,
    NULL, 300.00, 1000,
    NULL, NULL,
    TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE,
    3
);


-- ── 2. SYSTEM CONTENT TEMPLATES ──────────────────────────────────

INSERT INTO content_templates (
    org_id, name, description, category, platform,
    prompt_template, variables, is_featured
) VALUES
(
    NULL,
    'World Menstrual Hygiene Day Post',
    'Template for May 28 - World Menstrual Hygiene Day awareness posts',
    'awareness',
    'all',
    'Write a {{platform}} post for World Menstrual Hygiene Day (May 28) for {{org_name}}. Our mission: {{mission}}. Key message: {{key_message}}. Tone: {{tone}}. Include relevant statistics about menstrual hygiene in India. Add appropriate hashtags.',
    '{"variables": [
        {"name": "platform", "label": "Platform", "required": true, "type": "select", "options": ["LinkedIn", "Instagram", "Twitter"]},
        {"name": "org_name", "label": "Organization Name", "required": true, "type": "text"},
        {"name": "mission", "label": "Your Mission Statement", "required": true, "type": "textarea"},
        {"name": "key_message", "label": "Key Message for This Post", "required": true, "type": "textarea"},
        {"name": "tone", "label": "Tone", "required": false, "type": "select", "options": ["Urgent", "Inspiring", "Educational", "Personal Story"], "default": "Inspiring"}
    ]}',
    TRUE
),
(
    NULL,
    'CSR Impact Story',
    'Template for sharing measurable CSR impact with stakeholders',
    'impact_story',
    'linkedin',
    'Write a LinkedIn post showcasing the CSR impact of {{company_name}} through their partnership with {{org_name}}. Key achievements: {{achievements}}. Beneficiaries reached: {{beneficiaries}}. Duration: {{duration}}. Use the CSR storytelling framework: hook → problem → intervention → impact → CTA.',
    '{"variables": [
        {"name": "company_name", "label": "Corporate Partner Name", "required": true, "type": "text"},
        {"name": "org_name", "label": "Your NGO Name", "required": true, "type": "text"},
        {"name": "achievements", "label": "Key Achievements (list them)", "required": true, "type": "textarea"},
        {"name": "beneficiaries", "label": "Number of People Reached", "required": true, "type": "text"},
        {"name": "duration", "label": "Duration of Partnership", "required": false, "type": "text"}
    ]}',
    TRUE
),
(
    NULL,
    'School Sanitation Campaign',
    'Template for WASH (Water, Sanitation, Hygiene) school programme posts',
    'awareness',
    'instagram',
    'Write an Instagram caption for {{org_name}} about their school WASH programme. Schools covered: {{schools}}. State/region: {{region}}. Impact highlight: {{highlight}}. Make it visually descriptive (as if describing what a viewer sees in a photo). Include 20-25 relevant hashtags.',
    '{"variables": [
        {"name": "org_name", "label": "Organization Name", "required": true, "type": "text"},
        {"name": "schools", "label": "Number of Schools", "required": false, "type": "text"},
        {"name": "region", "label": "State / Region", "required": true, "type": "text"},
        {"name": "highlight", "label": "One Key Impact Highlight", "required": true, "type": "textarea"}
    ]}',
    TRUE
),
(
    NULL,
    'Fundraising Campaign Launch',
    'Template for announcing a new fundraising drive',
    'fundraising',
    'all',
    'Write a {{platform}} post announcing a new fundraising campaign for {{org_name}}. Goal: {{goal_amount}}. Purpose: {{purpose}}. Deadline: {{deadline}}. Donation link: {{link}}. Create urgency while maintaining authenticity. Include a clear CTA.',
    '{"variables": [
        {"name": "platform", "label": "Platform", "required": true, "type": "select", "options": ["LinkedIn", "Instagram", "Twitter"]},
        {"name": "org_name", "label": "Organization Name", "required": true, "type": "text"},
        {"name": "goal_amount", "label": "Fundraising Goal", "required": true, "type": "text"},
        {"name": "purpose", "label": "What the funds will be used for", "required": true, "type": "textarea"},
        {"name": "deadline", "label": "Campaign Deadline", "required": false, "type": "text"},
        {"name": "link", "label": "Donation Link", "required": false, "type": "text"}
    ]}',
    TRUE
),
(
    NULL,
    'Volunteer Thank You Post',
    'Appreciation post for volunteers and field workers',
    'other',
    'instagram',
    'Write an Instagram caption thanking volunteers/field workers for {{org_name}}. Event/activity: {{activity}}. Location: {{location}}. Volunteers involved: {{count}}. Tone: warm, personal, grateful. Include a quote or observation from the field if possible.',
    '{"variables": [
        {"name": "org_name", "label": "Organization Name", "required": true, "type": "text"},
        {"name": "activity", "label": "Activity / Programme Name", "required": true, "type": "text"},
        {"name": "location", "label": "Location (State / City / Village)", "required": true, "type": "text"},
        {"name": "count", "label": "Number of Volunteers", "required": false, "type": "text"}
    ]}',
    TRUE
),
(
    NULL,
    'Twitter Awareness Thread',
    'Multi-tweet educational thread on sanitation or hygiene topic',
    'educational',
    'twitter',
    'Write a Twitter/X thread (6-8 tweets) on "{{topic}}" for {{org_name}}. Include surprising facts, human stories, and end with a CTA. Each tweet must be under 280 characters. Thread should educate and drive engagement. Final tweet: include hashtags.',
    '{"variables": [
        {"name": "topic", "label": "Topic (e.g., Menstrual Hygiene in Rural India)", "required": true, "type": "text"},
        {"name": "org_name", "label": "Organization Name", "required": true, "type": "text"}
    ]}',
    TRUE
);


-- ── 3. FESTIVAL CALENDAR (Global Awareness Days) ─────────────────

INSERT INTO festival_calendar (
    org_id, name, description, event_date, is_recurring_annual,
    category, hashtags, content_ideas, platforms
) VALUES
-- International Days (Fixed dates)
(NULL, 'World Menstrual Hygiene Day', 'Annual awareness day on May 28 to break taboos around menstruation', '2025-05-28', TRUE,
 'menstrual_hygiene',
 ARRAY['#MenstrualHygieneDay', '#MHDay2025', '#BreakTheTaboo', '#MenstrualHealth', '#PeriodPoverty', '#WASH'],
 ARRAY['Share statistics about period poverty in India', 'Feature a beneficiary story', 'Educate about reusable menstrual products', 'Challenge a common myth about menstruation', 'Showcase your field work on this day'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'World Water Day', 'Annual UN observance on March 22 focusing on the importance of freshwater', '2025-03-22', TRUE,
 'water_sanitation',
 ARRAY['#WorldWaterDay', '#WaterDay2025', '#CleanWater', '#WASH', '#WaterForAll', '#SDG6'],
 ARRAY['Share data on water access in rural India', 'Connect water access to menstrual hygiene management', 'Feature a water point installation story', 'Campaign for community water infrastructure'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'World Toilet Day', 'Annual UN observance on November 19 addressing global sanitation crisis', '2025-11-19', TRUE,
 'water_sanitation',
 ARRAY['#WorldToiletDay', '#ToiletDay2025', '#Sanitation', '#EndOpenDefecation', '#WASH', '#SafeSanitation'],
 ARRAY['Share open defecation statistics', 'Feature toilet construction impact', 'School sanitation spotlight', 'Dignity and safety angle', 'Menstrual hygiene facilities in schools'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'International Day of the Girl Child', 'Annual UN observance on October 11 empowering girls worldwide', '2025-10-11', TRUE,
 'women_empowerment',
 ARRAY['#DayOfTheGirl', '#GirlChild', '#GirlPower', '#EducateGirls', '#EmpowerGirls', '#ForEveryGirl'],
 ARRAY['Connect menstrual health to girls education', 'Feature a girl who stayed in school because of MHM support', 'Share school dropout statistics linked to period poverty', 'Campaign for girls education'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'International Womens Day', 'Annual observance on March 8 celebrating women achievement and advocating for gender equality', '2025-03-08', TRUE,
 'women_empowerment',
 ARRAY['#InternationalWomensDay', '#IWD2025', '#WomensDay', '#ForWomen', '#GenderEquality', '#EachforEqual'],
 ARRAY['Showcase women leaders in your organization', 'Feature beneficiary transformation story', 'Campaign connecting women health to empowerment', 'CSR partner spotlight for women welfare'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'Global Handwashing Day', 'Annual observance on October 15 promoting handwashing with soap', '2025-10-15', TRUE,
 'health',
 ARRAY['#GlobalHandwashingDay', '#HandwashingDay', '#WASH', '#Hygiene', '#HandwashForAll'],
 ARRAY['Demonstrate proper handwashing technique', 'Share disease prevention statistics', 'School handwashing programme impact', 'COVID hygiene continued importance'],
 ARRAY['instagram', 'twitter']),

(NULL, 'World Health Day', 'Annual WHO observance on April 7 addressing global health challenges', '2025-04-07', TRUE,
 'health',
 ARRAY['#WorldHealthDay', '#HealthDay2025', '#HealthForAll', '#PublicHealth', '#WHO'],
 ARRAY['Connect sanitation to health outcomes', 'Share impact data on disease prevention', 'Advocate for universal healthcare', 'Feature community health workers'],
 ARRAY['linkedin', 'instagram', 'twitter']),

-- India-Specific Days
(NULL, 'National Hygiene Day India', 'India National Hygiene Day observed on September 10', '2025-09-10', TRUE,
 'national_india',
 ARRAY['#NationalHygieneDay', '#HygieneIndia', '#SwachhIndia', '#Swachh', '#CleanIndia'],
 ARRAY['Showcase Swachh Bharat Mission alignment', 'India-specific hygiene statistics', 'Rural vs urban hygiene access', 'Government partnership work'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'Swachh Bharat Mission Anniversary', 'Anniversary of Swachh Bharat Mission launch on October 2 (Gandhi Jayanti)', '2025-10-02', TRUE,
 'national_india',
 ARRAY['#SwachhBharat', '#SwachhBharatMission', '#GandhiJayanti', '#CleanIndia', '#ODF'],
 ARRAY['Mission alignment and contribution', 'Village-level open defecation free achievements', 'Sanitation coverage improvement data', 'Future goals and commitment'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'Republic Day India', 'Indian Republic Day on January 26', '2025-01-26', TRUE,
 'national_india',
 ARRAY['#RepublicDay', '#RepublicDay2025', '#JaiHind', '#India'],
 ARRAY['Commitment to social development goals', 'Right to sanitation as a constitutional right', 'Patriotic content connecting hygiene to national progress'],
 ARRAY['linkedin', 'instagram', 'twitter']),

(NULL, 'Independence Day India', 'Indian Independence Day on August 15', '2025-08-15', TRUE,
 'national_india',
 ARRAY['#IndependenceDay', '#IndependenceDay2025', '#JaiHind', '#AzadiKaAmritMahotsav'],
 ARRAY['Freedom from sanitation challenges', 'Connecting independence to dignity and hygiene rights', 'Progress since independence in sanitation coverage'],
 ARRAY['linkedin', 'instagram', 'twitter']),

-- CSR-Specific Days
(NULL, 'Corporate Social Responsibility Day', 'International CSR Day observed on third Thursday of October', '2025-10-16', TRUE,
 'csr',
 ARRAY['#CSRDay', '#CorporateSocialResponsibility', '#CSR', '#SocialImpact', '#Sustainability'],
 ARRAY['CSR impact report highlights', 'Corporate partner appreciation post', 'Call for new CSR partnerships', 'ESG and social impact metrics'],
 ARRAY['linkedin']),

(NULL, 'World Environment Day', 'Annual UN observance on June 5 for environmental action', '2025-06-05', TRUE,
 'environmental',
 ARRAY['#WorldEnvironmentDay', '#ForNature', '#GenerationRestoration', '#EnvironmentDay'],
 ARRAY['Connect sanitation waste management to environment', 'Sustainable menstrual product advocacy', 'Water conservation and sanitation link'],
 ARRAY['linkedin', 'instagram', 'twitter']);


-- ── 4. SYSTEM-LEVEL HASHTAG SETS ─────────────────────────────────
-- Note: These are org_id=NULL system templates.
-- Org-specific hashtag sets are created by users.
-- The hashtag_sets table requires org_id, so these are seeded
-- via a special system org or noted in application logic.
-- In production, these are surfaced as suggestions, not DB rows.
-- ─────────────────────────────────────────────────────────────────

-- ── 5. DEFAULT SUBSCRIPTION PLANS ALREADY INSERTED ABOVE ─────────

-- ── VERIFY SEED DATA ─────────────────────────────────────────────
DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM subscription_plans) = 4,
        'Expected 4 subscription plans';
    ASSERT (SELECT COUNT(*) FROM content_templates WHERE org_id IS NULL) = 6,
        'Expected 6 system content templates';
    ASSERT (SELECT COUNT(*) FROM festival_calendar WHERE org_id IS NULL) >= 13,
        'Expected at least 13 global festival calendar entries';
    RAISE NOTICE 'Seed data verification passed.';
END $$;
```

---

*End of DATABASE_SCHEMA.md*
