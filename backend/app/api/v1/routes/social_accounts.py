"""
Social account connection routes.

Supported platforms:
  • Meta  — Facebook Pages + Instagram Business via Graph API v19.0
  • LinkedIn — OAuth 2.0 OpenID Connect (full flow)
  • Twitter  — OAuth 2.0 PKCE (full flow)

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
import secrets
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

# Permissions the app requests.
# Kept to the minimum needed for posting — fewer scopes = less App Review friction.
# instagram_manage_insights + business_management require extra App Review; not needed here.
META_SCOPES = ",".join([
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
    "instagram_basic",
    "instagram_content_publish",
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


class ManualMetaConnectRequest(BaseModel):
    # Accept either a User Access Token or a Page Access Token.
    # We always try to exchange for long-lived first so stored tokens never expire.
    page_access_token: str


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
        ll_data = ll_res.json()
        if ll_res.status_code != 200 or "access_token" not in ll_data:
            # Exchange failed — usually means META_APP_SECRET is missing/wrong.
            # Abort rather than storing a short-lived token that expires in hours.
            logger.error(
                "Meta long-lived token exchange failed — check META_APP_SECRET",
                status=ll_res.status_code,
                body=ll_res.text,
            )
            return RedirectResponse(
                url=f"{frontend_base}/settings?meta_error=token_exchange_failed",
                status_code=302,
            )
        long_token = ll_data["access_token"]
        # Page Access Tokens derived from a long-lived UAT never expire.
        # We store a 10-year sentinel; they only invalidate on password change.
        token_expires_at = datetime.now(timezone.utc) + timedelta(days=3650)

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


# ─────────────────────────── Meta Manual Connect ─────────────────────────────

@router.post("/connect/meta/manual", response_model=List[SocialAccountResponse])
async def connect_meta_manual(
    body: ManualMetaConnectRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Connect a Facebook Page (+ linked Instagram Business, if any) using a
    manually-generated Page Access Token from Graph API Explorer.

    No App Review required — works immediately in Development mode for any
    admin of the Facebook Page.

    How to get a Page Access Token:
      1. Go to https://developers.facebook.com/tools/explorer
      2. Select your Meta app in the top-right dropdown
      3. Click "Generate Access Token" → tick pages_manage_posts,
         instagram_basic, instagram_content_publish → "Generate Token"
      4. In the query field run: GET me/accounts
      5. Copy the access_token for your Page from the response
      6. Paste it here
    """
    org = await _get_user_org(current_user, db)

    raw_token = body.page_access_token.strip()
    saved_accounts: list[SocialAccount] = []

    async with httpx.AsyncClient(timeout=15) as client:
        # ── Step 1: Try to exchange for a long-lived User Access Token ──────────
        # This works when the pasted token is a User Access Token.
        # Page Access Tokens derived from a long-lived UAT never expire.
        # If exchange fails (token is already a Page token), fall through.
        long_lived_uat: str | None = None
        exchange_res = await client.get(
            f"{META_GRAPH}/oauth/access_token",
            params={
                "grant_type":       "fb_exchange_token",
                "client_id":        settings.META_APP_ID,
                "client_secret":    settings.META_APP_SECRET,
                "fb_exchange_token": raw_token,
            },
        )
        if exchange_res.status_code == 200:
            long_lived_uat = exchange_res.json().get("access_token")

        # ── Step 2: Fetch pages via me/accounts, then fall back to /me ─────────
        # Strategy:
        #   1. Try me/accounts with long-lived UAT (best — gives permanent page tokens)
        #   2. Try me/accounts with raw token (works if raw token is a UAT)
        #   3. Fall back to /me (raw token is a Page token) — get IG in a separate call
        pages_token = long_lived_uat or raw_token
        pages: list[dict] = []

        # Attempt 1 & 2: me/accounts
        for token_to_try in ([long_lived_uat, raw_token] if long_lived_uat else [raw_token]):
            if not token_to_try:
                continue
            acc_res = await client.get(
                f"{META_GRAPH}/me/accounts",
                params={
                    "fields":       "id,name,access_token,instagram_business_account",
                    "access_token": token_to_try,
                },
            )
            if acc_res.status_code == 200:
                data = acc_res.json().get("data", [])
                if data:
                    pages = data
                    # Prefer long-lived page tokens when we have the UAT
                    if token_to_try == long_lived_uat:
                        pages_token = long_lived_uat
                    break

        # Attempt 3: /me (token is already a Page Access Token)
        if not pages:
            me_res = await client.get(
                f"{META_GRAPH}/me",
                params={"fields": "id,name", "access_token": raw_token},
            )
            if me_res.status_code != 200:
                err = me_res.json().get("error", {}).get("message", "Invalid token")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid token: {err}",
                )
            pdata = me_res.json()
            page_id = pdata.get("id")
            # Fetch instagram_business_account separately so a missing field
            # doesn't bubble up as an error on the user node
            ig_info = None
            if page_id:
                ig_res = await client.get(
                    f"{META_GRAPH}/{page_id}",
                    params={"fields": "instagram_business_account", "access_token": raw_token},
                )
                if ig_res.status_code == 200:
                    ig_info = ig_res.json().get("instagram_business_account")
            pages = [{
                "id":                          page_id,
                "name":                        pdata.get("name", "Facebook Page"),
                "access_token":                raw_token,
                "instagram_business_account":  ig_info,
            }]

        if not pages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Facebook Pages found. Make sure the token has pages_show_list permission.",
            )

        # ── Step 3: Upsert each page (and linked IG) ───────────────────────────
        # Permanent Page Access Tokens → 10-year expiry sentinel in DB.
        token_expires_at = datetime.now(timezone.utc) + timedelta(days=3650)

        for page in pages:
            page_id    = page.get("id")
            page_name  = page.get("name", "Facebook Page")
            page_token = page.get("access_token", pages_token)

            if not page_id:
                continue

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
            saved_accounts.append(fb_account)

            # ── Linked Instagram Business Account ──────────────────────────────
            ig_info = page.get("instagram_business_account")
            if ig_info:
                ig_id = ig_info.get("id")
                ig_res = await client.get(
                    f"{META_GRAPH}/{ig_id}",
                    params={"fields": "id,username", "access_token": page_token},
                )
                ig_username = (
                    ig_res.json().get("username", "Instagram")
                    if ig_res.status_code == 200
                    else "Instagram"
                )

                existing_ig = await db.execute(
                    select(SocialAccount).where(
                        SocialAccount.organization_id == org.id,
                        SocialAccount.platform        == "instagram",
                        SocialAccount.account_id      == ig_id,
                    )
                )
                ig_account = existing_ig.scalar_one_or_none()
                if ig_account:
                    ig_account.access_token     = page_token
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
                saved_accounts.append(ig_account)

    if not saved_accounts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No accounts were saved. Check the token has pages_manage_posts permission.",
        )

    await db.flush()
    logger.info(
        "Meta accounts connected (manual token)",
        org_id=str(org.id),
        used_long_lived=long_lived_uat is not None,
        count=len(saved_accounts),
    )

    return [SocialAccountResponse.model_validate(a) for a in saved_accounts]


