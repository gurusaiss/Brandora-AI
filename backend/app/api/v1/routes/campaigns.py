"""
Campaign CRUD routes — including the Campaign Automation Engine.
"""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

logger = logging.getLogger("brandora.campaigns")

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import Campaign, CampaignPost, SocialAccount
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


class AutoCampaignCreate(BaseModel):
    name: str = Field(..., min_length=1)
    topic: str = Field(..., min_length=3, description="What to generate content about")
    social_account_id: uuid.UUID
    frequency: str = Field("daily", description="daily/weekly/biweekly/monthly")
    post_time: str = Field("09:00", description="HH:MM in IST (24h)")
    post_days: Optional[List[str]] = Field(default_factory=list, description="['mon','wed','fri'] for weekly")
    image_url: Optional[str] = None


class AutoCampaignResponse(BaseModel):
    id: uuid.UUID
    name: str
    topic: Optional[str]
    status: str
    is_scheduled: bool
    frequency: str
    post_time: str
    post_days: Optional[List[str]]
    next_run_at: Optional[datetime]
    last_run_at: Optional[datetime]
    published_posts: int
    total_posts: int
    image_url: Optional[str]
    social_account_platform: Optional[str] = None
    social_account_name: Optional[str] = None
    created_at: datetime

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


# ── Auto-Campaign Routes ──────────────────────────────────────────────────────
# IMPORTANT: These MUST come before /{campaign_id} routes to avoid FastAPI
# trying to parse the literal string "auto" as a UUID.

