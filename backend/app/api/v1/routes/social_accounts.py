"""
Social account connection routes.

Supported platforms:
  • Meta  — Facebook Pages + Instagram Business via Graph API v19.0
  • LinkedIn, Twitter — OAuth stubs (URL generation only)

Meta OAuth flow
---------------
1.  GET  /connect/meta
      → returns { auth_url } pointing at https://www.facebook.com/v19.0/dialog/oauth
      → state param encodes the Brandora user_id (base64) for security

2.  GET  /callback/meta?code=…&state=…
      → exchanged short-lived user token for long-lived token (60 days)
      → fetches Facebook Pages the user manages
      → for each Page that has an Instagram Business Account linked, saves that too
      → saves all as SocialAccount rows (platform="facebook_page" / "instagram")
      → HTTP 302 → FRONTEND_URL/settings?meta_connected=true

3.  POST /meta/post
      → posts text (+ optional image) to a connected Facebook Page
      → posts caption (+ required image) to a connected Instagram Business account
"""

import base64
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlencode

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user, get_db
from app.core.exceptions import NotFoundError
from app.schemas.campaign import SocialAccount
from app.schemas.organization import Organization
from app.schemas.user import User, UserOrganizationMembership

logger = structlog.get_logger(__name__)
router = APIRouter()

# ─────────────────────────── Shared helpers ──────────────────────────────────

META_GRAPH = "https://graph.facebook.com/v19.0"
META_OAUTH  = "https://www.facebook.com/v19.0/dialog/oauth"

# Permissions the app requests
META_SCOPES = ",".join([
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "business_management",
])


def _encode_state(user_id: uuid.UUID) -> str:
    """Base64-encode user_id for use as the OAuth `state` param."""
    return base64.urlsafe_b64encode(str(user_id).encode()).decode()


def _decode_state(state: str) -> Optional[uuid.UUID]:
    """Decode the state string back to a user_id UUID."""
    try:
        return uuid.UUID(base64.urlsafe_b64decode(state.encode()).decode())
    except Exception:
        return None


async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    m = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.user_id == user.id,
            UserOrganizationMembership.is_active == True,
        ).limit(1)
    )
    membership = m.scalar_one_or_none()
    if not membership:
        raise NotFoundError("No active organization.")
    org = await db.execute(select(Organization).where(Organization.id == membership.organization_id))
    return org.scalar_one()


async def _get_org_for_user_id(user_id: uuid.UUID, db: AsyncSession) -> Optional[Organization]:
    """Used in the OAuth callback where we only have a user_id."""
    m = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.user_id == user_id,
            UserOrganizationMembership.is_active == True,
        ).limit(1)
    )
    membership = m.scalar_one_or_none()
    if not membership:
        return None
    org = await db.execute(select(Organization).where(Organization.id == membership.organization_id))
    return org.scalar_one_or_none()


# ─────────────────────────── Response schemas ────────────────────────────────

class SocialAccountResponse(BaseModel):
    id: uuid.UUID
    platform: str
    account_id: str
    account_name: Optional[str]
    is_active: bool
    token_expires_at: Optional[datetime]

    model_config = {"from_attributes": True}


class MetaPostRequest(BaseModel):
    account_id: uuid.UUID          # SocialAccount.id in our DB
    message: str                   # caption / post text
    image_url: Optional[str] = None  # public URL; required for Instagram


class MetaPostResponse(BaseModel):
    platform: str
    post_id: str                   # FB post_id or IG media_id
    success: bool


