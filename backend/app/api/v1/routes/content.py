"""
Content generation routes.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError, RateLimitError
from app.models.content import (
    ContentFeedbackRequest,
    ContentGenerateRequest,
    ContentGenerateResponse,
    ContentListResponse,
    ContentRepurposeRequest,
    ContentRepurposeResponse,
)
from app.schemas.brand_profile import BrandProfile
from app.schemas.campaign import Campaign, CampaignPost
from app.schemas.content import ContentGeneration
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership
from app.services.ai_service import AIService


# ── Inline request/response models for new endpoints ─────────────────────────

class LinkToCampaignRequest(BaseModel):
    campaign_id: uuid.UUID


class ScheduleContentRequest(BaseModel):
    scheduled_at: datetime
    platform: Optional[str] = None


class ScheduledPostResponse(BaseModel):
    id: uuid.UUID
    platform: str
    content: str
    hashtags: Optional[list] = None
    scheduled_at: Optional[datetime] = None
    status: str
    campaign_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}

router = APIRouter()
ai_service = AIService()


async def _get_org_for_user(user: User, db: AsyncSession) -> Organization:
    """Fetch the user's primary active organization."""
    membership_result = await db.execute(
        select(UserOrganizationMembership)
        .where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,
        )
        .limit(1)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="No active organization found.")

    org_result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    return org_result.scalar_one()


async def _get_brand_profile(org_id: uuid.UUID, db: AsyncSession) -> BrandProfile | None:
    result = await db.execute(
        select(BrandProfile).where(BrandProfile.organization_id == org_id)
    )
    return result.scalar_one_or_none()


def _check_rate_limit(org: Organization) -> None:
    """Raise RateLimitError if the org has exceeded its generation limit."""
    if org.ai_generations_used >= org.ai_generations_limit:
        raise RateLimitError(
            f"You have used all {org.ai_generations_limit} AI generations "
            f"for your {org.subscription_tier} plan this period."
        )


@router.post("/generate", response_model=ContentGenerateResponse, status_code=status.HTTP_201_CREATED)
async def generate_content(
    payload: ContentGenerateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI content for a given topic and platform."""
    org = await _get_org_for_user(current_user, db)
    _check_rate_limit(org)
    brand_profile = await _get_brand_profile(org.id, db)

    result = await ai_service.generate_content(
        topic=payload.topic,
        platform=payload.platform,
        brand_profile=brand_profile,
        tone=payload.tone or "professional",
        context=payload.context,
        campaign_brief=payload.campaign_brief,
        language=payload.language or "en",
        model_override=payload.model_override,
    )

    generation = ContentGeneration(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        input_topic=payload.topic,
        input_context=payload.context,
        campaign_brief=payload.campaign_brief,
        platform=payload.platform,
        tone=payload.tone or "professional",
        generated_content=result["content"],
        hashtags=result.get("hashtags", []),
        quality_score=result.get("quality_score"),
        ai_model_used=result["model"],
        tokens_used=result.get("tokens_used", 0),
        campaign_id=payload.campaign_id,
        language=payload.language or "en",
    )
    db.add(generation)

    # Increment usage counter
    org.ai_generations_used = (org.ai_generations_used or 0) + 1
    await db.flush()

    return ContentGenerateResponse(
        id=generation.id,
        platform=generation.platform,
        generated_content=generation.generated_content,
        hashtags=generation.hashtags or [],
        quality_score=generation.quality_score,
        ai_model_used=generation.ai_model_used,
        tokens_used=generation.tokens_used,
        is_saved=generation.is_saved,
        feedback=generation.feedback,
        campaign_id=generation.campaign_id,
        created_at=generation.created_at,
    )


@router.post("/repurpose", response_model=ContentRepurposeResponse, status_code=status.HTTP_201_CREATED)
async def repurpose_content(
    payload: ContentRepurposeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Repurpose an existing piece of content for multiple platforms."""
    # Fetch source
    result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == payload.content_id,
            ContentGeneration.is_deleted == False,
        )
    )
    source: ContentGeneration | None = result.scalar_one_or_none()
    if not source:
        raise NotFoundError(f"Content {payload.content_id} not found.")

    org = await _get_org_for_user(current_user, db)
    _check_rate_limit(org)
    brand_profile = await _get_brand_profile(org.id, db)

    repurposed_data = await ai_service.repurpose_content(
        original_content=source.generated_content,
        original_platform=source.platform,
        target_platforms=payload.target_platforms,
        brand_profile=brand_profile,
    )

    responses = []
    for item in repurposed_data:
        gen = ContentGeneration(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=current_user.id,
            input_topic=source.input_topic,
            platform=item["platform"],
            tone=source.tone,
            generated_content=item["content"],
            hashtags=item.get("hashtags", []),
            quality_score=item.get("quality_score"),
            ai_model_used=item["model"],
            tokens_used=item.get("tokens_used", 0),
            is_repurposed=True,
            parent_generation_id=source.id,
            campaign_id=source.campaign_id,
        )
        db.add(gen)
        org.ai_generations_used = (org.ai_generations_used or 0) + 1
        responses.append(
            ContentGenerateResponse(
                id=gen.id,
                platform=gen.platform,
                generated_content=gen.generated_content,
                hashtags=gen.hashtags or [],
                quality_score=gen.quality_score,
                ai_model_used=gen.ai_model_used,
                tokens_used=gen.tokens_used,
                is_saved=False,
                parent_generation_id=source.id,
                created_at=gen.created_at,
            )
        )

    source.is_repurposed = True
    await db.flush()

    return ContentRepurposeResponse(original_id=source.id, repurposed=responses)


