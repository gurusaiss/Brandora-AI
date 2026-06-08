"""
Application configuration using pydantic-settings.

Single .env at the project root is the source of truth.
Search order (first file found wins):
  1. ../../.env  — when running from backend/app/core/ or via uvicorn inside backend/
  2. ../../../.env — when cwd is deeper
  3. .env        — fallback (also catches Docker env injection via env_file)

In Docker the root .env is injected as env vars via docker-compose env_file,
so pydantic-settings reads them from the environment directly (no file needed).
"""
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Walk up from this file to locate the project-root .env
_HERE = Path(__file__).resolve().parent          # …/backend/app/core
_ROOT = _HERE.parent.parent.parent.parent        # …/Brandora AI  (project root)
_ENV_CANDIDATES = [
    str(_ROOT / ".env"),          # project root — primary
    str(_HERE.parent.parent.parent / ".env"),  # backend/ — fallback
    ".env",                        # cwd fallback (also works for Docker env injection)
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_CANDIDATES,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Brandora AI API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # ── Database (Supabase PostgreSQL) ────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/brandora"

    # ── Supabase ─────────────────────────────────────────────────────────────
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-anon-key"
    SUPABASE_SERVICE_KEY: str = "your-service-key"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── JWT / Security ────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-to-a-secure-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI Providers ──────────────────────────────────────────────────────────
    # PRIMARY (Free) — get key at https://console.groq.com/keys
    GROQ_API_KEY: str = ""
    # SECONDARY fallback (Free) — get key at https://aistudio.google.com/app/apikey
    GOOGLE_AI_API_KEY: str = ""
    # OPTIONAL paid providers — leave blank to skip
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    # Default model — Groq Llama 3.3 70B (free, high quality)
    DEFAULT_AI_MODEL: str = "llama-3.3-70b-versatile"

    # ── Social OAuth ──────────────────────────────────────────────────────────
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    TWITTER_API_KEY: str = ""
    TWITTER_API_SECRET: str = ""
    TWITTER_BEARER_TOKEN: str = ""

    # ── Meta (Facebook + Instagram) ───────────────────────────────────────────
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    # Callback must match exactly what is set in Meta App → Facebook Login → Valid OAuth Redirect URIs
    META_REDIRECT_URI: str = "https://brandora-backend-dntm.onrender.com/api/v1/social-accounts/callback/meta"

    # ── Rate Limits / Tier Caps ───────────────────────────────────────────────
    MAX_GENERATIONS_FREE_TIER: int = 20
    MAX_GENERATIONS_PRO_TIER: int = 150
    MAX_GENERATIONS_GROWTH_TIER: int = 500

    # ── Observability ─────────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Plain string — comma-separated origins or "*"
    # e.g.  "*"  or  "https://app.vercel.app"  or  "https://a.com,https://b.com"
    ALLOWED_ORIGINS: str = "*"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Return ALLOWED_ORIGINS as a list for FastAPI CORSMiddleware."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # ── Email (optional SMTP) ─────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@brandoraai.com"


settings = Settings()