# ─────────────────────────── List / Disconnect ───────────────────────────────

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


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_social_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect (soft-delete) a social account."""
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


# ─────────────────────────── Meta OAuth ──────────────────────────────────────

@router.get("/connect/meta")
async def connect_meta(
    current_user: User = Depends(get_current_active_user),
):
    """
    Step 1 — Return the Facebook OAuth authorization URL.
    The frontend should redirect the user (or open a popup) to auth_url.
    """
    if not settings.META_APP_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="META_APP_ID not configured on this server.",
        )

    state = _encode_state(current_user.id)
    params = urlencode({
        "client_id":     settings.META_APP_ID,
        "redirect_uri":  settings.META_REDIRECT_URI,
        "scope":         META_SCOPES,
        "response_type": "code",
        "state":         state,
    })
    auth_url = f"{META_OAUTH}?{params}"
    return {"auth_url": auth_url, "state": state}


@router.get("/callback/meta")
async def meta_oauth_callback(
    code:  Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 — Meta redirects here after user authorises the app.
    • Exchanges code for a short-lived user token
    • Exchanges that for a long-lived token (60 days)
    • Discovers Facebook Pages and linked Instagram Business accounts
    • Upserts SocialAccount rows
    • Redirects the browser to FRONTEND_URL/settings?meta_connected=true
    """
    frontend_base = settings.FRONTEND_URL.rstrip("/")

    # ── User denied / error ───────────────────────────────────────────────────
    if error or not code:
        logger.warning("Meta OAuth error", error=error, description=error_description)
        return RedirectResponse(
            url=f"{frontend_base}/settings?meta_error={error or 'access_denied'}",
            status_code=302,
        )

    # ── Decode state → user_id ─────────────────────────────────────────────
    if not state:
        return RedirectResponse(url=f"{frontend_base}/settings?meta_error=invalid_state", status_code=302)

    user_id = _decode_state(state)
    if not user_id:
        return RedirectResponse(url=f"{frontend_base}/settings?meta_error=invalid_state", status_code=302)

    org = await _get_org_for_user_id(user_id, db)
    if not org:
        return RedirectResponse(url=f"{frontend_base}/settings?meta_error=no_org", status_code=302)

    async with httpx.AsyncClient(timeout=20) as client:
        # ── Exchange code for short-lived user access token ────────────────
        token_res = await client.get(
            f"{META_GRAPH}/oauth/access_token",
            params={
                "client_id":     settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "redirect_uri":  settings.META_REDIRECT_URI,
                "code":          code,
            },
        )
        if token_res.status_code != 200:
            logger.error("Meta token exchange failed", body=token_res.text)
            return RedirectResponse(
                url=f"{frontend_base}/settings?meta_error=token_exchange_failed", status_code=302
            )
        short_token = token_res.json().get("access_token")

        # ── Exchange short-lived → long-lived user token (60 days) ────────
        ll_res = await client.get(
            f"{META_GRAPH}/oauth/access_token",
            params={
                "grant_type":        "fb_exchange_token",
                "client_id":         settings.META_APP_ID,
                "client_secret":     settings.META_APP_SECRET,
                "fb_exchange_token": short_token,
            },
        )
        ll_data      = ll_res.json()
        long_token   = ll_data.get("access_token", short_token)
        expires_secs = ll_data.get("expires_in", 5183944)  # ~60 days default
        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_secs)

        # ── Fetch Facebook Pages ───────────────────────────────────────────
        pages_res = await client.get(
            f"{META_GRAPH}/me/accounts",
            params={"access_token": long_token, "fields": "id,name,access_token,instagram_business_account"},
        )
        pages_data = pages_res.json().get("data", [])

    saved: list[str] = []

    for page in pages_data:
        page_id    = page.get("id")
        page_name  = page.get("name", "Facebook Page")
        page_token = page.get("access_token", long_token)

        # Upsert Facebook Page account
        existing_fb = await db.execute(
            select(SocialAccount).where(
                SocialAccount.organization_id == org.id,
                SocialAccount.platform        == "facebook_page",
                SocialAccount.account_id      == page_id,
            )
        )
        fb_account = existing_fb.scalar_one_or_none()
        if fb_account:
            fb_account.access_token     = page_token
            fb_account.account_name     = page_name
            fb_account.token_expires_at = token_expires_at
            fb_account.is_active        = True
        else:
            fb_account = SocialAccount(
                organization_id  = org.id,
                platform         = "facebook_page",
                account_id       = page_id,
                account_name     = page_name,
                access_token     = page_token,
                token_expires_at = token_expires_at,
                is_active        = True,
            )
            db.add(fb_account)
        saved.append(f"FB:{page_name}")

        # Instagram Business Account linked to this Page?
        ig_info = page.get("instagram_business_account")
        if ig_info:
            ig_id = ig_info.get("id")
            # Fetch IG username
            async with httpx.AsyncClient(timeout=10) as igc:
                ig_res = await igc.get(
                    f"{META_GRAPH}/{ig_id}",
                    params={"fields": "id,username", "access_token": page_token},
                )
            ig_username = ig_res.json().get("username", "Instagram")

            existing_ig = await db.execute(
                select(SocialAccount).where(
                    SocialAccount.organization_id == org.id,
                    SocialAccount.platform        == "instagram",
                    SocialAccount.account_id      == ig_id,
                )
            )
            ig_account = existing_ig.scalar_one_or_none()
            if ig_account:
                ig_account.access_token     = page_token  # same page token used for IG
                ig_account.account_name     = ig_username
                ig_account.token_expires_at = token_expires_at
                ig_account.is_active        = True
            else:
                ig_account = SocialAccount(
                    organization_id  = org.id,
                    platform         = "instagram",
                    account_id       = ig_id,
                    account_name     = ig_username,
                    access_token     = page_token,
                    token_expires_at = token_expires_at,
                    is_active        = True,
                )
                db.add(ig_account)
            saved.append(f"IG:@{ig_username}")

    await db.flush()
    logger.info("Meta accounts connected", org_id=str(org.id), accounts=saved)

    return RedirectResponse(
        url=f"{frontend_base}/settings?meta_connected=true&count={len(saved)}",
        status_code=302,
    )


