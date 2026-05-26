"""
Brand profile routes: get, update, voice analysis.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.models.brand_profile import (
    BrandProfileResponse,
    BrandProfileUpdateRequest,
    VoiceAnalyzeRequest,
    VoiceAnalysisResponse,
)
from app.schemas.brand_profile import BrandProfile
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership
from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()


async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    membership_result = await db.execute(
        select(UserOrganizationMembership)
        .where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,
        )
        .limit(1)
    )
    m = membership_result.scalar_one_or_none()
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No active organization found.")
    org_result = await db.execute(select(Organization).where(Organization.id == m.organization_id))
    return org_result.scalar_one()


async def _get_or_create_profile(org: Organization, db: AsyncSession) -> BrandProfile:
    result = await db.execute(
        select(BrandProfile).where(BrandProfile.organization_id == org.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = BrandProfile(
            id=uuid.uuid4(),
            organization_id=org.id,
            organization_name=org.name,
            tone_professional=7,
            tone_warm=7,
            tone_inspirational=6,
            tone_educational=7,
            tone_urgent=4,
        )
        db.add(profile)
        await db.flush()
    return profile


@router.get("/", response_model=BrandProfileResponse)
async def get_brand_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the organization's brand profile, creating a default if none exists."""
    org = await _get_user_org(current_user, db)
    profile = await _get_or_create_profile(org, db)
    return BrandProfileResponse.model_validate(profile)


@router.put("/", response_model=BrandProfileResponse)
async def update_brand_profile(
    payload: BrandProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the organization's brand profile."""
    org = await _get_user_org(current_user, db)
    profile = await _get_or_create_profile(org, db)

    # Apply non-null updates
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.flush()
    return BrandProfileResponse.model_validate(profile)


@router.post("/voice/analyze", response_model=VoiceAnalysisResponse)
async def analyze_brand_voice(
    payload: VoiceAnalyzeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze sample posts to extract brand voice dimensions.
    Optionally updates the stored profile.
    """
    org = await _get_user_org(current_user, db)
    profile = await _get_or_create_profile(org, db)

    analysis = await ai_service.analyze_brand_voice(payload.sample_posts)

    # Auto-update tone dimensions from analysis
    profile.tone_professional = analysis.get("tone_professional", profile.tone_professional)
    profile.tone_warm = analysis.get("tone_warm", profile.tone_warm)
    profile.tone_inspirational = analysis.get("tone_inspirational", profile.tone_inspirational)
    profile.tone_educational = analysis.get("tone_educational", profile.tone_educational)
    profile.tone_urgent = analysis.get("tone_urgent", profile.tone_urgent)
    if analysis.get("vocabulary_suggestions"):
        profile.custom_vocabulary = analysis["vocabulary_suggestions"]
    if analysis.get("avoid_words"):
        profile.avoid_words = analysis["avoid_words"]

    await db.flush()

    return VoiceAnalysisResponse(
        tone_professional=analysis.get("tone_professional", 7),
        tone_warm=analysis.get("tone_warm", 7),
        tone_inspirational=analysis.get("tone_inspirational", 6),
        tone_educational=analysis.get("tone_educational", 7),
        tone_urgent=analysis.get("tone_urgent", 4),
        vocabulary_suggestions=analysis.get("vocabulary_suggestions", []),
        avoid_words=analysis.get("avoid_words", []),
        summary=analysis.get("summary", "Voice analysis completed."),
    )
