-- ============================================================
-- Brandora AI — Supabase Schema (matches ORM models exactly)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- This DROPS and RECREATES all tables cleanly.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS hashtag_sets            CASCADE;
DROP TABLE IF EXISTS social_accounts         CASCADE;
DROP TABLE IF EXISTS campaign_posts          CASCADE;
DROP TABLE IF EXISTS content_generations     CASCADE;
DROP TABLE IF EXISTS campaigns               CASCADE;
DROP TABLE IF EXISTS brand_profiles          CASCADE;
DROP TABLE IF EXISTS festivals               CASCADE;
DROP TABLE IF EXISTS festival_calendar       CASCADE;
DROP TABLE IF EXISTS user_organization_memberships CASCADE;
DROP TABLE IF EXISTS organizations           CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;
DROP TABLE IF EXISTS subscription_plans      CASCADE;
DROP TABLE IF EXISTS content_templates       CASCADE;
DROP TABLE IF EXISTS ai_usage_logs           CASCADE;
DROP TABLE IF EXISTS alembic_version         CASCADE;

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(1024),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- ── organizations ─────────────────────────────────────────────────────────────
CREATE TABLE organizations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(255) NOT NULL,
    slug                 VARCHAR(100) NOT NULL UNIQUE,
    logo_url             VARCHAR(1024),
    website              VARCHAR(512),
    sector               VARCHAR(50)  NOT NULL DEFAULT 'other',
    subscription_tier    VARCHAR(20)  NOT NULL DEFAULT 'free',
    ai_generations_used  INTEGER      NOT NULL DEFAULT 0,
    ai_generations_limit INTEGER      NOT NULL DEFAULT 20,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);

-- ── user_organization_memberships ─────────────────────────────────────────────
CREATE TABLE user_organization_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role            VARCHAR(50)  NOT NULL DEFAULT 'admin',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    joined_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);
CREATE INDEX idx_memberships_user ON user_organization_memberships(user_id);
CREATE INDEX idx_memberships_org  ON user_organization_memberships(organization_id);

