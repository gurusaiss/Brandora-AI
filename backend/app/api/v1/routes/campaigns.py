"""
Campaign CRUD routes.
"""
import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import Campaign, CampaignPost
from app.schemas.content import ContentGeneration
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    campaign_type: str = Field("awareness", description="awareness/festival/product/csr_report/founder/custom")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    platforms: List[str] = Field(default_factory=list)
    target_hashtags: Optional[List[str]] = None
    brief: Optional[str] = None
    festival_id: Optional[uuid.UUID] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    campaign_type: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    platforms: Optional[List[str]] = None
    target_hashtags: Optional[List[str]] = None
    brief: Optional[str] = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    campaign_type: str
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    platforms: List[str] = Field(default_factory=list)
    total_posts: int
    published_posts: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CampaignListResponse(BaseModel):
    items: List[CampaignResponse]
    total: int


# ── Legacy request models (kept for backward compat with existing callers) ────

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

@router.get("/", response_model=CampaignListResponse)
async def list_campaigns(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all campaigns for the authenticated user's organization, excluding archived."""
    org = await _get_user_org(current_user, db)
    query = (
        select(Campaign)
        .where(
            Campaign.organization_id == org.id,
            Campaign.status != "archived",
        )
    )
    if status_filter:
        query = query.where(Campaign.status == status_filter)
    query = query.order_by(Campaign.created_at.desc())

    result = await db.execute(query)
    campaigns = result.scalars().all()

    items = [CampaignResponse.model_validate(c) for c in campaigns]
    return CampaignListResponse(items=items, total=len(items))


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new campaign in draft status."""
    org = await _get_user_org(current_user, db)
    campaign = Campaign(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        campaign_type=payload.campaign_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        platforms=payload.platforms,
        target_hashtags=payload.target_hashtags or [],
        brief=payload.brief,
        festival_id=payload.festival_id,
        status="draft",
        total_posts=0,
        published_posts=0,
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
    """Fetch a single campaign by ID."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == org.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")
    return CampaignResponse.model_validate(campaign)


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update a campaign's fields."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == org.id,
        )
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
    """Soft-delete a campaign by setting its status to archived."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == org.id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")
    campaign.status = "archived"
    await db.flush()


@router.get("/{campaign_id}/analytics")
async def get_campaign_analytics(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return analytics for a specific campaign."""
    org = await _get_user_org(current_user, db)

    # Verify campaign ownership
    c_result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == org.id,
        )
    )
    campaign = c_result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")

    # Total content generations linked to this campaign
    total_gen_result = await db.execute(
        select(func.count(ContentGeneration.id)).where(
            ContentGeneration.campaign_id == campaign_id,
            ContentGeneration.is_deleted == False,
        )
    )
    total_generations = total_gen_result.scalar_one() or 0

    # Saved content linked to this campaign
    saved_result = await db.execute(
        select(func.count(ContentGeneration.id)).where(
            ContentGeneration.campaign_id == campaign_id,
            ContentGeneration.is_saved == True,
            ContentGeneration.is_deleted == False,
        )
    )
    saved_content = saved_result.scalar_one() or 0

    # Platform breakdown for this campaign's content
    platform_result = await db.execute(
        select(
            ContentGeneration.platform,
            func.count(ContentGeneration.id).label("cnt"),
        )
        .where(
            ContentGeneration.campaign_id == campaign_id,
            ContentGeneration.is_deleted == False,
        )
        .group_by(ContentGeneration.platform)
        .order_by(func.count(ContentGeneration.id).desc())
    )
    platform_breakdown = {row.platform: row.cnt for row in platform_result.all()}

    return {
        "campaign_id": str(campaign_id),
        "campaign_name": campaign.name,
        "status": campaign.status,
        "total_posts": campaign.total_posts,
        "published_posts": campaign.published_posts,
        "total_generations": total_generations,
        "saved_content": saved_content,
        "platform_breakdown": platform_breakdown,
    }


# ── Campaign Posts ────────────────────────────────────────────────────────────

@router.get("/{campaign_id}/posts", response_model=List[CampaignPostResponse])
async def list_campaign_posts(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    org = await _get_user_org(current_user, db)
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