@router.get("/history", response_model=ContentListResponse)
async def list_content(
    platform: str | None = Query(None, description="Filter by platform"),
    is_saved: bool | None = Query(None, description="Filter by saved state"),
    campaign_id: uuid.UUID | None = Query(None, description="Filter by campaign"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated content generation history with optional filters.

    Returns a truncated preview (300 chars) of generated_content for list performance.
    Filters: platform, is_saved, campaign_id.
    Ordered by created_at DESC (newest first).
    """
    org = await _get_org_for_user(current_user, db)

    query = select(ContentGeneration).where(
        ContentGeneration.organization_id == org.id,
        ContentGeneration.is_deleted == False,
    )
    if platform:
        query = query.where(ContentGeneration.platform == platform)
    if is_saved is not None:
        query = query.where(ContentGeneration.is_saved == is_saved)
    if campaign_id:
        query = query.where(ContentGeneration.campaign_id == campaign_id)

    # Total count
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    # Paginated results — newest first
    query = (
        query.order_by(ContentGeneration.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items_result = await db.execute(query)
    items = items_result.scalars().all()

    def _truncate(text: str, limit: int = 300) -> str:
        return text[:limit] + "…" if len(text) > limit else text

    return ContentListResponse(
        items=[
            ContentGenerateResponse(
                id=i.id,
                platform=i.platform,
                # Truncate to 300 chars for list-view performance
                generated_content=_truncate(i.generated_content),
                hashtags=i.hashtags or [],
                quality_score=i.quality_score,
                ai_model_used=i.ai_model_used,
                tokens_used=i.tokens_used,
                is_saved=i.is_saved,
                feedback=i.feedback,
                parent_generation_id=i.parent_generation_id,
                campaign_id=i.campaign_id,
                created_at=i.created_at,
            )
            for i in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{content_id}", response_model=ContentGenerateResponse)
async def get_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single content generation by ID."""
    org = await _get_org_for_user(current_user, db)
    result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == content_id,
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise NotFoundError(f"Content {content_id} not found.")

    return ContentGenerateResponse(
        id=gen.id,
        platform=gen.platform,
        generated_content=gen.generated_content,
        hashtags=gen.hashtags or [],
        quality_score=gen.quality_score,
        ai_model_used=gen.ai_model_used,
        tokens_used=gen.tokens_used,
        is_saved=gen.is_saved,
        feedback=gen.feedback,
        parent_generation_id=gen.parent_generation_id,
        campaign_id=gen.campaign_id,
        created_at=gen.created_at,
    )


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a content generation."""
    org = await _get_org_for_user(current_user, db)
    result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == content_id,
            ContentGeneration.organization_id == org.id,
        )
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise NotFoundError(f"Content {content_id} not found.")
    gen.is_deleted = True
    await db.flush()


@router.post("/{content_id}/save", response_model=ContentGenerateResponse)
async def toggle_save(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the saved state of a content generation."""
    org = await _get_org_for_user(current_user, db)
    result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == content_id,
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise NotFoundError(f"Content {content_id} not found.")
    gen.is_saved = not gen.is_saved
    await db.flush()

    return ContentGenerateResponse(
        id=gen.id,
        platform=gen.platform,
        generated_content=gen.generated_content,
        hashtags=gen.hashtags or [],
        quality_score=gen.quality_score,
        ai_model_used=gen.ai_model_used,
        tokens_used=gen.tokens_used,
        is_saved=gen.is_saved,
        feedback=gen.feedback,
        parent_generation_id=gen.parent_generation_id,
        campaign_id=gen.campaign_id,
        created_at=gen.created_at,
    )


@router.post("/{content_id}/feedback", response_model=ContentGenerateResponse)
async def record_feedback(
    content_id: uuid.UUID,
    payload: ContentFeedbackRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Record thumbs up/down feedback on generated content."""
    org = await _get_org_for_user(current_user, db)
    result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == content_id,
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
    )
    gen = result.scalar_one_or_none()
    if not gen:
        raise NotFoundError(f"Content {content_id} not found.")
    gen.feedback = payload.feedback
    await db.flush()

    return ContentGenerateResponse(
        id=gen.id,
        platform=gen.platform,
        generated_content=gen.generated_content,
        hashtags=gen.hashtags or [],
        quality_score=gen.quality_score,
        ai_model_used=gen.ai_model_used,
        tokens_used=gen.tokens_used,
        is_saved=gen.is_saved,
        feedback=gen.feedback,
        parent_generation_id=gen.parent_generation_id,
        campaign_id=gen.campaign_id,
        created_at=gen.created_at,
    )


@router.post("/{content_id}/use-in-campaign")
async def use_in_campaign(
    content_id: uuid.UUID,
    payload: LinkToCampaignRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Link a content generation to a campaign.

    Creates a CampaignPost record and updates the generation's campaign_id.
    Both the content and the target campaign must belong to the user's organisation.
    """
    org = await _get_org_for_user(current_user, db)

    # Verify content ownership
    gen_result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == content_id,
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
    )
    generation = gen_result.scalar_one_or_none()
    if not generation:
        raise HTTPException(status_code=404, detail=f"Content {content_id} not found.")

    # Verify campaign ownership
    campaign_result = await db.execute(
        select(Campaign).where(
            Campaign.id == payload.campaign_id,
            Campaign.organization_id == org.id,
        )
    )
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign {payload.campaign_id} not found.",
        )

    # Update generation's campaign association
    generation.campaign_id = payload.campaign_id

    # Create CampaignPost linking the content to the campaign
    campaign_post = CampaignPost(
        id=uuid.uuid4(),
        campaign_id=payload.campaign_id,
        content_generation_id=content_id,
        platform=generation.platform,
        content=generation.generated_content,
        hashtags=generation.hashtags or [],
        status="draft",
    )
    db.add(campaign_post)
    await db.flush()

    return {"message": "Content linked to campaign", "campaign_id": str(payload.campaign_id)}


@router.post("/{content_id}/schedule", response_model=ScheduledPostResponse, status_code=status.HTTP_201_CREATED)
async def schedule_content(
    content_id: uuid.UUID,
    payload: ScheduleContentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Schedule a content generation for publishing.

    Creates a CampaignPost with status='scheduled' at the requested datetime.
    If no platform is given, the generation's original platform is used.
    If the generation already has a campaign_id, the post is linked to that campaign;
    otherwise a default 'Scheduled Posts' campaign is found-or-created.
    """
    org = await _get_org_for_user(current_user, db)

    # Verify content ownership
    gen_result = await db.execute(
        select(ContentGeneration).where(
            ContentGeneration.id == content_id,
            ContentGeneration.organization_id == org.id,
            ContentGeneration.is_deleted == False,
        )
    )
    generation = gen_result.scalar_one_or_none()
    if not generation:
        raise HTTPException(status_code=404, detail=f"Content {content_id} not found.")

    # Determine platform
    platform = payload.platform or generation.platform

    # Ensure scheduled_at is timezone-aware
    scheduled_at = payload.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    # Resolve target campaign
    if generation.campaign_id:
        campaign_result = await db.execute(
            select(Campaign).where(
                Campaign.id == generation.campaign_id,
                Campaign.organization_id == org.id,
            )
        )
        campaign = campaign_result.scalar_one_or_none()
        if not campaign:
            # campaign was deleted or mismatched — fall through to default
            generation.campaign_id = None
            campaign = None
    else:
        campaign = None

    if campaign is None:
        # Find or create the default "Scheduled Posts" campaign for the org
        default_result = await db.execute(
            select(Campaign)
            .where(
                Campaign.organization_id == org.id,
                Campaign.name == "Scheduled Posts",
            )
            .limit(1)
        )
        campaign = default_result.scalar_one_or_none()
        if not campaign:
            campaign = Campaign(
                id=uuid.uuid4(),
                organization_id=org.id,
                user_id=current_user.id,
                name="Scheduled Posts",
                campaign_type="custom",
                status="active",
            )
            db.add(campaign)
            await db.flush()

    # Create the scheduled CampaignPost
    post = CampaignPost(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        content_generation_id=content_id,
        platform=platform,
        content=generation.generated_content,
        hashtags=generation.hashtags or [],
        scheduled_at=scheduled_at,
        status="scheduled",
    )
    db.add(post)
    await db.flush()

    return ScheduledPostResponse.model_validate(post)
