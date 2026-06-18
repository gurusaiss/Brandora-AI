"""
APScheduler — runs inside the FastAPI process (no separate worker needed).

Jobs:
  1. generate_upcoming_content  — hourly: generate content+image for posts due in next 4h
  2. process_campaign_posts     — every 5 min: publish posts that are ready
  3. retry_failed_posts         — every 15 min: retry failed posts up to max_retries
  4. run_auto_campaigns         — every 5 min: legacy simple auto-campaigns
"""
import calendar
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("brandora.scheduler")

_IST = timezone(timedelta(hours=5, minutes=30))
_UTC = timezone.utc

scheduler = AsyncIOScheduler(
    jobstores={"default": MemoryJobStore()},
    job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 300},
    timezone="UTC",
)


def _next_run(frequency: str, post_time: str, post_days: list, from_utc: datetime) -> datetime:
    try:
        hour, minute = map(int, (post_time or "09:00").split(":"))
    except Exception:
        hour, minute = 9, 0

    now_ist  = from_utc.astimezone(_IST)
    today_at = now_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)

    if frequency == "daily":
        nxt = today_at if now_ist < today_at else today_at + timedelta(days=1)
        return nxt.astimezone(_UTC)

    if frequency == "weekly":
        day_map = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
        days = [day_map[d] for d in (post_days or []) if d in day_map]
        if not days:
            days = [0, 2, 4]
        for i in range(0, 8):
            candidate = today_at + timedelta(days=i)
            if candidate.weekday() in days and now_ist < candidate:
                return candidate.astimezone(_UTC)
        return (today_at + timedelta(days=7)).astimezone(_UTC)

    if frequency == "biweekly":
        return (today_at + timedelta(weeks=2)).astimezone(_UTC)

    if frequency == "monthly":
        y, m = now_ist.year, now_ist.month + 1
        if m > 12:
            m, y = 1, y + 1
        d   = min(now_ist.day, calendar.monthrange(y, m)[1])
        nxt = now_ist.replace(year=y, month=m, day=d, hour=hour, minute=minute, second=0)
        return nxt.astimezone(_UTC)

    return (today_at + timedelta(days=1)).astimezone(_UTC)


async def _post_to_meta(account, content: str, image_url: str | None) -> str:
    import httpx
    GRAPH = "https://graph.facebook.com/v19.0"
    token = account.access_token

    async with httpx.AsyncClient(timeout=30) as client:
        if account.platform == "facebook_page":
            payload = {"message": content, "access_token": token}
            if image_url:
                r = await client.post(f"{GRAPH}/{account.account_id}/photos",
                                      data={**payload, "url": image_url})
            else:
                r = await client.post(f"{GRAPH}/{account.account_id}/feed", data=payload)
            if r.status_code != 200:
                raise RuntimeError(f"FB error: {r.json().get('error', {}).get('message', r.text)}")
            return r.json().get("id") or r.json().get("post_id", "")

        if account.platform == "instagram":
            if not image_url:
                raise RuntimeError("Instagram requires an image_url")
            c = await client.post(f"{GRAPH}/{account.account_id}/media",
                                  data={"image_url": image_url, "caption": content,
                                        "access_token": token})
            if c.status_code != 200:
                raise RuntimeError(f"IG container: {c.json().get('error', {}).get('message', c.text)}")
            p = await client.post(f"{GRAPH}/{account.account_id}/media_publish",
                                  data={"creation_id": c.json()["id"], "access_token": token})
            if p.status_code != 200:
                raise RuntimeError(f"IG publish: {p.json().get('error', {}).get('message', p.text)}")
            return p.json().get("id", "")

    raise RuntimeError(f"Unsupported platform: {account.platform}")


async def generate_upcoming_content() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignImage, CampaignPost

    try:
        async with async_session_factory() as db:
            now     = datetime.now(_UTC)
            horizon = now + timedelta(hours=4)

            result = await db.execute(
                select(CampaignPost).where(
                    and_(
                        CampaignPost.status == "scheduled",
                        CampaignPost.scheduled_at > now,
                        CampaignPost.scheduled_at <= horizon,
                        CampaignPost.content == "",
                    )
                ).limit(20)
            )
            posts = result.scalars().all()
            if not posts:
                return

            from app.services.campaign_engine import generate_post_content
            logger.info("Generating content for %d upcoming posts", len(posts))

            for post in posts:
                try:
                    post.status = "generating"
                    await db.flush()

                    campaign = (await db.execute(
                        select(Campaign).where(Campaign.id == post.campaign_id)
                    )).scalar_one_or_none()
                    if not campaign:
                        post.status = "failed"
                        post.failure_reason = "Campaign not found"
                        continue

                    all_posts = (await db.execute(
                        select(CampaignPost).where(CampaignPost.campaign_id == campaign.id)
                    )).scalars().all()
                    post_index = next((i for i, p in enumerate(all_posts) if p.id == post.id), 0)

                    content, hashtags = await generate_post_content(
                        campaign, post.platform, post_index, len(all_posts)
                    )
                    post.content  = content
                    post.hashtags = hashtags
                    post.status   = "scheduled"

                    if campaign.generate_images:
                        from app.services.image_generation import generate_campaign_image
                        img_url, prompt, model = await generate_campaign_image(
                            campaign_id=str(campaign.id), post_id=str(post.id),
                            campaign_name=campaign.name,
                            campaign_goal=campaign.campaign_goal or campaign.name,
                            topic=campaign.topic or campaign.name,
                            platform=post.platform, keywords=campaign.keywords,
                        )
                        post.image_url = img_url
                        db.add(CampaignImage(
                            campaign_id=campaign.id, post_id=post.id,
                            image_url=img_url, prompt_used=prompt, model_used=model,
                        ))
                except Exception as exc:
                    logger.error("Content gen failed post %s: %s", post.id, exc)
                    post.status = "scheduled"
                    post.failure_reason = str(exc)[:300]

            await db.commit()
    except Exception as exc:
        logger.error("generate_upcoming_content error: %s", exc, exc_info=True)


