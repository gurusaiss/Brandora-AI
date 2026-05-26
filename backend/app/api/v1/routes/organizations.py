"""
Organization management routes.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import AuthorizationError, NotFoundError
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None
    website: Optional[str] = None
    sector: Optional[str] = None
    subscription_tier: Optional[str] = None


class MemberInviteRequest(BaseModel):
    email: str
    role: str = Field("editor", description="admin/editor/viewer")


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    logo_url: Optional[str]
    website: Optional[str]
    sector: str
    subscription_tier: str
    ai_generations_used: int
    ai_generations_limit: int

    model_config = {"from_attributes": True}


async def _get_user_org_with_role(user: User, db: AsyncSession):
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
    org_result = await db.execute(
        select(Organization).where(Organization.id == m.organization_id)
    )
    return org_result.scalar_one(), m.role


@router.get("/me", response_model=OrganizationResponse)
async def get_my_organization(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's primary organization."""
    org, _ = await _get_user_org_with_role(current_user, db)
    return OrganizationResponse.model_validate(org)


@router.put("/me", response_model=OrganizationResponse)
async def update_my_organization(
    payload: OrganizationUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the organization (admin only)."""
    org, role = await _get_user_org_with_role(current_user, db)
    if role != "admin":
        raise AuthorizationError("Only organization admins can update organization settings.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    await db.flush()
    return OrganizationResponse.model_validate(org)


@router.get("/me/members")
async def list_members(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active members of the organization."""
    from app.schemas.user import User as UserModel

    org, _ = await _get_user_org_with_role(current_user, db)
    result = await db.execute(
        select(UserOrganizationMembership, UserModel)
        .join(UserModel, UserModel.id == UserOrganizationMembership.user_id)
        .where(
            UserOrganizationMembership.organization_id == org.id,
            UserOrganizationMembership.is_active == True,
        )
    )
    rows = result.all()
    return [
        {
            "user_id": str(row.User.id),
            "email": row.User.email,
            "full_name": row.User.full_name,
            "role": row.UserOrganizationMembership.role,
            "joined_at": row.UserOrganizationMembership.created_at.isoformat(),
        }
        for row in rows
    ]
