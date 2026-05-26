"""Initial schema — all core tables

Revision ID: 001
Revises: None
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ---------------------------------------------------------------------------
revision = "001"
down_revision = None
branch_labels = None
depends_on = None
# ---------------------------------------------------------------------------


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────
    subscription_tier = postgresql.ENUM(
        "free", "pro", "growth", "enterprise",
        name="subscriptiontier",
        create_type=True,
    )
    subscription_tier.create(op.get_bind(), checkfirst=True)

    user_role = postgresql.ENUM(
        "owner", "admin", "editor", "viewer",
        name="userrole",
        create_type=True,
    )
    user_role.create(op.get_bind(), checkfirst=True)

    platform_enum = postgresql.ENUM(
        "linkedin", "instagram", "twitter", "facebook",
        name="platformenum",
        create_type=True,
    )
    platform_enum.create(op.get_bind(), checkfirst=True)

    content_status = postgresql.ENUM(
        "draft", "pending", "approved", "scheduled", "published", "failed", "archived",
        name="contentstatus",
        create_type=True,
    )
    content_status.create(op.get_bind(), checkfirst=True)

    ai_provider_enum = postgresql.ENUM(
        "openai", "anthropic", "google",
        name="aiproviderenum",
        create_type=True,
    )
    ai_provider_enum.create(op.get_bind(), checkfirst=True)

    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=True),  # nullable for OAuth
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("supabase_uid", sa.String(255), nullable=True),
        sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()"), onupdate=sa.text("NOW()")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_supabase_uid", "users", ["supabase_uid"], unique=True)

    # ── subscription_plans ────────────────────────────────────────────────
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("tier", sa.Enum("free", "pro", "growth", "enterprise",
                                  name="subscriptiontier", create_type=False),
                  nullable=False),
        sa.Column("price_monthly_usd", sa.Numeric(10, 2), nullable=False,
                  server_default="0"),
        sa.Column("ai_generations_limit", sa.Integer, nullable=False,
                  comment="-1 means unlimited"),
        sa.Column("max_users", sa.Integer, nullable=False,
                  comment="-1 means unlimited"),
        sa.Column("max_brands", sa.Integer, nullable=False,
                  comment="-1 means unlimited"),
        sa.Column("features", postgresql.JSONB, nullable=False,
                  server_default="[]"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("ix_subscription_plans_tier", "subscription_plans", ["tier"])

    # ── organizations ─────────────────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True,
                  comment="e.g. ngo, csr, government, social_enterprise"),
        sa.Column("subscription_plan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subscription_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("ai_generations_used_this_month", sa.Integer, nullable=False,
                  server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(
            ["subscription_plan_id"], ["subscription_plans.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    # ── user_organization_memberships ─────────────────────────────────────
    op.create_table(
        "user_organization_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.Enum("owner", "admin", "editor", "viewer",
                                  name="userrole", create_type=False),
                  nullable=False, server_default="editor"),
        sa.Column("invited_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("joined_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"],
                                ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"],
                                ondelete="SET NULL"),
        sa.UniqueConstraint("user_id", "organization_id",
                            name="uq_user_organization"),
    )
    op.create_index("ix_uom_user_id", "user_organization_memberships", ["user_id"])
    op.create_index("ix_uom_org_id", "user_organization_memberships",
                    ["organization_id"])

    # ── brand_profiles ────────────────────────────────────────────────────
    op.create_table(
        "brand_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("tagline", sa.String(500), nullable=True),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column("primary_color", sa.String(7), nullable=True,
                  comment="Hex colour code e.g. #3B82F6"),
        sa.Column("secondary_color", sa.String(7), nullable=True),
        sa.Column("brand_voice", sa.Text, nullable=True,
                  comment="Free text description of brand tone and values"),
        sa.Column("target_audience", sa.Text, nullable=True),
        sa.Column("mission_statement", sa.Text, nullable=True),
        sa.Column("sdg_focus", postgresql.JSONB, nullable=True,
                  comment="List of SDG numbers this brand focuses on"),
        sa.Column("default_hashtags", postgresql.JSONB, nullable=True),
        sa.Column("platforms_connected", postgresql.JSONB, nullable=True,
                  comment="Map of platform -> oauth token metadata"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"],
                                ondelete="CASCADE"),
    )
    op.create_index("ix_brand_profiles_org_id", "brand_profiles",
                    ["organization_id"])

    # ── campaigns ─────────────────────────────────────────────────────────
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brand_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("objective", sa.String(255), nullable=True),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft",
                  comment="draft|active|paused|completed|archived"),
        sa.Column("target_platforms", postgresql.JSONB, nullable=True),
        sa.Column("tags", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"],
                                ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["brand_profile_id"], ["brand_profiles.id"],
                                ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"],
                                ondelete="RESTRICT"),
    )
    op.create_index("ix_campaigns_org_id", "campaigns", ["organization_id"])
    op.create_index("ix_campaigns_brand_id", "campaigns", ["brand_profile_id"])
    op.create_index("ix_campaigns_status", "campaigns", ["status"])

    # ── festival_calendar ─────────────────────────────────────────────────
    op.create_table(
        "festival_calendar",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("date_month", sa.SmallInteger, nullable=False),
        sa.Column("date_day", sa.SmallInteger, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True,
                  comment="menstrual_health|sanitation|hygiene|health|gender_equality|environment|inclusion"),
        sa.Column("sdg_tags", postgresql.JSONB, nullable=True,
                  comment="List of relevant SDG numbers"),
        sa.Column("default_hashtags", postgresql.JSONB, nullable=True),
        sa.Column("is_global", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_india_specific", sa.Boolean, nullable=False,
                  server_default="false"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("ix_festival_calendar_month_day", "festival_calendar",
                    ["date_month", "date_day"])
    op.create_index("ix_festival_calendar_category", "festival_calendar",
                    ["category"])

    # ── content_templates ─────────────────────────────────────────────────
    op.create_table(
        "content_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True,
                  comment="NULL means system-wide template"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("platform", sa.Enum("linkedin", "instagram", "twitter", "facebook",
                                      name="platformenum", create_type=False),
                  nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("template_content", sa.Text, nullable=False,
                  comment="Template string with {{variable}} placeholders"),
        sa.Column("variables", postgresql.JSONB, nullable=True,
                  comment="List of variable names required by this template"),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("usage_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"],
                                ondelete="CASCADE"),
    )
    op.create_index("ix_content_templates_platform", "content_templates",
                    ["platform"])
    op.create_index("ix_content_templates_is_system", "content_templates",
                    ["is_system"])

    # ── content_generations ────────────────────────────────────────────────
    op.create_table(
        "content_generations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brand_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("festival_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("platform", sa.Enum("linkedin", "instagram", "twitter", "facebook",
                                      name="platformenum", create_type=False),
                  nullable=False),
        sa.Column("prompt_used", sa.Text, nullable=True),
        sa.Column("generated_content", sa.Text, nullable=False),
        sa.Column("edited_content", sa.Text, nullable=True,
                  comment="User-edited version before publishing"),
        sa.Column("ai_provider", sa.Enum("openai", "anthropic", "google",
                                         name="aiproviderenum", create_type=False),
                  nullable=False),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("tokens_used", sa.Integer, nullable=True),
        sa.Column("generation_time_ms", sa.Integer, nullable=True),
        sa.Column("status", sa.Enum("draft", "pending", "approved", "scheduled",
                                    "published", "failed", "archived",
                                    name="contentstatus", create_type=False),
                  nullable=False, server_default="draft"),
        sa.Column("feedback_score", sa.SmallInteger, nullable=True,
                  comment="1-5 user rating"),
        sa.Column("feedback_note", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"],
                                ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["brand_profile_id"], ["brand_profiles.id"],
                                ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"],
                                ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"],
                                ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["festival_id"], ["festival_calendar.id"],
                                ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["template_id"], ["content_templates.id"],
                                ondelete="SET NULL"),
    )
    op.create_index("ix_content_gen_org_id", "content_generations",
                    ["organization_id"])
    op.create_index("ix_content_gen_created_by", "content_generations",
                    ["created_by_user_id"])
    op.create_index("ix_content_gen_campaign", "content_generations",
                    ["campaign_id"])
    op.create_index("ix_content_gen_status", "content_generations", ["status"])
    op.create_index("ix_content_gen_platform", "content_generations", ["platform"])
    op.create_index("ix_content_gen_created_at", "content_generations",
                    ["created_at"])

    # ── campaign_posts ────────────────────────────────────────────────────
    op.create_table(
        "campaign_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_generation_id", postgresql.UUID(as_uuid=True),
                  nullable=False),
        sa.Column("platform", sa.Enum("linkedin", "instagram", "twitter", "facebook",
                                      name="platformenum", create_type=False),
                  nullable=False),
        sa.Column("status", sa.Enum("draft", "pending", "approved", "scheduled",
                                    "published", "failed", "archived",
                                    name="contentstatus", create_type=False),
                  nullable=False, server_default="draft"),
        sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("platform_post_id", sa.String(255), nullable=True,
                  comment="ID returned by the social platform after publish"),
        sa.Column("platform_post_url", sa.Text, nullable=True),
        sa.Column("publish_error", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"],
                                ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["content_generation_id"],
                                ["content_generations.id"],
                                ondelete="CASCADE"),
    )
    op.create_index("ix_campaign_posts_campaign_id", "campaign_posts",
                    ["campaign_id"])
    op.create_index("ix_campaign_posts_scheduled_at", "campaign_posts",
                    ["scheduled_at"])
    op.create_index("ix_campaign_posts_status", "campaign_posts", ["status"])

    # ── ai_usage_logs ─────────────────────────────────────────────────────
    op.create_table(
        "ai_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content_generation_id", postgresql.UUID(as_uuid=True),
                  nullable=True),
        sa.Column("ai_provider", sa.Enum("openai", "anthropic", "google",
                                         name="aiproviderenum", create_type=False),
                  nullable=False),
        sa.Column("ai_model", sa.String(100), nullable=False),
        sa.Column("operation_type", sa.String(100), nullable=False,
                  comment="generate_post|improve_content|translate|summarize"),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("total_tokens", sa.Integer, nullable=True),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("success", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"],
                                ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["content_generation_id"],
                                ["content_generations.id"],
                                ondelete="SET NULL"),
    )
    op.create_index("ix_ai_usage_logs_org_id", "ai_usage_logs",
                    ["organization_id"])
    op.create_index("ix_ai_usage_logs_user_id", "ai_usage_logs", ["user_id"])
    op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"])
    op.create_index("ix_ai_usage_logs_provider", "ai_usage_logs", ["ai_provider"])


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table("ai_usage_logs")
    op.drop_table("campaign_posts")
    op.drop_table("content_generations")
    op.drop_table("content_templates")
    op.drop_table("festival_calendar")
    op.drop_table("campaigns")
    op.drop_table("brand_profiles")
    op.drop_table("user_organization_memberships")
    op.drop_table("organizations")
    op.drop_table("subscription_plans")
    op.drop_table("users")

    # Drop enums
    for enum_name in [
        "aiproviderenum",
        "contentstatus",
        "platformenum",
        "userrole",
        "subscriptiontier",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
