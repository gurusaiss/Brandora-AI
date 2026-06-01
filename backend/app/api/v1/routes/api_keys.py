"""
API key management routes.
"""
import hashlib
import secrets
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import AuthorizationError, NotFoundError
from app.schemas.api_key import ApiKey
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ApiKeyCreateRequest(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_preview: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(BaseModel):
    id: uuid.UUID
    name: str
    key: str
    key_preview: str
    created_at: datetime


# ── Shared helper ─────────────────────────────────────────────────────────────

async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    """Return the active organization for the current user."""
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
    org = org_result.scalar_one_or_none()
    if not org:
        raise NotFoundError("Organization not found.")
    return org


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active API keys for the current user's organization."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.organization_id == org.id,
            ApiKey.is_active == True,
        )
    )
    keys = result.scalars().all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new API key for the current user's organization.
    The full key is returned exactly once — store it securely.
    """
    org = await _get_user_org(current_user, db)

    # Generate the raw key
    raw_key: str = "bai_" + secrets.token_urlsafe(32)

    # Hash for storage (SHA-256 hex digest)
    key_hash: str = hashlib.sha256(raw_key.encode()).hexdigest()

    # Preview: first 7 chars + "..." + last 4 chars
    key_preview: str = raw_key[:7] + "..." + raw_key[-4:]

    api_key = ApiKey(
        organization_id=org.id,
        name=payload.name,
        key_hash=key_hash,
        key_preview=key_preview,
        is_active=True,
    )
    db.add(api_key)
    await db.flush()

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key=raw_key,
        key_preview=api_key.key_preview,
        created_at=api_key.created_at,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke (soft-delete) an API key by setting is_active=False."""
    org = await _get_user_org(current_user, db)

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.organization_id == org.id,
        )
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise NotFoundError("API key not found.")

    api_key.is_active = False
    await db.flush()
    return None
