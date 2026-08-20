"""
Festival calendar routes.
"""
import uuid
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import Festival
from app.schemas.user import User
from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()


class FestivalResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    date: date
    category: str
    relevant_sectors: Optional[List[str]]
    suggested_hashtags: Optional[List[str]]
    country: str

    model_config = {"from_attributes": True}


class FestivalContentRequest(BaseModel):
    platform: str = "linkedin"
    tone: str = "inspirational"
    context: Optional[str] = None


@router.get("", response_model=List[FestivalResponse])
async def list_festivals(
    country: str = Query("IN"),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all festivals sorted by upcoming date."""
    today = date.today()
    query = select(Festival).where(
        Festival.country == country,
        Festival.date >= today,
    )
    if category:
        query = query.where(Festival.category == category)
    query = query.order_by(Festival.date.asc())
    result = await db.execute(query)
    return [FestivalResponse.model_validate(f) for f in result.scalars().all()]


@router.get("/upcoming", response_model=List[FestivalResponse])
async def upcoming_festivals(
    country: str = Query("IN"),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Return festivals in the next N days (default 30)."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(Festival)
        .where(
            Festival.country == country,
            Festival.date >= today,
            Festival.date <= cutoff,
        )
        .order_by(Festival.date.asc())
    )
    return [FestivalResponse.model_validate(f) for f in result.scalars().all()]


@router.get("/{festival_id}", response_model=FestivalResponse)
async def get_festival(festival_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Fetch a single festival by ID."""
    result = await db.execute(select(Festival).where(Festival.id == festival_id))
    festival = result.scalar_one_or_none()
    if not festival:
        raise NotFoundError(f"Festival {festival_id} not found.")
    return FestivalResponse.model_validate(festival)


@router.post("/{festival_id}/generate-content", status_code=status.HTTP_201_CREATED)
async def generate_festival_content(
    festival_id: uuid.UUID,
    payload: FestivalContentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate social media content for a specific festival."""
    from app.api.v1.routes.content import _get_org_for_user, _get_brand_profile, _check_rate_limit
    from app.schemas.content import ContentGeneration

    result = await db.execute(select(Festival).where(Festival.id == festival_id))
    festival = result.scalar_one_or_none()
    if not festival:
        raise NotFoundError(f"Festival {festival_id} not found.")

    org = await _get_org_for_user(current_user, db)
    _check_rate_limit(org)
    brand_profile = await _get_brand_profile(org.id, db)

    topic = f"{festival.name} — {festival.description or 'Festival campaign'}"
    context = payload.context or f"Relevant sectors: {', '.join(festival.relevant_sectors or [])}"

    ai_result = await ai_service.generate_content(
        topic=topic,
        platform=payload.platform,
        brand_profile=brand_profile,
        tone=payload.tone,
        context=context,
        campaign_brief=f"Festival: {festival.name} on {festival.date}",
    )

    generation = ContentGeneration(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=current_user.id,
        input_topic=topic,
        platform=payload.platform,
        tone=payload.tone,
        generated_content=ai_result["content"],
        hashtags=ai_result.get("hashtags", festival.suggested_hashtags or []),
        quality_score=ai_result.get("quality_score"),
        ai_model_used=ai_result["model"],
        tokens_used=ai_result.get("tokens_used", 0),
    )
    db.add(generation)
    org.ai_generations_used = (org.ai_generations_used or 0) + 1
    await db.flush()

    return {
        "generation_id": str(generation.id),
        "festival": festival.name,
        "platform": payload.platform,
        "content": ai_result["content"],
        "hashtags": generation.hashtags,
        "quality_score": generation.quality_score,
        "model": ai_result["model"],
    }
