"""
Hashtag generation and set management routes.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import HashtagSet
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership
from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()


class HashtagGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=300)
    platform: str = Field("linkedin", description="Target platform")
    content: Optional[str] = Field(None, max_length=2000, description="Generated content to extract hashtags from")


class HashtagSetCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    platform: Optional[str] = None
    hashtags: List[str] = Field(..., min_length=1)


class HashtagSetResponse(BaseModel):
    id: uuid.UUID
    name: str
    platform: Optional[str]
    hashtags: List[str]

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


@router.post("/generate")
async def generate_hashtags(
    payload: HashtagGenerateRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Generate relevant hashtags for a topic and platform using AI."""
    hashtags = await ai_service.generate_hashtags(
        topic=payload.topic,
        platform=payload.platform,
        content=payload.content or "",
    )
    return {"hashtags": hashtags, "count": len(hashtags)}


@router.get("/sets", response_model=List[HashtagSetResponse])
async def list_hashtag_sets(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved hashtag sets for the organization."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(HashtagSet).where(HashtagSet.organization_id == org.id).order_by(HashtagSet.created_at.desc())
    )
    return [HashtagSetResponse.model_validate(h) for h in result.scalars().all()]


@router.post("/sets", response_model=HashtagSetResponse, status_code=status.HTTP_201_CREATED)
async def create_hashtag_set(
    payload: HashtagSetCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a named hashtag set for the organization."""
    org = await _get_user_org(current_user, db)
    hs = HashtagSet(
        id=uuid.uuid4(),
        organization_id=org.id,
        name=payload.name,
        platform=payload.platform,
        hashtags=payload.hashtags,
    )
    db.add(hs)
    await db.flush()
    return HashtagSetResponse.model_validate(hs)


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hashtag_set(
    set_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved hashtag set."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(HashtagSet).where(HashtagSet.id == set_id, HashtagSet.organization_id == org.id)
    )
    hs = result.scalar_one_or_none()
    if not hs:
        raise NotFoundError(f"Hashtag set {set_id} not found.")
    await db.delete(hs)
    await db.flush()
