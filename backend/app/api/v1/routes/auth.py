"""
Authentication routes: register, login, refresh, logout, me, password reset.
"""
import logging
import re
import uuid
import uuid as _uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db, get_redis
from app.core.exceptions import AuthenticationError, ValidationError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from app.models.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    OrganizationBriefResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

logger = logging.getLogger("brandora.auth")
router = APIRouter()


def _slugify(text: str) -> str:
    """Simple slug generator from org name."""
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug)
    return slug[:80]


def _build_token_response(user: User, org: Organization) -> TokenResponse:
    access_token = create_access_token({"sub": str(user.id), "org_id": str(org.id)})
    refresh_token = create_refresh_token({"sub": str(user.id), "org_id": str(org.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
        organization=OrganizationBriefResponse.model_validate(org),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user and create their organization."""
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise ValidationError("An account with this email already exists.")

    # Create unique slug (uuid suffix guarantees uniqueness without any DB queries)
    base_slug = _slugify(payload.organization_name)[:72]
    slug = base_slug + "-" + str(_uuid.uuid4())[:8]

    # Determine generation limit based on tier
    generation_limit = settings.MAX_GENERATIONS_FREE_TIER

    # Create org
    org = Organization(
        id=uuid.uuid4(),
        name=payload.organization_name,
        slug=slug,
        sector=payload.sector or "other",
        subscription_tier="free",
        ai_generations_limit=generation_limit,
    )
    db.add(org)

    # Create user
    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        is_active=True,
        is_verified=False,
    )
    db.add(user)

    # Create membership (admin)
    membership = UserOrganizationMembership(
        id=uuid.uuid4(),
        user_id=user.id,
        organization_id=org.id,
        role="admin",
        is_active=True,
    )
    db.add(membership)

    await db.flush()
    logger.info("New user registered", user_id=str(user.id), org_id=str(org.id))
    return _build_token_response(user, org)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user credentials and return tokens."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user: User | None = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise AuthenticationError("Invalid email or password.")

    if not user.is_active:
        raise AuthenticationError("Your account is deactivated.")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)

    # Get primary org membership
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
        raise AuthenticationError("No active organization found for this account.")

    org_result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    org: Organization = org_result.scalar_one()

    logger.info("User logged in", user_id=str(user.id))
    return _build_token_response(user, org)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    token_data = verify_token(payload.refresh_token, expected_type="refresh")
    user_id = token_data.get("sub")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user: User | None = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise AuthenticationError("Invalid refresh token.")

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
        raise AuthenticationError("No active organization found.")

    org_result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    org: Organization = org_result.scalar_one()
    return _build_token_response(user, org)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(get_current_active_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Invalidate the current access token via Redis blacklist."""
    # The token itself is blacklisted by the X-Access-Token header value.
    # In practice the token is parsed from the Authorization header upstream.
    # We store a blacklist entry keyed by user to cover all tokens.
    await redis.setex(
        f"blacklist:user:{current_user.id}",
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "1",
    )
    logger.info("User logged out", user_id=str(current_user.id))
    return


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Return the authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Trigger password reset email (logs token; real email TBD)."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user:
        import secrets

        reset_token = secrets.token_urlsafe(32)
        # TODO: store in Redis with TTL=1h and send email
        logger.info(
            "Password reset requested",
            user_id=str(user.id),
            reset_token=reset_token,  # Remove in production
        )
    # Always return 202 to prevent email enumeration
    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Reset password using a valid reset token."""
    # TODO: look up token in Redis, find user_id, update hashed_password
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset via token not yet implemented — use Supabase Auth.",
    )
