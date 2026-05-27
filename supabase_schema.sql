-- ============================================================
-- Brandora AI — Complete Database Schema
-- Run this ONCE in Supabase → SQL Editor → New Query
-- ============================================================
-- Instructions:
--   1. Open your Supabase project
--   2. Click "SQL Editor" in left sidebar
--   3. Click "New query"
--   4. Paste this entire file
--   5. Click "Run" (or Ctrl+Enter)
-- ============================================================

-- ── Extensions (already enabled in Supabase, but safe to run) ─
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE subscriptiontier AS ENUM ('free', 'pro', 'growth', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE userrole AS ENUM ('owner', 'admin', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platformenum AS ENUM ('linkedin', 'instagram', 'twitter', 'facebook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contentstatus AS ENUM (
    'draft', 'pending', 'approved', 'scheduled',
    'published', 'failed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Groq is PRIMARY (free), others are fallbacks
DO $$ BEGIN
  CREATE TYPE aiproviderenum AS ENUM ('groq', 'google', 'openai', 'anthropic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── users ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL,
  hashed_password VARCHAR(255),              -- nullable: OAuth users have no password
  full_name       VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_superuser    BOOLEAN NOT NULL DEFAULT FALSE,
  supabase_uid    VARCHAR(255),              -- links to Supabase Auth user
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email        ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_supabase_uid ON users(supabase_uid) WHERE supabase_uid IS NOT NULL;


-- ── subscription_plans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL,
  tier                  subscriptiontier NOT NULL,
  price_monthly_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ai_generations_limit  INTEGER NOT NULL,   -- -1 = unlimited
  max_users             INTEGER NOT NULL,   -- -1 = unlimited
  max_brands            INTEGER NOT NULL,   -- -1 = unlimited
  features              JSONB NOT NULL DEFAULT '[]',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_subscription_plans_tier ON subscription_plans(tier);


-- ── organizations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                            VARCHAR(255) NOT NULL,
  slug                            VARCHAR(100) NOT NULL,
  logo_url                        TEXT,
  website                         VARCHAR(500),
  description                     TEXT,
  country                         VARCHAR(100),
  industry                        VARCHAR(100),  -- ngo|csr|government|social_enterprise
  subscription_plan_id            UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  subscription_expires_at         TIMESTAMPTZ,
  ai_generations_used_this_month  INTEGER NOT NULL DEFAULT 0,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_organizations_slug ON organizations(slug);


-- ── user_organization_memberships ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_organization_memberships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role                userrole NOT NULL DEFAULT 'editor',
  invited_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_user_organization UNIQUE (user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS ix_uom_user_id ON user_organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS ix_uom_org_id  ON user_organization_memberships(organization_id);


-- ── brand_profiles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  tagline             VARCHAR(500),
  logo_url            TEXT,
  primary_color       VARCHAR(7),   -- e.g. #3B82F6
  secondary_color     VARCHAR(7),
  brand_voice         TEXT,
  target_audience     TEXT,
  mission_statement   TEXT,
  sdg_focus           JSONB,        -- list of SDG numbers
  default_hashtags    JSONB,
  platforms_connected JSONB,        -- {platform: oauth_meta}
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_brand_profiles_org_id ON brand_profiles(organization_id);


-- ── campaigns ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_profile_id    UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  created_by_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  objective           VARCHAR(255),
  start_date          DATE,
  end_date            DATE,
  status              VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft|active|paused|completed|archived
  target_platforms    JSONB,
  tags                JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_campaigns_org_id   ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS ix_campaigns_brand_id ON campaigns(brand_profile_id);
CREATE INDEX IF NOT EXISTS ix_campaigns_status   ON campaigns(status);


-- ── festival_calendar ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festival_calendar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  date_month       SMALLINT NOT NULL,
  date_day         SMALLINT NOT NULL,
  description      TEXT,
  category         VARCHAR(100),  -- menstrual_health|sanitation|hygiene|health|gender_equality|etc
  sdg_tags         JSONB,
  default_hashtags JSONB,
  is_global        BOOLEAN NOT NULL DEFAULT TRUE,
  is_india_specific BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_festival_calendar_month_day ON festival_calendar(date_month, date_day);
CREATE INDEX IF NOT EXISTS ix_festival_calendar_category  ON festival_calendar(category);


-- ── content_templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = system template
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  platform        platformenum NOT NULL,
  category        VARCHAR(100),
  template_content TEXT NOT NULL,    -- text with {{variable}} placeholders
  variables       JSONB,             -- list of required variable names
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_content_templates_platform  ON content_templates(platform);
CREATE INDEX IF NOT EXISTS ix_content_templates_is_system ON content_templates(is_system);


-- ── content_generations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_generations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_profile_id    UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  created_by_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  festival_id         UUID REFERENCES festival_calendar(id) ON DELETE SET NULL,
  template_id         UUID REFERENCES content_templates(id) ON DELETE SET NULL,
  platform            platformenum NOT NULL,
  prompt_used         TEXT,
  generated_content   TEXT NOT NULL,
  edited_content      TEXT,          -- user-edited version before publishing
  ai_provider         aiproviderenum NOT NULL,
  ai_model            VARCHAR(100),
  tokens_used         INTEGER,
  generation_time_ms  INTEGER,
  status              contentstatus NOT NULL DEFAULT 'draft',
  feedback_score      SMALLINT,      -- 1-5 rating
  feedback_note       TEXT,
  language            VARCHAR(10) NOT NULL DEFAULT 'en',
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_content_gen_org_id     ON content_generations(organization_id);
CREATE INDEX IF NOT EXISTS ix_content_gen_created_by ON content_generations(created_by_user_id);
CREATE INDEX IF NOT EXISTS ix_content_gen_campaign   ON content_generations(campaign_id);
CREATE INDEX IF NOT EXISTS ix_content_gen_status     ON content_generations(status);
CREATE INDEX IF NOT EXISTS ix_content_gen_platform   ON content_generations(platform);
CREATE INDEX IF NOT EXISTS ix_content_gen_created_at ON content_generations(created_at);


-- ── campaign_posts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_generation_id UUID NOT NULL REFERENCES content_generations(id) ON DELETE CASCADE,
  platform              platformenum NOT NULL,
  status                contentstatus NOT NULL DEFAULT 'draft',
  scheduled_at          TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  platform_post_id      VARCHAR(255),  -- ID returned by social platform after publish
  platform_post_url     TEXT,
  publish_error         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_campaign_posts_campaign_id  ON campaign_posts(campaign_id);
CREATE INDEX IF NOT EXISTS ix_campaign_posts_scheduled_at ON campaign_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS ix_campaign_posts_status       ON campaign_posts(status);


-- ── ai_usage_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_generation_id UUID REFERENCES content_generations(id) ON DELETE SET NULL,
  ai_provider           aiproviderenum NOT NULL,
  ai_model              VARCHAR(100) NOT NULL,
  operation_type        VARCHAR(100) NOT NULL,  -- generate_post|improve_content|translate|summarize
  prompt_tokens         INTEGER,
  completion_tokens     INTEGER,
  total_tokens          INTEGER,
  cost_usd              NUMERIC(10,6),
  latency_ms            INTEGER,
  success               BOOLEAN NOT NULL DEFAULT TRUE,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_org_id     ON ai_usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_user_id    ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_provider   ON ai_usage_logs(ai_provider);


-- ── alembic_version (marks migration as done) ──────────────────
CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL,
  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
INSERT INTO alembic_version (version_num) VALUES ('001') ON CONFLICT DO NOTHING;


-- ============================================================
-- SEED DATA
-- ============================================================

-- ── Subscription Plans ─────────────────────────────────────────
INSERT INTO subscription_plans (id, name, tier, price_monthly_usd, ai_generations_limit, max_users, max_brands, features)
VALUES
  (gen_random_uuid(), 'Starter',    'free',       0,   20,   1,  1,
   '["linkedin","instagram","twitter","basic_templates"]'),
  (gen_random_uuid(), 'Pro',        'pro',        29,  150,  2,  1,
   '["all_platforms","scheduling","calendar","basic_analytics","5_templates"]'),
  (gen_random_uuid(), 'Growth',     'growth',     79,  500,  5,  3,
   '["all_platforms","scheduling","calendar","advanced_analytics","campaign_management","multi_language","brand_voice","csr_stories","20_templates"]'),
  (gen_random_uuid(), 'Enterprise', 'enterprise', 299, -1,  -1, -1,
   '["all_features","white_label","api_access","custom_templates","dedicated_support"]')
ON CONFLICT DO NOTHING;


-- ── Festival / Awareness Day Calendar ──────────────────────────
INSERT INTO festival_calendar (id, name, date_month, date_day, description, category, sdg_tags, default_hashtags, is_global, is_india_specific)
VALUES
  (gen_random_uuid(), 'World Menstrual Hygiene Day', 5, 28,
   'Global day to raise awareness about good menstrual hygiene management',
   'menstrual_health', '[3,5,6]',
   '["#MenstrualHygieneDay","#MHDay","#PeriodPositive","#MenstrualHealth","#BreakTheTaboo"]',
   true, false),
  (gen_random_uuid(), 'World Toilet Day', 11, 19,
   'Inspiring action to tackle the global sanitation crisis',
   'sanitation', '[6,3,11]',
   '["#WorldToiletDay","#Sanitation4All","#WASH","#ToiletDay","#CleanSanitation"]',
   true, false),
  (gen_random_uuid(), 'World Water Day', 3, 22,
   'Advocating for the sustainable management of freshwater resources',
   'water_sanitation', '[6]',
   '["#WorldWaterDay","#Water4All","#WaterSecurity","#CleanWater","#WASH"]',
   true, false),
  (gen_random_uuid(), 'Global Handwashing Day', 10, 15,
   'Dedicated to increasing awareness of handwashing with soap',
   'hygiene', '[3,6]',
   '["#GlobalHandwashingDay","#HandwashingDay","#CleanHands","#HygieneMatters","#WashYourHands"]',
   true, false),
  (gen_random_uuid(), 'International Women''s Day', 3, 8,
   'Celebrating women''s achievements and advocating for gender equality',
   'gender_equality', '[5,3,6]',
   '["#IWD2026","#InternationalWomensDay","#GenderEquality","#EachForEqual","#WomensRights"]',
   true, false),
  (gen_random_uuid(), 'World Environment Day', 6, 5,
   'Principal vehicle for encouraging awareness and action for the protection of the environment',
   'environment', '[13,6,12]',
   '["#WorldEnvironmentDay","#ForNature","#GenerationRestoration","#EcoFriendly","#Sustainability"]',
   true, false),
  (gen_random_uuid(), 'World Health Day', 4, 7,
   'Draw attention to important health issues affecting people of all ages',
   'health', '[3]',
   '["#WorldHealthDay","#HealthForAll","#GlobalHealth","#WHO","#HealthMatters"]',
   true, false),
  (gen_random_uuid(), 'Gandhi Jayanti / Swachh Bharat', 10, 2,
   'Birthday of Mahatma Gandhi and Swachh Bharat Mission anniversary',
   'sanitation', '[6,11]',
   '["#SwachhBharat","#GandhiJayanti","#CleanIndia","#SwachhBharatMission"]',
   false, true),
  (gen_random_uuid(), 'Swachh Bharat Diwas', 9, 19,
   'Swachh Bharat Mission launch anniversary',
   'sanitation', '[6]',
   '["#SwachhBharatDiwas","#SwachhBharat","#CleanIndia","#ODF","#SanitationForAll"]',
   false, true),
  (gen_random_uuid(), 'World Population Day', 7, 11,
   'Focus attention on the urgency and importance of population issues',
   'health', '[3,5,6]',
   '["#WorldPopulationDay","#PopulationDay","#UNFPA","#HealthForAll"]',
   true, false),
  (gen_random_uuid(), 'International Day of Rural Women', 10, 15,
   'Recognizing the critical role women play in enhancing rural development',
   'gender_equality', '[5,6,2]',
   '["#RuralWomen","#RuralWomensDay","#WomenInAgriculture","#EmpowerWomen"]',
   true, false),
  (gen_random_uuid(), 'World Humanitarian Day', 8, 19,
   'Honour humanitarian workers and advocate for humanitarian action',
   'inclusion', '[3,6,17]',
   '["#WorldHumanitarianDay","#HumanitarianHeroes","#ForHumanity","#RealLifeHeroes"]',
   true, false)
ON CONFLICT DO NOTHING;


-- ── Default Content Templates ──────────────────────────────────
INSERT INTO content_templates (id, name, description, platform, category, template_content, variables, is_system)
VALUES
  (
    gen_random_uuid(),
    'MHD Impact Post',
    'World Menstrual Hygiene Day awareness LinkedIn post',
    'linkedin', 'awareness',
    E'On #WorldMenstrualHygieneDay, we reflect on our journey to ensure every girl and woman has access to safe, dignified menstrual health management.\n\n{{impact_stat}} girls/women reached. {{locations}} communities transformed.\n\nBut numbers only tell part of the story. The real change is in {{qualitative_outcome}}.\n\n{{call_to_action}}\n\n#MHDay #MenstrualHealth #SocialImpact #SDG5 #SDG6',
    '["impact_stat","locations","qualitative_outcome","call_to_action"]',
    true
  ),
  (
    gen_random_uuid(),
    'CSR Impact Report Post',
    'Quarterly CSR impact update for LinkedIn',
    'linkedin', 'csr',
    E'Q{{quarter}} {{year}} Impact Update\n\nWe''re proud to share the progress of our {{program_name}} initiative:\n\n✅ {{metric_1}}\n✅ {{metric_2}}\n✅ {{metric_3}}\n\nThis work aligns with SDG {{sdg_number}}: {{sdg_name}}\n\nThank you to our partners and the communities we serve for making this possible.\n\n#CSR #SocialImpact #Sustainability #{{company_hashtag}}',
    '["quarter","year","program_name","metric_1","metric_2","metric_3","sdg_number","sdg_name","company_hashtag"]',
    true
  ),
  (
    gen_random_uuid(),
    'World Toilet Day Community Story',
    'Instagram post for World Toilet Day with community story',
    'instagram', 'awareness',
    E'#WorldToiletDay\n\nEvery person deserves a safe, clean toilet. Yet 3.5 billion people still lack safely managed sanitation.\n\n{{community_story}}\n\nThat''s why we''ve built {{facilities_count}} toilets in {{location}}, reaching {{beneficiaries}} people.\n\nSanitation is a human right.\n\n#Sanitation4All #WASH #SDG6 #CleanSanitation #ToiletDay',
    '["community_story","facilities_count","location","beneficiaries"]',
    true
  ),
  (
    gen_random_uuid(),
    'IWD Gender & WASH Post',
    'International Women''s Day post connecting gender equality and WASH access',
    'linkedin', 'awareness',
    E'On #InternationalWomensDay, let''s talk about a connection that''s often overlooked:\n\nWhen women and girls lack access to safe sanitation and menstrual hygiene facilities, their safety, dignity, and economic participation are all at risk.\n\n{{data_point}}\n\nOur work in {{geography}} is changing this — {{program_description}}\n\nGender equality starts with the basics. #IWD2026 #GenderEquality #WASH #SDG5 #SDG6',
    '["data_point","geography","program_description"]',
    true
  ),
  (
    gen_random_uuid(),
    'Swachh Bharat Anniversary Post',
    'Gandhi Jayanti / Swachh Bharat Mission anniversary post (India-specific)',
    'linkedin', 'csr',
    E'Today, on Gandhi Jayanti, we celebrate the spirit of Swachh Bharat — a cleaner, healthier India.\n\nSince joining the #SwachhBharat mission, {{organization_name}} has:\n🚽 Built {{toilet_count}} community and household toilets\n👩‍👧 Trained {{trained_count}} women as WASH champions\n🏫 Covered {{school_count}} schools with menstrual hygiene education\n\n{{personal_message}}\n\nJai Hind. #GandhiJayanti #CleanIndia #SwachhBharatMission #ODF #SanitationForAll',
    '["organization_name","toilet_count","trained_count","school_count","personal_message"]',
    true
  )
ON CONFLICT DO NOTHING;
