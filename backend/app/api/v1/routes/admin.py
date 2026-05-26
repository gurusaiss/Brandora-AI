"""
Admin routes — internal dashboard. Requires admin API key or superuser role.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db
from app.schemas.content import ContentGeneration
from app.schemas.organization import Organization
from app.schemas.user import User

router = APIRouter()


def _verify_admin(x_admin_key: str = Header(...)):
    """Simple API-key guard for admin endpoints."""
    expected = settings.SECRET_KEY[:16]  # Use first 16 chars of SECRET_KEY as admin key
    if x_admin_key != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key.")


@router.get("/stats", dependencies=[Depends(_verify_admin)])
async def admin_stats(db: AsyncSession = Depends(get_db)):
    """Global platform statistics."""
    total_users = await db.execute(select(func.count(User.id)))
    total_orgs = await db.execute(select(func.count(Organization.id)))
    total_gens = await db.execute(select(func.count(ContentGeneration.id)))

    # Tier breakdown
    tier_result = await db.execute(
        select(Organization.subscription_tier, func.count(Organization.id).label("count"))
        .group_by(Organization.subscription_tier)
    )
    tier_breakdown = {row.subscription_tier: row.count for row in tier_result}

    # Top orgs by usage
    top_orgs_result = await db.execute(
        select(Organization.name, Organization.ai_generations_used, Organization.subscription_tier)
        .order_by(Organization.ai_generations_used.desc())
        .limit(10)
    )

    return {
        "total_users": total_users.scalar_one() or 0,
        "total_organizations": total_orgs.scalar_one() or 0,
        "total_generations": total_gens.scalar_one() or 0,
        "tier_breakdown": tier_breakdown,
        "top_organizations_by_usage": [
            {
                "name": row.name,
                "generations_used": row.ai_generations_used,
                "tier": row.subscription_tier,
            }
            for row in top_orgs_result
        ],
    }


@router.post("/organizations/{org_id}/upgrade", dependencies=[Depends(_verify_admin)])
async def upgrade_organization(
    org_id: str,
    tier: str,
    db: AsyncSession = Depends(get_db),
):
    """Manually upgrade an organization's subscription tier."""
    import uuid

    tier_limits = {
        "free": settings.MAX_GENERATIONS_FREE_TIER,
        "pro": settings.MAX_GENERATIONS_PRO_TIER,
        "growth": settings.MAX_GENERATIONS_GROWTH_TIER,
        "enterprise": 9999,
    }
    if tier not in tier_limits:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {tier}")

    result = await db.execute(
        select(Organization).where(Organization.id == uuid.UUID(org_id))
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    org.subscription_tier = tier
    org.ai_generations_limit = tier_limits[tier]
    await db.flush()

    return {"organization": org.name, "new_tier": tier, "new_limit": org.ai_generations_limit}