# ─────────────────────────── Meta Posting ────────────────────────────────────

@router.post("/meta/post", response_model=MetaPostResponse)
async def post_to_meta(
    body: MetaPostRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Publish a post to a connected Facebook Page or Instagram Business account.

    Facebook Page  → plain text OR text+image
    Instagram      → requires image_url (IG Graph API doesn't support text-only posts)
    """
    org = await _get_user_org(current_user, db)

    # Load the SocialAccount
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id              == body.account_id,
            SocialAccount.organization_id == org.id,
            SocialAccount.is_active       == True,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Social account not found or not connected.")

    token = account.access_token

    async with httpx.AsyncClient(timeout=30) as client:

        # ── Facebook Page ──────────────────────────────────────────────────
        if account.platform == "facebook_page":
            payload: dict = {"message": body.message, "access_token": token}
            if body.image_url:
                # Photo post
                res = await client.post(
                    f"{META_GRAPH}/{account.account_id}/photos",
                    data={**payload, "url": body.image_url},
                )
            else:
                # Text post
                res = await client.post(
                    f"{META_GRAPH}/{account.account_id}/feed",
                    data=payload,
                )

            if res.status_code != 200:
                detail = res.json().get("error", {}).get("message", res.text)
                logger.error("Facebook post failed", error=detail)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Facebook error: {detail}",
                )

            post_id = res.json().get("id") or res.json().get("post_id", "")
            return MetaPostResponse(platform="facebook_page", post_id=post_id, success=True)

        # ── Instagram Business ─────────────────────────────────────────────
        elif account.platform == "instagram":
            if not body.image_url:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Instagram requires an image_url. Text-only posts are not supported by the Instagram Graph API.",
                )

            ig_id = account.account_id

            # Step 1 — Create media container
            container_res = await client.post(
                f"{META_GRAPH}/{ig_id}/media",
                data={
                    "image_url":    body.image_url,
                    "caption":      body.message,
                    "access_token": token,
                },
            )
            if container_res.status_code != 200:
                detail = container_res.json().get("error", {}).get("message", container_res.text)
                logger.error("Instagram container creation failed", error=detail)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Instagram error: {detail}",
                )

            creation_id = container_res.json().get("id")

            # Step 2 — Publish the container
            publish_res = await client.post(
                f"{META_GRAPH}/{ig_id}/media_publish",
                data={
                    "creation_id":  creation_id,
                    "access_token": token,
                },
            )
            if publish_res.status_code != 200:
                detail = publish_res.json().get("error", {}).get("message", publish_res.text)
                logger.error("Instagram publish failed", error=detail)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Instagram publish error: {detail}",
                )

            media_id = publish_res.json().get("id", "")
            return MetaPostResponse(platform="instagram", post_id=media_id, success=True)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Platform '{account.platform}' not supported for direct posting yet.",
            )


# ─────────────────────────── LinkedIn stub ───────────────────────────────────

@router.get("/connect/linkedin")
async def connect_linkedin(current_user: User = Depends(get_current_active_user)):
    """Return LinkedIn OAuth authorization URL."""
    auth_url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        "?response_type=code"
        f"&client_id={settings.LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={settings.BACKEND_URL}/api/v1/social-accounts/callback/linkedin"
        "&scope=r_liteprofile%20r_emailaddress%20w_member_social"
        f"&state={current_user.id}"
    )
    return {"auth_url": auth_url}


# ─────────────────────────── Twitter stub ────────────────────────────────────

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
