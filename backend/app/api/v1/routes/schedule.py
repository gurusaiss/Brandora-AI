"""
Post scheduling routes — CRUD for campaign_posts with scheduling support.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import Campaign, CampaignPost
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ScheduledPostCreate(BaseModel):
    platform: str
    content: str
    scheduled_at: datetime
    campaign_id: Optional[uuid.UUID] = None
    hashtags: Optional[List[str]] = None


class ScheduledPostUpdate(BaseModel):
    platform: Optional[str] = None
    content: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    campaign_id: Optional[uuid.UUID] = None
    hashtags: Optional[List[str]] = None
    status: Optional[str] = None


class ScheduledPostResponse(BaseModel):
    id: uuid.UUID
    platform: str
    content: str
    hashtags: Optional[List[str]]
    scheduled_at: Optional[datetime]
    status: str
    campaign_id: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduledPostListResponse(BaseModel):
    items: List[ScheduledPostResponse]
    total: int


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    """Return the first active organisation the user belongs to."""
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
        raise NotFoundError("No active organization membership found.")

    org_result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise NotFoundError("Organization not found.")
    return org


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=ScheduledPostListResponse)
async def list_scheduled_posts(
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Filter by year"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all campaign posts for the user's organisation, optionally filtered by month/year."""
    org = await _get_user_org(current_user, db)

    # Subquery: all campaign IDs belonging to this org
    campaign_id_subquery = select(Campaign.id).where(
        Campaign.organization_id == org.id
    )

    query = select(CampaignPost).where(
        CampaignPost.campaign_id.in_(campaign_id_subquery)
    )

    if month is not None:
        query = query.where(
            extract("month", CampaignPost.scheduled_at) == month
        )
    if year is not None:
        query = query.where(
            extract("year", CampaignPost.scheduled_at) == year
        )

    query = query.order_by(CampaignPost.scheduled_at.asc())

    result = await db.execute(query)
    posts = result.scalars().all()

    items = [ScheduledPostResponse.model_validate(p) for p in posts]
    return ScheduledPostListResponse(items=items, total=len(items))


@router.post("", response_model=ScheduledPostResponse, status_code=status.HTTP_201_CREATED)
async def create_scheduled_post(
    payload: ScheduledPostCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new scheduled post.  If campaign_id is omitted a default
    'Scheduled Posts' campaign is found or created for the organisation."""
    org = await _get_user_org(current_user, db)

    if payload.campaign_id is not None:
        # Verify the supplied campaign belongs to this org
        campaign_result = await db.execute(
            select(Campaign).where(
                Campaign.id == payload.campaign_id,
                Campaign.organization_id == org.id,
            )
        )
        campaign = campaign_result.scalar_one_or_none()
        if not campaign:
            raise NotFoundError(
                f"Campaign {payload.campaign_id} not found for this organisation."
            )
    else:
        # Find or create the default "Scheduled Posts" campaign
        campaign_result = await db.execute(
            select(Campaign)
            .where(
                Campaign.organization_id == org.id,
                Campaign.name == "Scheduled Posts",
            )
            .limit(1)
        )
        campaign = campaign_result.scalar_one_or_none()
        if not campaign:
            campaign = Campaign(
                organization_id=org.id,
                user_id=current_user.id,
                name="Scheduled Posts",
                campaign_type="custom",
                status="active",
            )
            db.add(campaign)
            await db.flush()  # populate campaign.id before FK use

    post = CampaignPost(
        campaign_id=campaign.id,
        platform=payload.platform,
        content=payload.content,
        hashtags=payload.hashtags or [],
        scheduled_at=payload.scheduled_at,
        status="scheduled",
    )
    db.add(post)
    await db.flush()

    return ScheduledPostResponse.model_validate(post)


@router.put("/{post_id}", response_model=ScheduledPostResponse)
async def update_scheduled_post(
    post_id: uuid.UUID,
    payload: ScheduledPostUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a scheduled post.  Ownership is verified via the campaign's org."""
    org = await _get_user_org(current_user, db)

    # Fetch post and verify ownership via JOIN
    result = await db.execute(
        select(CampaignPost)
        .join(Campaign, Campaign.id == CampaignPost.campaign_id)
        .where(
            CampaignPost.id == post_id,
            Campaign.organization_id == org.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError(f"Scheduled post {post_id} not found.")

    # If the caller wants to move to a different campaign, validate it
    if payload.campaign_id is not None:
        campaign_check = await db.execute(
            select(Campaign).where(
                Campaign.id == payload.campaign_id,
                Campaign.organization_id == org.id,
            )
        )
        if not campaign_check.scalar_one_or_none():
            raise NotFoundError(
                f"Campaign {payload.campaign_id} not found for this organisation."
            )
        post.campaign_id = payload.campaign_id

    if payload.platform is not None:
        post.platform = payload.platform
    if payload.content is not None:
        post.content = payload.content
    if payload.hashtags is not None:
        post.hashtags = payload.hashtags
    if payload.scheduled_at is not None:
        post.scheduled_at = payload.scheduled_at
    if payload.status is not None:
        post.status = payload.status

    await db.flush()

    return ScheduledPostResponse.model_validate(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a scheduled post after verifying org ownership."""
    org = await _get_user_org(current_user, db)

    result = await db.execute(
        select(CampaignPost)
        .join(Campaign, Campaign.id == CampaignPost.campaign_id)
        .where(
            CampaignPost.id == post_id,
            Campaign.organization_id == org.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise NotFoundError(f"Scheduled post {post_id} not found.")

    await db.delete(post)
    await db.flush()


# ---------------------------------------------------------------------------
# Manual publish trigger (no auth — for testing/ops; add IP guard before prod)
# ---------------------------------------------------------------------------

@router.post("/trigger-publish", tags=["Schedule"])
async def trigger_publish(x_admin_key: str = Header(...)):
    """Manually trigger the scheduled post publisher (admin key required)."""
    from app.core.config import settings
    if x_admin_key != settings.SECRET_KEY[:16]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key.")
    from app.core.scheduler import process_campaign_posts
    await process_campaign_posts()
    return {"message": "Manual publish triggered"}
