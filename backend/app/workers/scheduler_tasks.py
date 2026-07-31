"""
Celery tasks for post scheduling and publishing.
"""
import logging
import uuid

from app.workers.celery_app import celery_app

logger = logging.getLogger("brandora.workers.scheduler")


def _run_async(coro):
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    name="app.workers.scheduler_tasks.publish_post_at_scheduled_time",
)
def publish_post_at_scheduled_time(self, post_id: str) -> dict:
    """
    Publish a scheduled campaign post at its scheduled time.
    This task is enqueued with eta= to fire at the exact scheduled_at time.
    """
    from app.core.database import async_session_factory
    from app.schemas.campaign import CampaignPost, SocialAccount
    from sqlalchemy import select
    from datetime import datetime, timezone

    from app.schemas.campaign import Campaign
    from app.services.publisher import PublishError, publish_to_platform

    class _Account:
        """Detached stand-in for SocialAccount, safe to use with no DB session open."""
        __slots__ = ("platform", "account_id", "access_token")

        def __init__(self, platform: str, account_id: str, access_token: str) -> None:
            self.platform = platform
            self.account_id = account_id
            self.access_token = access_token

    async def _publish():
        # ── Phase 1: load the post + its account, mark publishing, close session ──
        async with async_session_factory() as session:
            result = await session.execute(
                select(CampaignPost).where(CampaignPost.id == uuid.UUID(post_id))
            )
            post = result.scalar_one_or_none()

            if not post:
                logger.warning("Scheduled post not found: %s", post_id)
                return {"error": "Post not found"}

            if post.status != "scheduled":
                logger.info("Post no longer scheduled: %s (%s)", post_id, post.status)
                return {"skipped": True, "status": post.status}

            campaign = (await session.execute(
                select(Campaign).where(Campaign.id == post.campaign_id)
            )).scalar_one_or_none()

            if not campaign:
                post.status = "failed"
                post.failure_reason = "Campaign not found"
                await session.commit()
                return {"error": "Campaign not found"}

            if campaign.status in ("archived", "completed", "cancelled"):
                post.status = "failed"
                post.failure_reason = f"Campaign is {campaign.status}"
                await session.commit()
                return {"skipped": True, "reason": f"campaign {campaign.status}"}

            if not campaign.social_account_id:
                post.status = "failed"
                post.failure_reason = "No social account linked to campaign"
                await session.commit()
                return {"error": "No social account linked"}

            sa = (await session.execute(
                select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
            )).scalar_one_or_none()

            if not sa or not sa.is_active:
                post.status = "failed"
                post.failure_reason = "Social account inactive — reconnect it"
                await session.commit()
                return {"error": "Social account inactive"}

            account = _Account(sa.platform, sa.account_id, sa.access_token)
            content = post.content
            image_url = post.image_url
            max_retries = post.max_retries or 3
            retry_count = post.retry_count or 0

            post.status = "publishing"
            await session.commit()

        # ── Phase 2: real platform call, no DB session held ──────────────────────
        platform_post_id: str | None = None
        failure: str | None = None
        try:
            platform_post_id = await publish_to_platform(account, content, image_url)
            logger.info("Post published: %s → %s", post_id, account.platform)
        except PublishError as exc:
            failure = str(exc)[:500]
            logger.error("Publish failed for %s: %s", post_id, failure)
        except Exception as exc:
            failure = str(exc)[:500]
            logger.error("Publish error for %s: %s", post_id, failure)

        # ── Phase 3: write the outcome ───────────────────────────────────────────
        async with async_session_factory() as session:
            post = (await session.execute(
                select(CampaignPost).where(CampaignPost.id == uuid.UUID(post_id))
            )).scalar_one_or_none()
            if not post:
                return {"error": "Post disappeared mid-publish"}

            if failure is None:
                post.status = "published"
                post.published_at = datetime.now(timezone.utc)
                post.platform_post_id = platform_post_id
                campaign = (await session.execute(
                    select(Campaign).where(Campaign.id == post.campaign_id)
                )).scalar_one_or_none()
                if campaign:
                    campaign.published_posts = (campaign.published_posts or 0) + 1
                await session.commit()
                return {
                    "published": True,
                    "post_id": post_id,
                    "platform": account.platform,
                    "platform_post_id": platform_post_id,
                }

            new_retry_count = retry_count + 1
            post.retry_count = new_retry_count
            post.failure_reason = failure
            post.status = "failed" if new_retry_count >= max_retries else "retrying"
            await session.commit()
            return {"published": False, "post_id": post_id, "error": failure}

    try:
        outcome = _run_async(_publish())
    except Exception as exc:
        # Unexpected failure (DB down, event-loop error) — retry with backoff
        logger.error("Publishing task errored for %s: %s", post_id, exc)
        raise self.retry(exc=exc)

    # A platform-level failure is already recorded on the post. Retry it through
    # Celery so the backoff applies, but only while attempts remain.
    if outcome.get("published") is False and self.request.retries < self.max_retries:
        raise self.retry(exc=RuntimeError(outcome.get("error", "publish failed")))

    return outcome


@celery_app.task(name="app.workers.scheduler_tasks.process_due_posts")
def process_due_posts() -> dict:
    """
    Beat task: scan for any posts that are past their scheduled_at but not yet published.
    Runs every 5 minutes via Celery Beat.
    """
    from app.core.database import async_session_factory
    from app.schemas.campaign import CampaignPost
    from sqlalchemy import select
    from datetime import datetime, timezone

    async def _process():
        now = datetime.now(timezone.utc)
        async with async_session_factory() as session:
            result = await session.execute(
                select(CampaignPost).where(
                    CampaignPost.status == "scheduled",
                    CampaignPost.scheduled_at <= now,
                )
            )
            due_posts = result.scalars().all()

            processed = 0
            for post in due_posts:
                publish_post_at_scheduled_time.delay(str(post.id))
                processed += 1

        return {"processed": processed}

    return _run_async(_process())
