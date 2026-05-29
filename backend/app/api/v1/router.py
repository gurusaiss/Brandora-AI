"""
API v1 router — includes all sub-routers.
"""
from fastapi import APIRouter

from app.api.v1.routes import (
    admin,
    analytics,
    auth,
    brand_profile,
    campaigns,
    festivals,
    hashtags,
    organizations,
    schedule,
    social_accounts,
    content,
    team,
    api_keys,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(brand_profile.router, prefix="/brand-profile", tags=["Brand Profile"])
api_router.include_router(content.router, prefix="/content", tags=["Content Generation"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
api_router.include_router(schedule.router, prefix="/schedule", tags=["Scheduling"])
api_router.include_router(social_accounts.router, prefix="/social-accounts", tags=["Social Accounts"])
api_router.include_router(hashtags.router, prefix="/hashtags", tags=["Hashtags"])
api_router.include_router(festivals.router, prefix="/festivals", tags=["Festival Calendar"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(team.router, prefix="/team", tags=["Team"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["API Keys"])
