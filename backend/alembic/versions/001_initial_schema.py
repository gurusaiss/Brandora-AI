"""Initial schema — all core tables

Regenerated to match the current SQLAlchemy ORM models in app/schemas/*.
Columns use plain VARCHAR/TEXT (not Postgres ENUMs) to mirror the models
exactly, so a fresh database built from this migration matches what the
application code queries.

Revision ID: 001
Revises: None
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op

# ---------------------------------------------------------------------------
revision = "001"
down_revision = None
branch_labels = None
depends_on = None
# ---------------------------------------------------------------------------

# Tables in dependency-safe creation order. The DDL below is generated from
# Base.metadata (SQLAlchemy postgresql dialect) and mirrors the ORM 1:1.
CREATE_TABLES = [
    # users ------------------------------------------------------------------
    """
    CREATE TABLE users (
        id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(1024),
        is_active BOOLEAN NOT NULL,
        is_verified BOOLEAN NOT NULL,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id)
    )
    """,
    # organizations ----------------------------------------------------------
    """
    CREATE TABLE organizations (
        id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        logo_url VARCHAR(1024),
        website VARCHAR(512),
        sector VARCHAR(50) NOT NULL,
        subscription_tier VARCHAR(20) NOT NULL,
        ai_generations_used INTEGER NOT NULL,
        ai_generations_limit INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id)
    )
    """,
    # festivals --------------------------------------------------------------
    """
    CREATE TABLE festivals (
        id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        category VARCHAR(50) NOT NULL,
        relevant_sectors JSON,
        suggested_hashtags JSON,
        country VARCHAR(50) NOT NULL,
        is_recurring BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id)
    )
    """,
    # user_organization_memberships -----------------------------------------
    """
    CREATE TABLE user_organization_memberships (
        id UUID NOT NULL,
        user_id UUID NOT NULL,
        organization_id UUID NOT NULL,
        role VARCHAR(50) NOT NULL,
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    )
    """,
    # brand_profiles ---------------------------------------------------------
    """
    CREATE TABLE brand_profiles (
        id UUID NOT NULL,
        organization_id UUID NOT NULL,
        organization_name VARCHAR(255) NOT NULL,
        tagline VARCHAR(512),
        mission_statement TEXT,
        about TEXT,
        sector_focus JSON,
        target_audience VARCHAR(512),
        geographic_focus VARCHAR(255),
        sdg_alignment JSON,
        tone_professional INTEGER NOT NULL,
        tone_warm INTEGER NOT NULL,
        tone_inspirational INTEGER NOT NULL,
        tone_educational INTEGER NOT NULL,
        tone_urgent INTEGER NOT NULL,
        founder_name VARCHAR(255),
        founder_title VARCHAR(255),
        founder_bio TEXT,
        custom_vocabulary JSON,
        avoid_words JSON,
        sample_posts JSON,
        linkedin_handle VARCHAR(100),
        instagram_handle VARCHAR(100),
        twitter_handle VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    )
    """,
    # social_accounts --------------------------------------------------------
    """
    CREATE TABLE social_accounts (
        id UUID NOT NULL,
        organization_id UUID NOT NULL,
        platform VARCHAR(30) NOT NULL,
        account_id VARCHAR(255) NOT NULL,
        account_name VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    )
    """,
    # campaigns --------------------------------------------------------------
    """
    CREATE TABLE campaigns (
        id UUID NOT NULL,
        organization_id UUID NOT NULL,
        user_id UUID,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        campaign_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        start_date DATE,
        end_date DATE,
        platforms JSON,
        target_hashtags JSON,
        brief TEXT,
        festival_id UUID,
        total_posts INTEGER NOT NULL,
        published_posts INTEGER NOT NULL,
        topic TEXT,
        social_account_id UUID,
        frequency VARCHAR(20) NOT NULL,
        post_time VARCHAR(5) NOT NULL,
        post_days JSON,
        is_scheduled BOOLEAN NOT NULL,
        last_run_at TIMESTAMP WITH TIME ZONE,
        next_run_at TIMESTAMP WITH TIME ZONE,
        image_url TEXT,
        campaign_goal TEXT,
        target_audience TEXT,
        tone VARCHAR(50) NOT NULL,
        keywords JSON,
        cta TEXT,
        generate_images BOOLEAN NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY(festival_id) REFERENCES festivals (id) ON DELETE SET NULL,
        FOREIGN KEY(social_account_id) REFERENCES social_accounts (id) ON DELETE SET NULL
    )
    """,
    # content_generations ----------------------------------------------------
    """
    CREATE TABLE content_generations (
        id UUID NOT NULL,
        organization_id UUID NOT NULL,
        user_id UUID,
        input_topic VARCHAR(500) NOT NULL,
        input_context TEXT,
        campaign_brief TEXT,
        platform VARCHAR(50) NOT NULL,
        tone VARCHAR(50) NOT NULL,
        generated_content TEXT NOT NULL,
        hashtags JSON,
        quality_score FLOAT,
        ai_model_used VARCHAR(100) NOT NULL,
        tokens_used INTEGER NOT NULL,
        is_saved BOOLEAN NOT NULL,
        is_deleted BOOLEAN NOT NULL,
        is_repurposed BOOLEAN NOT NULL,
        parent_generation_id UUID,
        feedback VARCHAR(20),
        campaign_id UUID,
        language VARCHAR(10) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL,
        FOREIGN KEY(parent_generation_id) REFERENCES content_generations (id) ON DELETE SET NULL,
        FOREIGN KEY(campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL
    )
    """,
    # campaign_posts ---------------------------------------------------------
    """
    CREATE TABLE campaign_posts (
        id UUID NOT NULL,
        campaign_id UUID NOT NULL,
        content_generation_id UUID,
        platform VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        hashtags JSON,
        media_urls JSON,
        image_url TEXT,
        scheduled_at TIMESTAMP WITH TIME ZONE,
        published_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) NOT NULL,
        sequence_order INTEGER NOT NULL,
        retry_count INTEGER NOT NULL,
        max_retries INTEGER NOT NULL,
        failure_reason TEXT,
        platform_post_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        FOREIGN KEY(content_generation_id) REFERENCES content_generations (id) ON DELETE SET NULL
    )
    """,
    # campaign_images --------------------------------------------------------
    """
    CREATE TABLE campaign_images (
        id UUID NOT NULL,
        campaign_id UUID NOT NULL,
        post_id UUID,
        image_url TEXT NOT NULL,
        storage_path TEXT,
        prompt_used TEXT,
        model_used VARCHAR(100) NOT NULL,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        FOREIGN KEY(post_id) REFERENCES campaign_posts (id) ON DELETE SET NULL
    )
    """,
    # hashtag_sets -----------------------------------------------------------
    """
    CREATE TABLE hashtag_sets (
        id UUID NOT NULL,
        organization_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        platform VARCHAR(50),
        hashtags JSON NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    )
    """,
    # api_keys ---------------------------------------------------------------
    """
    CREATE TABLE api_keys (
        id UUID NOT NULL,
        organization_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        key_preview VARCHAR(20) NOT NULL,
        is_active BOOLEAN NOT NULL,
        last_used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    )
    """,
]

CREATE_INDEXES = [
    "CREATE UNIQUE INDEX ix_users_email ON users (email)",
    "CREATE UNIQUE INDEX ix_organizations_slug ON organizations (slug)",
    "CREATE INDEX ix_festivals_date ON festivals (date)",
    "CREATE INDEX ix_user_organization_memberships_user_id ON user_organization_memberships (user_id)",
    "CREATE INDEX ix_user_organization_memberships_organization_id ON user_organization_memberships (organization_id)",
    "CREATE UNIQUE INDEX ix_brand_profiles_organization_id ON brand_profiles (organization_id)",
    "CREATE INDEX ix_social_accounts_organization_id ON social_accounts (organization_id)",
    "CREATE INDEX ix_campaigns_organization_id ON campaigns (organization_id)",
    "CREATE INDEX ix_content_generations_campaign_id ON content_generations (campaign_id)",
    "CREATE INDEX ix_content_generations_organization_id ON content_generations (organization_id)",
    "CREATE INDEX ix_content_generations_user_id ON content_generations (user_id)",
    "CREATE INDEX ix_campaign_posts_campaign_id ON campaign_posts (campaign_id)",
    "CREATE INDEX ix_campaign_images_post_id ON campaign_images (post_id)",
    "CREATE INDEX ix_campaign_images_campaign_id ON campaign_images (campaign_id)",
    "CREATE INDEX ix_hashtag_sets_organization_id ON hashtag_sets (organization_id)",
    "CREATE INDEX ix_api_keys_organization_id ON api_keys (organization_id)",
    "CREATE UNIQUE INDEX ix_api_keys_key_hash ON api_keys (key_hash)",
]

# Reverse order for clean teardown (children before parents).
DROP_TABLES = [
    "api_keys",
    "hashtag_sets",
    "campaign_images",
    "campaign_posts",
    "content_generations",
    "campaigns",
    "social_accounts",
    "brand_profiles",
    "user_organization_memberships",
    "festivals",
    "organizations",
    "users",
]


# Reference data: WASH / hygiene / social-impact awareness calendar.
# Seeded here so any fresh database (alembic upgrade head) has festivals for
# the calendar feature. Dates use 2026; is_recurring marks annual observances.
SEED_FESTIVALS = """
INSERT INTO festivals (id, name, description, date, category, relevant_sectors, suggested_hashtags, country, is_recurring, created_at, updated_at)
VALUES
 (gen_random_uuid(), 'World Menstrual Hygiene Day', 'Global day to raise awareness about good menstrual hygiene management', DATE '2026-05-28', 'awareness_day', '["menstrual_hygiene","womens_health"]'::json, '["#MenstrualHygieneDay","#MHDay","#PeriodPositive","#MenstrualHealth","#BreakTheTaboo"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Toilet Day', 'Inspiring action to tackle the global sanitation crisis', DATE '2026-11-19', 'awareness_day', '["water_sanitation"]'::json, '["#WorldToiletDay","#Sanitation4All","#WASH","#ToiletDay","#CleanSanitation"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Water Day', 'Advocating for the sustainable management of freshwater resources', DATE '2026-03-22', 'awareness_day', '["water_sanitation"]'::json, '["#WorldWaterDay","#Water4All","#WaterSecurity","#CleanWater","#WASH"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'Global Handwashing Day', 'Increasing awareness of handwashing with soap', DATE '2026-10-15', 'awareness_day', '["public_health","water_sanitation"]'::json, '["#GlobalHandwashingDay","#HandwashingDay","#CleanHands","#HygieneMatters","#WashYourHands"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'International Women''s Day', 'Celebrating women''s achievements and advocating for gender equality', DATE '2026-03-08', 'un_day', '["womens_health","community_development"]'::json, '["#IWD2026","#InternationalWomensDay","#GenderEquality","#WomensRights"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Environment Day', 'Encouraging awareness and action for the protection of the environment', DATE '2026-06-05', 'un_day', '["environment"]'::json, '["#WorldEnvironmentDay","#ForNature","#GenerationRestoration","#Sustainability"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Health Day', 'Drawing attention to important health issues affecting people of all ages', DATE '2026-04-07', 'un_day', '["public_health"]'::json, '["#WorldHealthDay","#HealthForAll","#GlobalHealth","#HealthMatters"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'Gandhi Jayanti / Swachh Bharat', 'Birthday of Mahatma Gandhi and Swachh Bharat Mission anniversary', DATE '2026-10-02', 'national_day', '["water_sanitation","community_development"]'::json, '["#SwachhBharat","#GandhiJayanti","#CleanIndia","#SwachhBharatMission"]'::json, 'IN', true, now(), now()),
 (gen_random_uuid(), 'Swachh Bharat Diwas', 'Swachh Bharat Mission launch anniversary', DATE '2026-09-19', 'national_day', '["water_sanitation"]'::json, '["#SwachhBharatDiwas","#SwachhBharat","#CleanIndia","#SanitationForAll"]'::json, 'IN', true, now(), now()),
 (gen_random_uuid(), 'Zero Discrimination Day', 'Promoting equality before the law and in practice', DATE '2026-03-01', 'un_day', '["community_development"]'::json, '["#ZeroDiscriminationDay","#ZeroDiscrimination","#Inclusion"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Population Day', 'Focus attention on the urgency and importance of population issues', DATE '2026-07-11', 'un_day', '["public_health","womens_health"]'::json, '["#WorldPopulationDay","#PopulationDay","#HealthForAll"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'International Day of Rural Women', 'Recognizing the role women play in rural development', DATE '2026-10-15', 'un_day', '["womens_health","community_development"]'::json, '["#RuralWomen","#RuralWomensDay","#EmpowerWomen"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Breastfeeding Week', 'Promoting breastfeeding and improving the health of babies worldwide', DATE '2026-08-01', 'awareness_day', '["public_health","womens_health"]'::json, '["#WorldBreastfeedingWeek","#WBW2026","#BreastfeedingSupport"]'::json, 'GLOBAL', true, now(), now()),
 (gen_random_uuid(), 'World Humanitarian Day', 'Honour humanitarian workers and advocate for humanitarian action', DATE '2026-08-19', 'un_day', '["community_development"]'::json, '["#WorldHumanitarianDay","#HumanitarianHeroes","#ForHumanity"]'::json, 'GLOBAL', true, now(), now())
"""


def upgrade() -> None:
    for ddl in CREATE_TABLES:
        op.execute(ddl)
    for ddl in CREATE_INDEXES:
        op.execute(ddl)
    op.execute(SEED_FESTIVALS)


def downgrade() -> None:
    for table in DROP_TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