-- ── brand_profiles ────────────────────────────────────────────────────────────
CREATE TABLE brand_profiles (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    organization_name  VARCHAR(255) NOT NULL,
    tagline            VARCHAR(512),
    mission_statement  TEXT,
    about              TEXT,
    sector_focus       JSONB NOT NULL DEFAULT '[]',
    target_audience    VARCHAR(512),
    geographic_focus   VARCHAR(255),
    sdg_alignment      JSONB NOT NULL DEFAULT '[]',
    tone_professional  INTEGER NOT NULL DEFAULT 7,
    tone_warm          INTEGER NOT NULL DEFAULT 7,
    tone_inspirational INTEGER NOT NULL DEFAULT 6,
    tone_educational   INTEGER NOT NULL DEFAULT 7,
    tone_urgent        INTEGER NOT NULL DEFAULT 4,
    founder_name       VARCHAR(255),
    founder_title      VARCHAR(255),
    founder_bio        TEXT,
    custom_vocabulary  JSONB NOT NULL DEFAULT '[]',
    avoid_words        JSONB NOT NULL DEFAULT '[]',
    sample_posts       JSONB NOT NULL DEFAULT '[]',
    linkedin_handle    VARCHAR(100),
    instagram_handle   VARCHAR(100),
    twitter_handle     VARCHAR(100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_brand_profiles_org ON brand_profiles(organization_id);

-- ── festivals ─────────────────────────────────────────────────────────────────
CREATE TABLE festivals (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    date               DATE         NOT NULL,
    category           VARCHAR(50)  NOT NULL DEFAULT 'awareness_day',
    relevant_sectors   JSONB NOT NULL DEFAULT '[]',
    suggested_hashtags JSONB NOT NULL DEFAULT '[]',
    country            VARCHAR(50)  NOT NULL DEFAULT 'IN',
    is_recurring       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_festivals_date ON festivals(date);

-- ── campaigns ─────────────────────────────────────────────────────────────────
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    campaign_type   VARCHAR(50)  NOT NULL DEFAULT 'awareness',
    status          VARCHAR(20)  NOT NULL DEFAULT 'draft',
    start_date      DATE,
    end_date        DATE,
    platforms       JSONB NOT NULL DEFAULT '[]',
    target_hashtags JSONB NOT NULL DEFAULT '[]',
    brief           TEXT,
    festival_id     UUID REFERENCES festivals(id) ON DELETE SET NULL,
    total_posts     INTEGER NOT NULL DEFAULT 0,
    published_posts INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);

-- ── content_generations ───────────────────────────────────────────────────────
CREATE TABLE content_generations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
    input_topic          VARCHAR(500) NOT NULL,
    input_context        TEXT,
    campaign_brief       TEXT,
    platform             VARCHAR(50)  NOT NULL,
    tone                 VARCHAR(50)  NOT NULL DEFAULT 'professional',
    generated_content    TEXT         NOT NULL,
    hashtags             JSONB NOT NULL DEFAULT '[]',
    quality_score        FLOAT,
    ai_model_used        VARCHAR(100) NOT NULL,
    tokens_used          INTEGER      NOT NULL DEFAULT 0,
    is_saved             BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted           BOOLEAN      NOT NULL DEFAULT FALSE,
    is_repurposed        BOOLEAN      NOT NULL DEFAULT FALSE,
    parent_generation_id UUID REFERENCES content_generations(id) ON DELETE SET NULL,
    feedback             VARCHAR(20),
    campaign_id          UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    language             VARCHAR(10)  NOT NULL DEFAULT 'en',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_content_org      ON content_generations(organization_id);
CREATE INDEX idx_content_user     ON content_generations(user_id);
CREATE INDEX idx_content_campaign ON content_generations(campaign_id);
CREATE INDEX idx_content_platform ON content_generations(platform);
CREATE INDEX idx_content_saved    ON content_generations(is_saved);

-- ── campaign_posts ────────────────────────────────────────────────────────────
CREATE TABLE campaign_posts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id           UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    content_generation_id UUID REFERENCES content_generations(id) ON DELETE SET NULL,
    platform              VARCHAR(50) NOT NULL,
    content               TEXT        NOT NULL,
    hashtags              JSONB NOT NULL DEFAULT '[]',
    media_urls            JSONB NOT NULL DEFAULT '[]',
    scheduled_at          TIMESTAMPTZ,
    published_at          TIMESTAMPTZ,
    status                VARCHAR(20) NOT NULL DEFAULT 'draft',
    sequence_order        INTEGER     NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaign_posts_campaign ON campaign_posts(campaign_id);

-- ── social_accounts ───────────────────────────────────────────────────────────
CREATE TABLE social_accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform         VARCHAR(30)  NOT NULL,
    account_id       VARCHAR(255) NOT NULL,
    account_name     VARCHAR(255),
    access_token     TEXT,
    refresh_token    TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_social_accounts_org ON social_accounts(organization_id);

-- ── hashtag_sets ──────────────────────────────────────────────────────────────
CREATE TABLE hashtag_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    platform        VARCHAR(50),
    hashtags        JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hashtag_sets_org ON hashtag_sets(organization_id);

-- ── alembic_version ───────────────────────────────────────────────────────────
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT INTO alembic_version (version_num) VALUES ('001');

-- api_keys
CREATE TABLE IF NOT EXISTS api_keys (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    key_hash         VARCHAR(64) NOT NULL,
    key_preview      VARCHAR(20) NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);

-- ── Seed data: Festivals & Awareness Days ─────────────────────────────────────
INSERT INTO festivals (name, date, category, relevant_sectors, suggested_hashtags, country) VALUES
('Menstrual Hygiene Day',         '2026-05-28', 'awareness_day', '["menstrual_hygiene","wash"]',            '["#MHDay2026","#MenstrualHygieneDay","#PeriodPositive","#BreakTheTaboo"]', 'IN'),
('World Environment Day',         '2026-06-05', 'un_day',        '["wash","sanitation","csr"]',             '["#WorldEnvironmentDay","#ForNature","#Sustainability"]',                  'IN'),
('World Toilet Day',              '2026-11-19', 'un_day',        '["sanitation","wash"]',                   '["#WorldToiletDay","#Sanitation","#WASH","#SDG6"]',                         'IN'),
('International Women''s Day',    '2026-03-08', 'un_day',        '["menstrual_hygiene","csr"]',             '["#IWD2026","#BreakTheBias","#WomenEmpowerment"]',                          'IN'),
('Swachh Bharat Mission Day',     '2026-10-02', 'national_day',  '["sanitation","wash"]',                   '["#SwachhBharat","#CleanIndia","#ODF"]',                                    'IN'),
('Global Handwashing Day',        '2026-10-15', 'un_day',        '["wash","sanitation"]',                   '["#GlobalHandwashingDay","#HandHygiene","#WASH"]',                          'IN'),
('World Water Day',               '2026-03-22', 'un_day',        '["wash","sanitation"]',                   '["#WorldWaterDay","#WaterForAll","#SDG6","#CleanWater"]',                   'IN'),
('International Day of the Girl', '2026-10-11', 'un_day',        '["menstrual_hygiene","csr"]',             '["#DayOfTheGirl","#GirlPower","#EqualRights"]',                             'IN'),
('World Health Day',              '2026-04-07', 'un_day',        '["wash","sanitation","menstrual_hygiene"]','["#WorldHealthDay","#HealthForAll","#WHO"]',                               'IN'),
('CSR Day India',                 '2026-02-14', 'national_day',  '["csr"]',                                 '["#CSRDay","#CorporateResponsibility","#SocialImpact"]',                    'IN');

-- ── Composite performance indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_content_gen_org_created ON content_generations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_gen_org_saved ON content_generations(organization_id, is_saved) WHERE is_saved = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status ON campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_posts_time ON campaign_posts(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';
