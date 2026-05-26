"""
Post scheduling routes.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import CampaignPost
from app.schemas.user import User, UserOrganizationMembership
from app.schemas.organization import Organization

router = APIRouter()


class SchedulePostRequest(BaseModel):
    post_id: uuid.UUID
    scheduled_at: datetime = Field(..., description="ISO datetime for scheduling (UTC)")


class ScheduledPostResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    platform: str
    content: str
    scheduled_at: Optional[datetime]
    status: str

    model_config = {"from_attributes": True}


async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    m = await db.execute(
        select(UserOrganizationMembership)
        .where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,
        )
        .limit(1)
    )
    membership = m.scalar_one_or_none()
    if not membership:
        raise NotFoundError("No active organization.")
    org = await db.execute(select(Organization).where(Organization.id == membership.organization_id))
    return org.scalar_one()


@router.get("/", response_model=List[ScheduledPostResponse])
async def list_scheduled_posts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all scheduled (not yet published) posts for the organization."""
    from app.schemas.campaign import Campaign

    org = await _get_user_org(current_user, db)

    # Get all campaigns for this org
    campaigns_result = await db.execute(
        select(Campaign.id).where(Campaign.organization_id == org.id)
    )
    campaign_ids = [row.id for row in campaigns_result]

    if not campaign_ids:
        return []

    result = await db.execute(
        select(CampaignPost)
        .where(
            CampaignPost.campaign_id.in_(campaign_ids),
            CampaignPost.status == "scheduled",
        )
        .order_by(CampaignPost.scheduled_at.asc())
    )
    return [ScheduledPostResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/", response_model=ScheduledPostResponse)
async def schedule_post(
    payload: SchedulePostRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule a campaign post for publishing at a specific time."""
    from app.schemas.campaign import Campaign
    from app.workers.scheduler_tasks import publish_post_at_scheduled_time

    org = await _get_user_org(current_user, db)

    # Verify ownership via campaign
    post_result = await db.execute(
        select(CampaignPost).where(CampaignPost.id == payload.post_id)
    )
    post = post_result.scalar_one_or_none()
    if not post:
        raise NotFoundError(f"Post {payload.post_id} not found.")

    campaign_result = await db.execute(
        select(Campaign).where(
            Campaign.id == post.campaign_id,
            Campaign.organization_id == org.id,
        )
    )
    if not campaign_result.scalar_one_or_none():
        raise NotFoundError("Post not accessible for this organization.")

    post.scheduled_at = payload.scheduled_at
    post.status = "scheduled"
    await db.flush()

    # Enqueue Celery task
    try:
        publish_post_at_scheduled_time.apply_async(
            args=[str(post.id)],
            eta=payload.scheduled_at,
        )
    except Exception:
        pass  # Celery may not be running in dev; don't fail the API call

    return ScheduledPostResponse.model_validate(post)


@router.delete("/{post_id}/unschedule", status_code=status.HTTP_204_NO_CONTENT)
async def unschedule_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel scheduling of a post (set back to draft)."""
    from app.schemas.campaign import Campaign

    org = await _get_user_org(current_user, db)

    post_result = await db.execute(select(CampaignPost).where(CampaignPost.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise NotFoundError(f"Post {post_id} not found.")

    campaign_result = await db.execute(
        select(Campaign).where(
            Campaign.id == post.campaign_id,
            Campaign.organization_id == org.id,
        )
    )
    if not campaign_result.scalar_one_or_none():
        raise NotFoundError("Post not accessible for this organization.")

    post.scheduled_at = None
    post.status = "draft"
    await db.flush()