async def process_campaign_posts() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignPost, SocialAccount

    try:
        async with async_session_factory() as db:
            now = datetime.now(_UTC)

            result = await db.execute(
                select(CampaignPost).where(
                    and_(
                        CampaignPost.status == "scheduled",
                        CampaignPost.scheduled_at <= now,
                        CampaignPost.content != "",
                    )
                ).limit(30)
            )
            posts = result.scalars().all()
            if not posts:
                return

            logger.info("Publishing %d due posts", len(posts))

            for post in posts:
                try:
                    post.status = "publishing"
                    await db.flush()

                    campaign = (await db.execute(
                        select(Campaign).where(Campaign.id == post.campaign_id)
                    )).scalar_one_or_none()

                    if not campaign or not campaign.social_account_id:
                        post.status = "failed"
                        post.failure_reason = "No social account linked"
                        continue

                    sa = (await db.execute(
                        select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
                    )).scalar_one_or_none()

                    if not sa or not sa.is_active:
                        post.status = "failed"
                        post.failure_reason = "Social account inactive"
                        continue

                    platform_id = await _post_to_meta(sa, post.content, post.image_url)
                    post.status           = "published"
                    post.published_at     = now
                    post.platform_post_id = platform_id
                    campaign.published_posts = (campaign.published_posts or 0) + 1

                except Exception as exc:
                    logger.error("Publish failed post %s: %s", post.id, exc)
                    post.retry_count    = (post.retry_count or 0) + 1
                    post.failure_reason = str(exc)[:500]
                    post.status = "failed" if post.retry_count >= post.max_retries else "retrying"

            await db.commit()
    except Exception as exc:
        logger.error("process_campaign_posts error: %s", exc, exc_info=True)


async def retry_failed_posts() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import CampaignPost

    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(CampaignPost).where(
                    and_(CampaignPost.status == "retrying",
                         CampaignPost.retry_count < CampaignPost.max_retries)
                ).limit(20)
            )
            posts = result.scalars().all()
            for post in posts:
                post.status = "scheduled"
            if posts:
                await db.commit()
                logger.info("Reset %d posts for retry", len(posts))
    except Exception as exc:
        logger.error("retry_failed_posts error: %s", exc)


async def run_auto_campaigns() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignPost, SocialAccount
    from app.services.campaign_engine import generate_post_content

    try:
        async with async_session_factory() as db:
            now = datetime.now(_UTC)
            result = await db.execute(
                select(Campaign).where(
                    and_(Campaign.is_scheduled == True, Campaign.status == "active",
                         Campaign.next_run_at != None, Campaign.next_run_at <= now,
                         Campaign.social_account_id != None)
                ).limit(10)
            )
            campaigns = result.scalars().all()
            if not campaigns:
                return

            logger.info("Auto-campaigns due: %d", len(campaigns))

            for campaign in campaigns:
                try:
                    sa = (await db.execute(
                        select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
                    )).scalar_one_or_none()

                    if not sa or not sa.is_active:
                        campaign.next_run_at = _next_run(
                            campaign.frequency, campaign.post_time, campaign.post_days or [], now
                        )
                        continue

                    content, hashtags = await generate_post_content(
                        campaign, sa.platform, campaign.published_posts or 0, campaign.total_posts or 999
                    )
                    platform_id = await _post_to_meta(sa, content, campaign.image_url)

                    db.add(CampaignPost(
                        campaign_id=campaign.id, platform=sa.platform,
                        content=content, hashtags=hashtags,
                        status="published", published_at=now, platform_post_id=platform_id,
                        sequence_order=(campaign.published_posts or 0) + 1,
                    ))
                    campaign.published_posts = (campaign.published_posts or 0) + 1
                    campaign.total_posts     = (campaign.total_posts or 0) + 1
                    campaign.last_run_at     = now
                    campaign.next_run_at     = _next_run(
                        campaign.frequency, campaign.post_time, campaign.post_days or [], now
                    )
                except Exception as exc:
                    logger.error("Auto-campaign %s failed: %s", campaign.id, exc)
                    db.add(CampaignPost(
                        campaign_id=campaign.id, platform="unknown",
                        content=f"[Failed: {str(exc)[:200]}]",
                        status="failed", failure_reason=str(exc)[:500],
                    ))
                    campaign.next_run_at = _next_run(
                        campaign.frequency, campaign.post_time, campaign.post_days or [], now
                    )

            await db.commit()
    except Exception as exc:
        logger.error("run_auto_campaigns error: %s", exc, exc_info=True)


def init_scheduler() -> None:
    scheduler.add_job(generate_upcoming_content, trigger="interval", hours=1,
                      id="content_generator",   replace_existing=True)
    scheduler.add_job(process_campaign_posts,   trigger="interval", minutes=5,
                      id="post_publisher",       replace_existing=True)
    scheduler.add_job(retry_failed_posts,       trigger="interval", minutes=15,
                      id="retry_handler",        replace_existing=True)
    scheduler.add_job(run_auto_campaigns,       trigger="interval", minutes=5,
                      id="auto_campaign_runner", replace_existing=True)