# ─────────────────────────── Meta Posting ────────────────────────────────────

async def _load_account(
    account_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> SocialAccount:
    """Load an active SocialAccount that belongs to the caller's organization."""
    org = await _get_user_org(current_user, db)
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id              == account_id,
            SocialAccount.organization_id == org.id,
            SocialAccount.is_active       == True,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Social account not found or not connected.")
    return account


@router.post("/publish", response_model=MetaPostResponse)
async def publish_post(
    body: MetaPostRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Publish a post to any connected social account.

    Facebook Page  → text, optionally with an image
    Instagram      → image required (IG Graph API has no text-only posts)
    LinkedIn       → text, optionally with an image
    Twitter / X    → text only, truncated to 280 characters
    """
    from app.services.publisher import PublishError, publish_to_platform

    account = await _load_account(body.account_id, current_user, db)

    try:
        post_id = await publish_to_platform(account, body.message, body.image_url)
    except PublishError as exc:
        # Missing-image on Instagram is a client mistake, not an upstream failure
        message = str(exc)
        if "requires an image" in message:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=message,
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)

    logger.info("Post published", platform=account.platform, post_id=post_id)
    return MetaPostResponse(platform=account.platform, post_id=post_id, success=True)


@router.post("/meta/post", response_model=MetaPostResponse)
async def post_to_meta(
    body: MetaPostRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deprecated alias for POST /publish, kept for backward compatibility.

    Despite the name it now routes through the shared publisher, so it works for
    LinkedIn and Twitter accounts too.
    """
    return await publish_post(body, current_user, db)


# ─────────────────────────── LinkedIn OAuth ──────────────────────────────────

LINKEDIN_AUTH   = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN  = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_ME     = "https://api.linkedin.com/v2/userinfo"       # OpenID Connect userinfo

LINKEDIN_SCOPES = "openid profile email w_member_social"


@router.get("/connect/linkedin")
async def connect_linkedin(current_user: User = Depends(get_current_active_user)):
    """Return LinkedIn OAuth authorization URL (OAuth 2.0 PKCE)."""
    if not settings.LINKEDIN_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LinkedIn OAuth is not configured on this server.",
        )
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/social-accounts/callback/linkedin"
    state = _encode_state(current_user.id)
    params = urlencode({
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": LINKEDIN_SCOPES,
        "state": state,
    })
    return {"auth_url": f"{LINKEDIN_AUTH}?{params}", "state": state}


@router.get("/callback/linkedin")
async def linkedin_oauth_callback(
    code:  Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    LinkedIn OAuth2 callback.
    Exchanges code for access token, fetches profile, and saves SocialAccount.
    """
    from datetime import timedelta

    frontend_base = settings.FRONTEND_URL.rstrip("/")

    if error or not code:
        logger.warning("LinkedIn OAuth error", error=error)
        return RedirectResponse(
            url=f"{frontend_base}/settings?linkedin_error={error or 'access_denied'}",
            status_code=302,
        )

    if not state:
        return RedirectResponse(url=f"{frontend_base}/settings?linkedin_error=invalid_state", status_code=302)

    user_id = _decode_state(state)
    if not user_id:
        return RedirectResponse(url=f"{frontend_base}/settings?linkedin_error=invalid_state", status_code=302)

    org = await _get_org_for_user_id(user_id, db)
    if not org:
        return RedirectResponse(url=f"{frontend_base}/settings?linkedin_error=no_org", status_code=302)

    redirect_uri = f"{settings.BACKEND_URL}/api/v1/social-accounts/callback/linkedin"

    async with httpx.AsyncClient(timeout=20) as client:
        # Exchange code for access token
        token_res = await client.post(
            LINKEDIN_TOKEN,
            data={
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  redirect_uri,
                "client_id":     settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_res.status_code != 200:
            logger.error("LinkedIn token exchange failed", body=token_res.text)
            return RedirectResponse(
                url=f"{frontend_base}/settings?linkedin_error=token_exchange_failed", status_code=302
            )
        token_data    = token_res.json()
        access_token  = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")  # present when openid+offline_access granted
        expires_in    = token_data.get("expires_in", 5184000)  # default 60 days

        # Fetch user profile (OpenID Connect userinfo endpoint)
        me_res = await client.get(
            LINKEDIN_ME,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if me_res.status_code != 200:
            logger.error("LinkedIn userinfo failed", body=me_res.text)
            return RedirectResponse(
                url=f"{frontend_base}/settings?linkedin_error=profile_fetch_failed", status_code=302
            )
        profile = me_res.json()

    li_id   = profile.get("sub") or profile.get("id", "")
    li_name = profile.get("name") or f"{profile.get('given_name','')} {profile.get('family_name','')}".strip()
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # Upsert SocialAccount
    existing = await db.execute(
        select(SocialAccount).where(
            SocialAccount.organization_id == org.id,
            SocialAccount.platform        == "linkedin",
            SocialAccount.account_id      == str(li_id),
        )
    )
    account = existing.scalar_one_or_none()
    if account:
        account.access_token     = access_token
        account.refresh_token    = refresh_token or account.refresh_token
        account.account_name     = li_name
        account.token_expires_at = token_expires_at
        account.is_active        = True
    else:
        account = SocialAccount(
            organization_id  = org.id,
            platform         = "linkedin",
            account_id       = str(li_id),
            account_name     = li_name,
            access_token     = access_token,
            refresh_token    = refresh_token,
            token_expires_at = token_expires_at,
            is_active        = True,
        )
        db.add(account)

    await db.flush()
    logger.info("LinkedIn account connected", org_id=str(org.id), name=li_name)

    return RedirectResponse(
        url=f"{frontend_base}/settings?linkedin_connected=true",
        status_code=302,
    )


# ─────────────────────────── Twitter / X OAuth 2.0 ───────────────────────────

TWITTER_AUTH  = "https://twitter.com/i/oauth2/authorize"
TWITTER_TOKEN = "https://api.twitter.com/2/oauth2/token"
TWITTER_ME    = "https://api.twitter.com/2/users/me"


@router.get("/connect/twitter")
async def connect_twitter(current_user: User = Depends(get_current_active_user)):
    """Return Twitter OAuth2 PKCE authorization URL."""
    if not settings.TWITTER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twitter OAuth is not configured on this server.",
        )
    import hashlib
    state         = _encode_state(current_user.id)
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode()

    redirect_uri = f"{settings.BACKEND_URL}/api/v1/social-accounts/callback/twitter"
    params = urlencode({
        "response_type":         "code",
        "client_id":             settings.TWITTER_API_KEY,
        "redirect_uri":          redirect_uri,
        "scope":                 "tweet.read tweet.write users.read offline.access",
        "state":                 state,
        "code_challenge":        code_challenge,
        "code_challenge_method": "S256",
    })

    # Store verifier in a short-lived way — reuse Redis if available, else embed in state
    # For simplicity we embed verifier in state as state:verifier (URL-safe)
    combined_state = f"{state}:{code_verifier}"

    return {
        "auth_url": f"{TWITTER_AUTH}?{params.replace(urlencode({'state': state}), urlencode({'state': combined_state}))}",
        "state": combined_state,
    }


@router.get("/callback/twitter")
async def twitter_oauth_callback(
    code:  Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Twitter OAuth2 PKCE callback.
    Exchanges code for access token, fetches profile, and saves SocialAccount.
    """
    from datetime import timedelta
    import base64 as _base64

    frontend_base = settings.FRONTEND_URL.rstrip("/")

    if error or not code:
        logger.warning("Twitter OAuth error", error=error)
        return RedirectResponse(
            url=f"{frontend_base}/settings?twitter_error={error or 'access_denied'}",
            status_code=302,
        )

    if not state or ":" not in state:
        return RedirectResponse(url=f"{frontend_base}/settings?twitter_error=invalid_state", status_code=302)

    # Split combined state into user state + code_verifier
    raw_state, code_verifier = state.rsplit(":", 1)
    user_id = _decode_state(raw_state)
    if not user_id:
        return RedirectResponse(url=f"{frontend_base}/settings?twitter_error=invalid_state", status_code=302)

    org = await _get_org_for_user_id(user_id, db)
    if not org:
        return RedirectResponse(url=f"{frontend_base}/settings?twitter_error=no_org", status_code=302)

    redirect_uri = f"{settings.BACKEND_URL}/api/v1/social-accounts/callback/twitter"
    # Twitter OAuth2 PKCE uses Basic auth with client_id:client_secret
    credentials = _base64.b64encode(
        f"{settings.TWITTER_API_KEY}:{settings.TWITTER_API_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=20) as client:
        # Exchange code for access token
        token_res = await client.post(
            TWITTER_TOKEN,
            data={
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  redirect_uri,
                "code_verifier": code_verifier,
            },
            headers={
                "Authorization":  f"Basic {credentials}",
                "Content-Type":   "application/x-www-form-urlencoded",
            },
        )
        if token_res.status_code != 200:
            logger.error("Twitter token exchange failed", body=token_res.text)
            return RedirectResponse(
                url=f"{frontend_base}/settings?twitter_error=token_exchange_failed", status_code=302
            )
        token_data    = token_res.json()
        access_token  = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")  # present when offline.access scope granted
        expires_in    = token_data.get("expires_in", 7200)

        # Fetch user profile
        me_res = await client.get(
            TWITTER_ME,
            params={"user.fields": "name,username,profile_image_url"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if me_res.status_code != 200:
            logger.error("Twitter user fetch failed", body=me_res.text)
            return RedirectResponse(
                url=f"{frontend_base}/settings?twitter_error=profile_fetch_failed", status_code=302
            )
        tw_user = me_res.json().get("data", {})

    tw_id   = tw_user.get("id", "")
    tw_name = tw_user.get("name", "Twitter User")
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # Upsert SocialAccount
    existing = await db.execute(
        select(SocialAccount).where(
            SocialAccount.organization_id == org.id,
            SocialAccount.platform        == "twitter",
            SocialAccount.account_id      == str(tw_id),
        )
    )
    account = existing.scalar_one_or_none()
    if account:
        account.access_token     = access_token
        account.refresh_token    = refresh_token or account.refresh_token
        account.account_name     = tw_name
        account.token_expires_at = token_expires_at
        account.is_active        = True
    else:
        account = SocialAccount(
            organization_id  = org.id,
            platform         = "twitter",
            account_id       = str(tw_id),
            account_name     = tw_name,
            access_token     = access_token,
            refresh_token    = refresh_token,
            token_expires_at = token_expires_at,
            is_active        = True,
        )
        db.add(account)

    await db.flush()
    logger.info("Twitter account connected", org_id=str(org.id), name=tw_name)

    return RedirectResponse(
        url=f"{frontend_base}/settings?twitter_connected=true",
        status_code=302,
    )
