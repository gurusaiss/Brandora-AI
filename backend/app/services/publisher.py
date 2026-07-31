"""
Unified multi-platform social publisher.

Single source of truth for publishing content to every supported platform.
Used by:
  • app/api/v1/routes/social_accounts.py  — manual "Publish now" from the UI
  • app/core/scheduler.py                 — APScheduler campaign publishing
  • app/workers/scheduler_tasks.py        — Celery scheduled publishing

Every function raises PublishError on failure with a human-readable message.
Callers translate that into an HTTP 502 or a CampaignPost.failure_reason.

Platform support matrix
-----------------------
  facebook_page  text ✓   image ✓ (optional)
  instagram      text ✓   image ✗ REQUIRED (IG Graph API has no text-only posts)
  linkedin       text ✓   image ✓ (optional, via 3-step registerUpload flow)
  twitter        text ✓   image ✗ (v2 API text-only; 280-char limit enforced)
"""
from typing import Optional, Protocol

import httpx
import structlog

logger = structlog.get_logger(__name__)

META_GRAPH   = "https://graph.facebook.com/v19.0"
LINKEDIN_API = "https://api.linkedin.com/v2"
TWITTER_API  = "https://api.twitter.com/2"

TWITTER_MAX_CHARS = 280


class PublishError(RuntimeError):
    """Raised when publishing to a social platform fails."""


class SocialAccountLike(Protocol):
    """Duck-type accepted by publish_to_platform — ORM row or plain object."""
    platform: str
    account_id: str
    access_token: str


# ─────────────────────────── Facebook Page ───────────────────────────────────

async def _publish_facebook(
    client: httpx.AsyncClient,
    page_id: str,
    token: str,
    content: str,
    image_url: Optional[str],
) -> str:
    payload = {"message": content, "access_token": token}

    if image_url:
        res = await client.post(
            f"{META_GRAPH}/{page_id}/photos",
            data={**payload, "url": image_url},
        )
    else:
        res = await client.post(f"{META_GRAPH}/{page_id}/feed", data=payload)

    if res.status_code != 200:
        detail = _meta_error(res)
        logger.error("Facebook publish failed", error=detail)
        raise PublishError(f"Facebook error: {detail}")

    body = res.json()
    return body.get("id") or body.get("post_id", "")


# ─────────────────────────── Instagram Business ──────────────────────────────

async def _publish_instagram(
    client: httpx.AsyncClient,
    ig_id: str,
    token: str,
    content: str,
    image_url: Optional[str],
) -> str:
    if not image_url:
        raise PublishError(
            "Instagram requires an image. Text-only posts are not supported by the "
            "Instagram Graph API."
        )

    # Step 1 — create the media container
    container_res = await client.post(
        f"{META_GRAPH}/{ig_id}/media",
        data={"image_url": image_url, "caption": content, "access_token": token},
    )
    if container_res.status_code != 200:
        raise PublishError(f"Instagram container error: {_meta_error(container_res)}")

    creation_id = container_res.json().get("id")
    if not creation_id:
        raise PublishError(
            f"Instagram container creation returned no ID. Response: {container_res.json()}"
        )

    # Step 2 — poll until the container finishes processing.
    # Meta builds containers asynchronously; publishing early returns
    # "Media ID is not available".
    import asyncio

    for _ in range(10):
        await asyncio.sleep(2)
        status_res = await client.get(
            f"{META_GRAPH}/{creation_id}",
            params={"fields": "status_code,status", "access_token": token},
        )
        if status_res.status_code != 200:
            continue

        status_code = status_res.json().get("status_code", "")
        if status_code == "FINISHED":
            break
        if status_code in ("ERROR", "EXPIRED"):
            detail = status_res.json().get("status", status_code)
            raise PublishError(f"Instagram media processing failed: {detail}")
        # IN_PROGRESS — keep polling
    else:
        raise PublishError(
            "Instagram media container timed out (still processing after 20s). Try again."
        )

    # Step 3 — publish the ready container
    publish_res = await client.post(
        f"{META_GRAPH}/{ig_id}/media_publish",
        data={"creation_id": creation_id, "access_token": token},
    )
    if publish_res.status_code != 200:
        raise PublishError(f"Instagram publish error: {_meta_error(publish_res)}")

    return publish_res.json().get("id", "")


# ─────────────────────────── LinkedIn ────────────────────────────────────────

