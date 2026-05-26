"""
Analytics routes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.schemas.content import ContentGeneration
from app.schemas.campaign import Campaign
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    m_result = await db.execute(
        select(UserOrganizationMembership)
        .where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,
        )
        .limit(1)
    )
    m = m_result.scalar_one_or_none()
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No active organization found.")
    org_result = await db.execute(select(Organization).where(Organization.id == m.organization_id))
    return org_result.scalar_one()


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated content and campaign statistics for the organization."""
    org = await _get_user_org(current_user, db)

    # Total generations
    total_gen = await db.execute(
        select(func.count(ContentGeneration.id)).where(
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
    )
    total_generations = total_gen.scalar_one() or 0

    # Saved count
    saved_count = await db.execute(
        select(func.count(ContentGeneration.id)).where(
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_saved == True,
            ContentGeneration.is_deleted == False,
        )
    )
    total_saved = saved_count.scalar_one() or 0

    # Campaigns count
    campaigns_count = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.organization_id == org.id)
    )
    total_campaigns = campaigns_count.scalar_one() or 0

    # Platform breakdown
    platform_result = await db.execute(
        select(ContentGeneration.platform, func.count(ContentGeneration.id).label("count"))
        .where(
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
        .group_by(ContentGeneration.platform)
    )
    platform_breakdown = {row.platform: row.count for row in platform_result}

    # Model usage
    model_result = await db.execute(
        select(
            ContentGeneration.ai_model_used,
            func.count(ContentGeneration.id).label("count"),
        )
        .where(
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
        .group_by(ContentGeneration.ai_model_used)
    )
    model_breakdown = {row.ai_model_used: row.count for row in model_result}

    # Usage limits
    generations_remaining = max(0, org.ai_generations_limit - org.ai_generations_used)

    return {
        "total_generations": total_generations,
        "total_saved": total_saved,
        "total_campaigns": total_campaigns,
        "generations_used": org.ai_generations_used,
        "generations_limit": org.ai_generations_limit,
        "generations_remaining": generations_remaining,
        "subscription_tier": org.subscription_tier,
        "platform_breakdown": platform_breakdown,
        "model_breakdown": model_breakdown,
    }


@router.get("/content-performance")
async def get_content_performance(
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top-performing content by quality score."""
    org = await _get_user_org(current_user, db)

    result = await db.execute(
        select(ContentGeneration)
        .where(
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
            ContentGeneration.quality_score.isnot(None),
        )
        .order_by(ContentGeneration.quality_score.desc())
        .limit(limit)
    )
    items = result.scalars().all()

    # Thumbs up/down ratio
    feedback_result = await db.execute(
        select(
            ContentGeneration.feedback,
            func.count(ContentGeneration.id).label("count"),
        )
        .where(
            ContentGeneration.organization_id == org.id,
            ContentGeneration.feedback.isnot(None),
        )
        .group_by(ContentGeneration.feedback)
    )
    feedback_breakdown = {row.feedback: row.count for row in feedback_result}

    return {
        "top_content": [
            {
                "id": str(item.id),
                "platform": item.platform,
                "quality_score": item.quality_score,
                "is_saved": item.is_saved,
                "feedback": item.feedback,
                "topic": item.input_topic,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ],
        "feedback_breakdown": feedback_breakdown,
    }
