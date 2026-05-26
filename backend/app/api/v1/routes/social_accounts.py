"""
Social account connection routes (OAuth flow stubs).
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import SocialAccount
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

router = APIRouter()


class SocialAccountResponse(BaseModel):
    id: uuid.UUID
    platform: str
    account_id: str
    account_name: Optional[str]
    is_active: bool

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


@router.get("/", response_model=List[SocialAccountResponse])
async def list_social_accounts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all connected social accounts for the organization."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.organization_id == org.id,
            SocialAccount.is_active == True,
        )
    )
    return [SocialAccountResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/connect/linkedin")
async def connect_linkedin(current_user: User = Depends(get_current_active_user)):
    """Return LinkedIn OAuth authorization URL."""
    auth_url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={settings.LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={settings.BACKEND_URL}/api/v1/social-accounts/callback/linkedin"
        f"&scope=r_liteprofile%20r_emailaddress%20w_member_social"
        f"&state={current_user.id}"
    )
    return {"auth_url": auth_url}


@router.get("/connect/twitter")
async def connect_twitter(current_user: User = Depends(get_current_active_user)):
    """Return Twitter OAuth2 authorization URL."""
    auth_url = (
        "https://twitter.com/i/oauth2/authorize"
        "?response_type=code"
        f"&client_id={settings.TWITTER_API_KEY}"
        f"&redirect_uri={settings.BACKEND_URL}/api/v1/social-accounts/callback/twitter"
        "&scope=tweet.read%20tweet.write%20users.read%20offline.access"
        f"&state={current_user.id}"
        "&code_challenge=challenge&code_challenge_method=plain"
    )
    return {"auth_url": auth_url}


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_social_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect (deactivate) a social account."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id,
            SocialAccount.organization_id == org.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError(f"Social account {account_id} not found.")
    account.is_active = False
    await db.flush()