async def _linkedin_upload_image(
    client: httpx.AsyncClient,
    person_urn: str,
    token: str,
    image_url: str,
) -> Optional[str]:
    """
    Upload an image to LinkedIn and return its asset URN.

    Three-step flow: registerUpload → PUT binary → asset URN.
    Returns None on any failure so the caller can fall back to a text-only post.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }

    try:
        # Step 1 — register the upload
        register_res = await client.post(
            f"{LINKEDIN_API}/assets?action=registerUpload",
            headers=headers,
            json={
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": person_urn,
                    "serviceRelationships": [
                        {
                            "relationshipType": "OWNER",
                            "identifier": "urn:li:userGeneratedContent",
                        }
                    ],
                }
            },
        )
        if register_res.status_code not in (200, 201):
            logger.warning("LinkedIn registerUpload failed", body=register_res.text[:300])
            return None

        register_body = register_res.json().get("value", {})
        asset_urn = register_body.get("asset")
        upload_url = (
            register_body
            .get("uploadMechanism", {})
            .get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
            .get("uploadUrl")
        )
        if not asset_urn or not upload_url:
            logger.warning("LinkedIn registerUpload response incomplete")
            return None

        # Step 2 — fetch the source image, then PUT the bytes to LinkedIn
        img_res = await client.get(image_url)
        if img_res.status_code != 200:
            logger.warning("Could not download image for LinkedIn", url=image_url)
            return None

        upload_res = await client.put(
            upload_url,
            content=img_res.content,
            headers={"Authorization": f"Bearer {token}"},
        )
        if upload_res.status_code not in (200, 201):
            logger.warning("LinkedIn image upload failed", status=upload_res.status_code)
            return None

        return asset_urn

    except Exception as exc:
        logger.warning("LinkedIn image upload error", error=str(exc))
        return None


async def _publish_linkedin(
    client: httpx.AsyncClient,
    person_id: str,
    token: str,
    content: str,
    image_url: Optional[str],
) -> str:
    person_urn = f"urn:li:person:{person_id}"

    share_content: dict = {
        "shareCommentary": {"text": content},
        "shareMediaCategory": "NONE",
    }

    # Attach an image when one is supplied and the upload succeeds.
    # A failed upload degrades to a text-only post rather than failing the whole publish.
    if image_url:
        asset_urn = await _linkedin_upload_image(client, person_urn, token, image_url)
        if asset_urn:
            share_content["shareMediaCategory"] = "IMAGE"
            share_content["media"] = [
                {"status": "READY", "media": asset_urn}
            ]

    res = await client.post(
        f"{LINKEDIN_API}/ugcPosts",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json={
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {"com.linkedin.ugc.ShareContent": share_content},
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        },
    )

    if res.status_code not in (200, 201):
        detail = _linkedin_error(res)
        logger.error("LinkedIn publish failed", error=detail, status=res.status_code)
        raise PublishError(f"LinkedIn error: {detail}")

    # LinkedIn returns the post URN in the x-restli-id header, or `id` in the body
    return res.headers.get("x-restli-id") or res.json().get("id", "")


# ─────────────────────────── Twitter / X ─────────────────────────────────────

async def _publish_twitter(
    client: httpx.AsyncClient,
    token: str,
    content: str,
    image_url: Optional[str],
) -> str:
    # Twitter v2 with an OAuth2 user-context token supports text tweets.
    # Media upload still requires the v1.1 endpoint with OAuth 1.0a signing,
    # so images are dropped here rather than failing the publish.
    if image_url:
        logger.info("Twitter image ignored — v2 API is text-only in this integration")

    text = content
    if len(text) > TWITTER_MAX_CHARS:
        text = text[: TWITTER_MAX_CHARS - 1].rstrip() + "…"

    res = await client.post(
        f"{TWITTER_API}/tweets",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"text": text},
    )

    if res.status_code not in (200, 201):
        detail = _twitter_error(res)
        logger.error("Twitter publish failed", error=detail, status=res.status_code)
        raise PublishError(f"Twitter error: {detail}")

    return res.json().get("data", {}).get("id", "")


# ─────────────────────────── Error extractors ────────────────────────────────

def _meta_error(res: httpx.Response) -> str:
    try:
        return res.json().get("error", {}).get("message", res.text[:300])
    except Exception:
        return res.text[:300]


def _linkedin_error(res: httpx.Response) -> str:
    try:
        body = res.json()
        return body.get("message") or body.get("error_description") or str(body)[:300]
    except Exception:
        return res.text[:300]


def _twitter_error(res: httpx.Response) -> str:
    try:
        body = res.json()
        if "errors" in body and body["errors"]:
            return body["errors"][0].get("message", str(body)[:300])
        return body.get("detail") or body.get("title") or str(body)[:300]
    except Exception:
        return res.text[:300]


# ─────────────────────────── Public entrypoint ───────────────────────────────

SUPPORTED_PLATFORMS = ("facebook_page", "instagram", "linkedin", "twitter")


async def publish_to_platform(
    account: SocialAccountLike,
    content: str,
    image_url: Optional[str] = None,
    timeout: float = 60.0,
) -> str:
    """
    Publish `content` to the social platform behind `account`.

    Returns the platform's post/media ID on success.
    Raises PublishError with a human-readable message on failure.

    `account` needs three attributes: platform, account_id, access_token.
    Works with a SocialAccount ORM row or any plain object with those fields.
    """
    platform = account.platform

    if platform not in SUPPORTED_PLATFORMS:
        raise PublishError(
            f"Platform '{platform}' is not supported for publishing. "
            f"Supported: {', '.join(SUPPORTED_PLATFORMS)}."
        )

    if not account.access_token:
        raise PublishError(f"No access token stored for this {platform} account. Reconnect it.")

    if not content or not content.strip():
        raise PublishError("Cannot publish empty content.")

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        if platform == "facebook_page":
            return await _publish_facebook(
                client, account.account_id, account.access_token, content, image_url
            )
        if platform == "instagram":
            return await _publish_instagram(
                client, account.account_id, account.access_token, content, image_url
            )
        if platform == "linkedin":
            return await _publish_linkedin(
                client, account.account_id, account.access_token, content, image_url
            )
        if platform == "twitter":
            return await _publish_twitter(
                client, account.access_token, content, image_url
            )

    # Unreachable — the membership check above covers every branch
    raise PublishError(f"Unsupported platform: {platform}")
