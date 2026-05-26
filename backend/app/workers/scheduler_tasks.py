"""
Celery tasks for post scheduling and publishing.
"""
import logging
import uuid

from app.workers.celery_app import celery_app

logger = logging.getLogger("brandora.workers.scheduler")


def _run_async(coro):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


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

    async def _publish():
        async with async_session_factory() as session:
            result = await session.execute(
                select(CampaignPost).where(CampaignPost.id == uuid.UUID(post_id))
            )
            post = result.scalar_one_or_none()

            if not post:
                logger.warning("Scheduled post not found", post_id=post_id)
                return {"error": "Post not found"}

            if post.status != "scheduled":
                logger.info("Post no longer scheduled", post_id=post_id, status=post.status)
                return {"skipped": True, "status": post.status}

            # In production: call social platform API to publish
            # For now: mark as published
            logger.info("Publishing post", post_id=post_id, platform=post.platform)

            # TODO: Integrate with LinkedIn/Instagram/Twitter APIs
            # published = await publish_to_platform(post.platform, post.content, post.media_urls)

            post.status = "published"
            post.published_at = datetime.now(timezone.utc)
            await session.commit()

            logger.info("Post published successfully", post_id=post_id, platform=post.platform)
            return {"published": True, "post_id": post_id, "platform": post.platform}

    try:
        return _run_async(_publish())
    except Exception as exc:
        logger.error("Publishing failed", post_id=post_id, error=str(exc))
        raise self.retry(exc=exc)


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