@router.get("/auto", response_model=List[AutoCampaignResponse])
async def list_auto_campaigns(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all auto-scheduled campaigns for the org."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(
            Campaign.organization_id == org.id,
            Campaign.is_scheduled == True,
            Campaign.status != "archived",
        ).order_by(Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()

    items = []
    for c in campaigns:
        sa_platform = sa_name = None
        if c.social_account_id:
            sa = (await db.execute(
                select(SocialAccount).where(SocialAccount.id == c.social_account_id)
            )).scalar_one_or_none()
            if sa:
                sa_platform = sa.platform
                sa_name     = sa.account_name
        r = AutoCampaignResponse.model_validate(c)
        r.social_account_platform = sa_platform
        r.social_account_name     = sa_name
        items.append(r)
    return items


@router.post("/auto", response_model=AutoCampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_auto_campaign(
    payload: AutoCampaignCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an auto-scheduled campaign."""
    org = await _get_user_org(current_user, db)

    # Verify social account belongs to org
    sa = (await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == payload.social_account_id,
            SocialAccount.organization_id == org.id,
            SocialAccount.is_active == True,
        )
    )).scalar_one_or_none()
    if not sa:
        raise HTTPException(status_code=404, detail="Social account not found or inactive.")

    # Calculate first run time
    from app.core.scheduler import _next_run
    now = datetime.now(timezone.utc)
    next_run = _next_run(payload.frequency, payload.post_time, payload.post_days or [], now)

    campaign = Campaign(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        name=payload.name,
        topic=payload.topic,
        social_account_id=payload.social_account_id,
        frequency=payload.frequency,
        post_time=payload.post_time,
        post_days=payload.post_days or [],
        image_url=payload.image_url,
        is_scheduled=True,
        status="active",
        next_run_at=next_run,
        platforms=[sa.platform],
        total_posts=0,
        published_posts=0,
        campaign_type="awareness",
    )
    db.add(campaign)
    await db.flush()

    r = AutoCampaignResponse.model_validate(campaign)
    r.social_account_platform = sa.platform
    r.social_account_name     = sa.account_name
    return r


# ── Single campaign routes (UUID param — must come AFTER /auto) ───────────────

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


@router.patch("/{campaign_id}/toggle", response_model=AutoCampaignResponse)
async def toggle_auto_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause an active auto-campaign or resume a paused one."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")

    if campaign.status == "active":
        campaign.status = "draft"   # paused
    else:
        campaign.status = "active"
        # Re-calculate next_run_at when resuming
        if not campaign.next_run_at or campaign.next_run_at < datetime.now(timezone.utc):
            from app.core.scheduler import _next_run
            campaign.next_run_at = _next_run(
                campaign.frequency, campaign.post_time, campaign.post_days or [],
                datetime.now(timezone.utc)
            )

    await db.flush()

    sa_platform = sa_name = None
    if campaign.social_account_id:
        sa = (await db.execute(
            select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
        )).scalar_one_or_none()
        if sa:
            sa_platform = sa.platform
            sa_name     = sa.account_name

    r = AutoCampaignResponse.model_validate(campaign)
    r.social_account_platform = sa_platform
    r.social_account_name     = sa_name
    return r


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


# ── Campaign Automation Engine ────────────────────────────────────────────────
# New pydantic models for full automation

class AutomationCampaignCreate(BaseModel):
    name: str                   = Field(..., min_length=1)
    campaign_goal: str          = Field(..., min_length=3)
    description: Optional[str]  = None
    target_audience: str        = Field(..., min_length=3)
    platforms: List[str]        = Field(..., min_items=1)
    social_account_id: uuid.UUID
    start_date: date
    end_date: date
    frequency: str              = Field("daily", description="daily/alternate_days/weekly/monthly/custom")
    post_time: str              = Field("09:00", description="HH:MM IST 24h")
    post_days: Optional[List[str]] = Field(default_factory=list)
    tone: str                   = Field("professional")
    keywords: Optional[List[str]]  = Field(default_factory=list)
    target_hashtags: Optional[List[str]] = Field(default_factory=list)
    cta: Optional[str]          = None
    generate_images: bool       = False
    topic: Optional[str]        = None


class AutomationPostResponse(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    platform: str
    content: str
    hashtags: Optional[List[str]]
    image_url: Optional[str]
    status: str
    sequence_order: int
    retry_count: int
    failure_reason: Optional[str]
    platform_post_id: Optional[str]
    scheduled_at: Optional[datetime]
    published_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class AutomationCampaignDetailResponse(BaseModel):
    id: uuid.UUID
    name: str
    campaign_goal: Optional[str]
    description: Optional[str]
    target_audience: Optional[str]
    platforms: List[str]
    frequency: str
    post_time: str
    post_days: Optional[List[str]]
    tone: str
    keywords: Optional[List[str]]
    target_hashtags: Optional[List[str]]
    cta: Optional[str]
    generate_images: bool
    status: str
    start_date: Optional[date]
    end_date: Optional[date]
    total_posts: int
    published_posts: int
    social_account_id: Optional[uuid.UUID]
    social_account_platform: Optional[str] = None
    social_account_name: Optional[str]     = None
    created_at: datetime
    # analytics
    posts_scheduled: int = 0
    posts_generating: int = 0
    posts_published: int = 0
    posts_failed: int = 0
    posts_remaining: int = 0
    progress_pct: float = 0.0
    posts: List[AutomationPostResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


@router.post("/automation", response_model=AutomationCampaignDetailResponse,
             status_code=status.HTTP_201_CREATED)
async def create_automation_campaign(
    payload: AutomationCampaignCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession    = Depends(get_db),
):
    """
    Create a full automation campaign.
    Generates the complete posting schedule upfront; content is generated
    by the background scheduler before each post's publish time.
    The first post per platform gets content generated immediately for preview.
    """
    from datetime import date as _date
    org = await _get_user_org(current_user, db)

    # Verify social account
    sa = (await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == payload.social_account_id,
            SocialAccount.organization_id == org.id,
            SocialAccount.is_active == True,
        )
    )).scalar_one_or_none()
    if not sa:
        raise HTTPException(status_code=404, detail="Social account not found or inactive.")

    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date.")

    # Create campaign record
    campaign = Campaign(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        name=payload.name,
        campaign_goal=payload.campaign_goal,
        description=payload.description,
        target_audience=payload.target_audience,
        platforms=payload.platforms,
        social_account_id=payload.social_account_id,
        frequency=payload.frequency,
        post_time=payload.post_time,
        post_days=payload.post_days or [],
        tone=payload.tone,
        keywords=payload.keywords or [],
        target_hashtags=payload.target_hashtags or [],
        cta=payload.cta,
        generate_images=payload.generate_images,
        topic=payload.topic or payload.campaign_goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_scheduled=True,
        status="active",
        total_posts=0,
        published_posts=0,
        campaign_type="awareness",
    )
    db.add(campaign)
    await db.flush()

    # Generate schedule
    from app.services.campaign_engine import generate_schedule_times
    times = generate_schedule_times(
        payload.start_date, payload.end_date,
        payload.frequency, payload.post_time, payload.post_days or [],
    )

    # Create one CampaignPost per (time, platform) slot
    created_posts: list[CampaignPost] = []
    seq = 0
    for slot_utc in times:
        for platform in payload.platforms:
            post = CampaignPost(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                platform=platform,
                content="",          # filled by scheduler before publish
                status="scheduled",
                scheduled_at=slot_utc,
                sequence_order=seq,
            )
            db.add(post)
            created_posts.append(post)
            seq += 1

    campaign.total_posts = len(created_posts)
    await db.flush()

    # Generate content for first post per platform immediately (preview)
    from app.services.campaign_engine import generate_post_content
    seen_platforms: set[str] = set()
    for i, post in enumerate(created_posts):
        if post.platform not in seen_platforms:
            seen_platforms.add(post.platform)
            try:
                content, hashtags = await generate_post_content(
                    campaign, post.platform, i, len(created_posts)
                )
                post.content  = content
                post.hashtags = hashtags
            except Exception as exc:
                logger.warning("Preview content gen failed: %s", exc)

    await db.flush()

    # Build detail response
    return await _build_detail_response(campaign, created_posts, sa)


@router.get("/automation/list", response_model=List[AutomationCampaignDetailResponse])
async def list_automation_campaigns(
    current_user: User  = Depends(get_current_active_user),
    db: AsyncSession    = Depends(get_db),
):
    """List all automation campaigns (is_scheduled=True) for the org."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(Campaign).where(
            Campaign.organization_id == org.id,
            Campaign.is_scheduled == True,
            Campaign.status != "archived",
        ).order_by(Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    out = []
    for c in campaigns:
        posts_res = await db.execute(
            select(CampaignPost).where(CampaignPost.campaign_id == c.id)
            .order_by(CampaignPost.sequence_order)
        )
        posts = posts_res.scalars().all()
        sa = None
        if c.social_account_id:
            sa = (await db.execute(
                select(SocialAccount).where(SocialAccount.id == c.social_account_id)
            )).scalar_one_or_none()
        out.append(await _build_detail_response(c, posts, sa))
    return out


@router.get("/{campaign_id}/detail", response_model=AutomationCampaignDetailResponse)
async def get_campaign_detail(
    campaign_id: uuid.UUID,
    current_user: User  = Depends(get_current_active_user),
    db: AsyncSession    = Depends(get_db),
):
    """Full campaign detail with all posts and analytics."""
    org = await _get_user_org(current_user, db)
    campaign = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )).scalar_one_or_none()
    if not campaign:
        raise NotFoundError(f"Campaign {campaign_id} not found.")

    posts_res = await db.execute(
        select(CampaignPost).where(CampaignPost.campaign_id == campaign_id)
        .order_by(CampaignPost.sequence_order)
    )
    posts = posts_res.scalars().all()

    sa = None
    if campaign.social_account_id:
        sa = (await db.execute(
            select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
        )).scalar_one_or_none()

    return await _build_detail_response(campaign, posts, sa)


@router.patch("/{campaign_id}/posts/{post_id}", response_model=AutomationPostResponse)
async def update_campaign_post(
    campaign_id: uuid.UUID,
    post_id: uuid.UUID,
    payload: dict,
    current_user: User  = Depends(get_current_active_user),
    db: AsyncSession    = Depends(get_db),
):
    """Edit a scheduled post's content before it publishes."""
    org = await _get_user_org(current_user, db)
    campaign = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )).scalar_one_or_none()
    if not campaign:
        raise NotFoundError("Campaign not found.")

    post = (await db.execute(
        select(CampaignPost).where(CampaignPost.id == post_id, CampaignPost.campaign_id == campaign_id)
    )).scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found.")

    allowed = {"content", "hashtags", "image_url", "scheduled_at"}
    for field, value in payload.items():
        if field in allowed:
            setattr(post, field, value)
    await db.flush()
    return AutomationPostResponse.model_validate(post)


