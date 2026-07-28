"""
Authentication routes: register, login, refresh, logout, me, password reset,
and Facebook OAuth (sign-in / sign-up via Meta).
"""
import logging
import re
import secrets
import uuid
import uuid as _uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
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
    UserProfileUpdate,
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


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's full_name."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    await db.flush()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Store a password reset token in Redis (TTL 1 h) and log it."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user:
        reset_token = secrets.token_urlsafe(32)
        redis_key = f"pwd_reset:{reset_token}"
        await redis.set(redis_key, str(user.id), ex=3600)
        logger.info(
            "Password reset token stored",
            user_id=str(user.id),
            reset_token=reset_token,  # Remove/email in production
        )
    # Always return 202 to prevent email enumeration
    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Validate the reset token from Redis and update the user's password."""
    redis_key = f"pwd_reset:{payload.token}"
    user_id_bytes = await redis.get(redis_key)
    if not user_id_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )
    user_id = user_id_bytes.decode() if isinstance(user_id_bytes, bytes) else user_id_bytes
    user_result = await db.execute(select(User).where(User.id == _uuid.UUID(user_id)))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found.")
    user.hashed_password = get_password_hash(payload.new_password)
    await db.flush()
    await redis.delete(redis_key)
    logger.info("Password reset successful", user_id=user_id)
    return {"message": "Password updated successfully."}


# ── Facebook OAuth (Sign in / Sign up) ───────────────────────────────────────

@router.get("/facebook")
async def facebook_login_start():
    """
    Step 1 — Return the Facebook OAuth URL.
    Frontend redirects the user to auth_url.
    Scopes: email + public_profile only (no page permissions here).
    """
    if not settings.META_APP_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Facebook login is not configured on this server.",
        )
    state = secrets.token_urlsafe(16)
    params = urlencode({
        "client_id":     settings.META_APP_ID,
        "redirect_uri":  settings.FACEBOOK_AUTH_REDIRECT_URI,
        "scope":         "email,public_profile",
        "response_type": "code",
        "state":         state,
    })
    return {
        "auth_url": f"https://www.facebook.com/v19.0/dialog/oauth?{params}",
        "state": state,
    }


@router.get("/facebook/callback")
async def facebook_login_callback(
    code:         Optional[str] = Query(None),
    state:        Optional[str] = Query(None),
    error:        Optional[str] = Query(None),
    error_reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 — Meta calls this after the user authorises.
    • Exchanges code for access token
    • Fetches email + name from Graph API /me
    • Finds existing Brandora user by email → logs them in
    • Or creates a new user + organisation automatically → sends to onboarding
    • Redirects browser to FRONTEND_URL/auth/callback?access_token=…&refresh_token=…&is_new=0/1
    """
    frontend = settings.FRONTEND_URL.rstrip("/")

    if error or not code:
        return RedirectResponse(
            url=f"{frontend}/login?fb_error={error or 'cancelled'}",
            status_code=302,
        )

    async with httpx.AsyncClient(timeout=20) as client:
        # Exchange code → user access token
        token_res = await client.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id":     settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "redirect_uri":  settings.FACEBOOK_AUTH_REDIRECT_URI,
                "code":          code,
            },
        )
        if token_res.status_code != 200:
            logger.error("Facebook token exchange failed", body=token_res.text)
            return RedirectResponse(
                url=f"{frontend}/login?fb_error=token_failed", status_code=302
            )
        fb_access_token = token_res.json().get("access_token")

        # Get email + name from Graph API
        me_res = await client.get(
            "https://graph.facebook.com/v19.0/me",
            params={"fields": "id,name,email", "access_token": fb_access_token},
        )
        fb_data = me_res.json()

    fb_email = fb_data.get("email")
    fb_name  = fb_data.get("name", "Facebook User")

    if not fb_email:
        # User has no email on Facebook (rare) or denied email permission
        return RedirectResponse(
            url=f"{frontend}/login?fb_error=no_email", status_code=302
        )

    # ── Find or create user ──────────────────────────────────────────────────
    existing = await db.execute(select(User).where(User.email == fb_email))
    user: User | None = existing.scalar_one_or_none()
    is_new = user is None

    if user:
        # Existing account → log in
        user.last_login_at = datetime.now(timezone.utc)
        membership_r = await db.execute(
            select(UserOrganizationMembership)
            .where(
                UserOrganizationMembership.user_id == user.id,
                UserOrganizationMembership.is_active == True,
            )
            .limit(1)
        )
        membership = membership_r.scalar_one_or_none()
        if not membership:
            return RedirectResponse(url=f"{frontend}/login?fb_error=no_org", status_code=302)
        org_r = await db.execute(
            select(Organization).where(Organization.id == membership.organization_id)
        )
        org: Organization = org_r.scalar_one()

    else:
        # New user → create account + organisation
        random_pw = secrets.token_urlsafe(32)   # Never used; they'll always log in via FB
        base_slug = _slugify(fb_name)[:72]
        slug = base_slug + "-" + str(_uuid.uuid4())[:8]

        org = Organization(
            id=uuid.uuid4(),
            name=f"{fb_name}'s Organization",
            slug=slug,
            sector="other",
            subscription_tier="free",
            ai_generations_limit=settings.MAX_GENERATIONS_FREE_TIER,
        )
        db.add(org)

        user = User(
            id=uuid.uuid4(),
            email=fb_email,
            hashed_password=get_password_hash(random_pw),
            full_name=fb_name,
            is_active=True,
            is_verified=True,   # Facebook has verified the email
        )
        db.add(user)

        db.add(UserOrganizationMembership(
            id=uuid.uuid4(),
            user_id=user.id,
            organization_id=org.id,
            role="admin",
            is_active=True,
        ))
        await db.flush()

    # ── Build JWT tokens ─────────────────────────────────────────────────────
    token_data = _build_token_response(user, org)
    redirect_params = urlencode({
        "access_token":  token_data.access_token,
        "refresh_token": token_data.refresh_token,
        "is_new":        "1" if is_new else "0",
    })
    logger.info("Facebook login success", user_id=str(user.id), is_new=is_new)
    return RedirectResponse(
        url=f"{frontend}/auth/callback?{redirect_params}",
        status_code=302,
    )
