"""
Campaign CRUD routes.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import AuthorizationError, NotFoundError
from app.schemas.campaign import Campaign, CampaignPost
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    campaign_type: str = Field("awareness", description="awareness/festival/product/csr_report/founder/custom")
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    platforms: Optional[List[str]] = None
    target_hashtags: Optional[List[str]] = None
    brief: Optional[str] = None
    festival_id: Optional[uuid.UUID] = None


class CampaignUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    platforms: Optional[List[str]] = None
    target_hashtags: Optional[List[str]] = None
    brief: Optional[str] = None


class CampaignPostCreateRequest(BaseModel):
    platform: str
    content: str
    hashtags: Optional[List[str]] = None
    media_urls: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    sequence_order: int = 0
    content_generation_id: Optional[uuid.UUID] = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: Optional[str]
    campaign_type: str
    status: str
    platforms: Optional[List[str]]
    target_hashtags: Optional[List[str]]
    total_posts: int
    published_posts: int

    model_config = {"from_attributes": True}


class CampaignPostResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    platform: str
    content: str
    hashtags: Optional[List[str]]
    status: str
    sequence_order: int
    scheduled_at: Optional[str]
    published_at: Optional[str]

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

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
        raise NotFoundError("No active organization found.")
    org_result = await db.execute(select(Organization).where(Organization.id == m.organization_id))
    return org_result.scalar_one()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[CampaignResponse])
async def list_campaigns(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    query = select(Campaign).where(Campaign.organization_id == org.id)
    if status_filter:
        query = query.where(Campaign.status == status_filter)
    result = await db.execute(query.order_by(Campaign.created_at.desc()))
    return [CampaignResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    campaign = Campaign(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        campaign_type=payload.campaign_type,
        status="draft",
        platforms=payload.platforms or [],
        target_hashtags=payload.target_hashtags or [],
        brief=payload.brief,
        festival_id=payload.festival_id,
    )
    db.add(campaign)
    await db.flush()
    return CampaignResponse.model_validate(campaign)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")
    return CampaignResponse.model_validate(campaign)


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(campaign, field, value)
    await db.flush()
    return CampaignResponse.model_validate(campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")
    campaign.status = "archived"
    await db.flush()


# ── Campaign Posts ────────────────────────────────────────────────────────────

@router.get("/{campaign_id}/posts", response_model=List[CampaignPostResponse])
async def list_campaign_posts(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    # Verify campaign ownership
    c_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )
    if not c_result.scalar_one_or_none():
        raise NotFoundError(f"Campaign {campaign_id} not found.")

    result = await db.execute(
        select(CampaignPost)
        .where(CampaignPost.campaign_id == campaign_id)
        .order_by(CampaignPost.sequence_order)
    )
    return [CampaignPostResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/{campaign_id}/posts", response_model=CampaignPostResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign_post(
    campaign_id: uuid.UUID,
    payload: CampaignPostCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
    c_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )
    campaign = c_result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")

    post = CampaignPost(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        content_generation_id=payload.content_generation_id,
        platform=payload.platform,
        content=payload.content,
        hashtags=payload.hashtags or [],
        media_urls=payload.media_urls or [],
        sequence_order=payload.sequence_order,
        status="draft",
    )
    db.add(post)
    campaign.total_posts = (campaign.total_posts or 0) + 1
    await db.flush()
    return CampaignPostResponse.model_validate(post)