@router.post("/{campaign_id}/posts/{post_id}/regenerate", response_model=AutomationPostResponse)
async def regenerate_post_content(
    campaign_id: uuid.UUID,
    post_id: uuid.UUID,
    current_user: User  = Depends(get_current_active_user),
    db: AsyncSession    = Depends(get_db),
):
    """Manually regenerate AI content for a specific post."""
    org = await _get_user_org(current_user, db)
    campaign = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org.id)
    )).scalar_one_or_none()
    if not campaign:
        raise NotFoundError("Campaign not found.")

    post = (await db.execute(
        select(CampaignPost).where(CampaignPost.id == post_id, CampaignPost.campaign_id == campaign_id)
    )).scalar_one_or_none()
    if not post:
        raise NotFoundError("Post not found.")

    all_posts = (await db.execute(
        select(CampaignPost).where(CampaignPost.campaign_id == campaign_id)
    )).scalars().all()
    post_index = next((i for i, p in enumerate(all_posts) if p.id == post_id), 0)

    from app.services.campaign_engine import generate_post_content
    content, hashtags = await generate_post_content(campaign, post.platform, post_index, len(all_posts))
    post.content  = content
    post.hashtags = hashtags
    await db.flush()
    return AutomationPostResponse.model_validate(post)


# ── Internal helper ───────────────────────────────────────────────────────────

