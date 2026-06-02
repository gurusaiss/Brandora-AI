"""
Lightweight APScheduler — runs inside FastAPI process.
Handles scheduled post publishing every 5 minutes.
Works on Render free tier without a separate worker.
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore

logger = logging.getLogger("brandora.scheduler")

scheduler = AsyncIOScheduler(
    jobstores={"default": MemoryJobStore()},
    job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 300},
    timezone="Asia/Kolkata",
)


async def process_scheduled_posts() -> None:
    """
    Every 5 minutes: find posts with scheduled_at <= now and status='scheduled'.
    Mark them as 'published' with current timestamp.
    Real platform OAuth publishing is handled separately when credentials are provided.
    """
    from datetime import datetime, timezone
    from sqlalchemy import and_
    from app.core.database import async_session_factory
    from app.schemas.campaign import CampaignPost

    try:
        async with async_session_factory() as db:
            from sqlalchemy import select
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(CampaignPost).where(
                    and_(
                        CampaignPost.status == "scheduled",
                        CampaignPost.scheduled_at <= now,
                    )
                ).limit(50)
            )
            posts = result.scalars().all()
            for post in posts:
                post.status = "published"
                post.published_at = now
            if posts:
                await db.commit()
                logger.info("Auto-published %d scheduled posts", len(posts))
    except Exception as exc:
        logger.error("Scheduler error: %s", exc)


def init_scheduler() -> None:
    scheduler.add_job(
        process_scheduled_posts,
        trigger="interval",
        minutes=5,
        id="post_publisher",
        replace_existing=True,
    )