async def _build_detail_response(
    campaign: Campaign,
    posts: list,
    sa,
) -> AutomationCampaignDetailResponse:
    scheduled   = sum(1 for p in posts if p.status == "scheduled")
    generating  = sum(1 for p in posts if p.status == "generating")
    published   = sum(1 for p in posts if p.status == "published")
    failed      = sum(1 for p in posts if p.status in ("failed",))
    total       = len(posts)
    remaining   = total - published - failed
    progress    = round((published / total * 100) if total else 0, 1)

    return AutomationCampaignDetailResponse(
        id=campaign.id,
        name=campaign.name,
        campaign_goal=campaign.campaign_goal,
        description=campaign.description,
        target_audience=campaign.target_audience,
        platforms=campaign.platforms or [],
        frequency=campaign.frequency,
        post_time=campaign.post_time,
        post_days=campaign.post_days,
        tone=campaign.tone,
        keywords=campaign.keywords,
        target_hashtags=campaign.target_hashtags,
        cta=campaign.cta,
        generate_images=campaign.generate_images,
        status=campaign.status,
        start_date=campaign.start_date,
        end_date=campaign.end_date,
        total_posts=total,
        published_posts=published,
        social_account_id=campaign.social_account_id,
        social_account_platform=sa.platform if sa else None,
        social_account_name=sa.account_name if sa else None,
        created_at=campaign.created_at,
        posts_scheduled=scheduled,
        posts_generating=generating,
        posts_published=published,
        posts_failed=failed,
        posts_remaining=remaining,
        progress_pct=progress,
        posts=[AutomationPostResponse.model_validate(p) for p in posts],
    )
