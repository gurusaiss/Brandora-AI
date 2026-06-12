"""
APScheduler — runs inside the FastAPI process (no separate worker needed).

Jobs (both run every 5 minutes):
  1. process_scheduled_posts  — publishes manually-scheduled CampaignPosts
  2. run_auto_campaigns        — generates content with Groq + posts to Meta
                                 for campaigns where next_run_at <= now
"""
import calendar
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("brandora.scheduler")

# IST = UTC+5:30
_IST = timezone(timedelta(hours=5, minutes=30))

scheduler = AsyncIOScheduler(
    jobstores={"default": MemoryJobStore()},
    job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 300},
    timezone="UTC",
)


# ── Helper: calculate next run time ──────────────────────────────────────────

def _next_run(frequency: str, post_time: str, post_days: list, from_utc: datetime) -> datetime:
    """Return the next UTC datetime when this campaign should run."""
    try:
        hour, minute = map(int, (post_time or "09:00").split(":"))
    except Exception:
        hour, minute = 9, 0

    # Work in IST so the user's "9:00 AM" means 9:00 AM IST
    now_ist = from_utc.astimezone(_IST)
    today_at = now_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)

    if frequency == "daily":
        nxt = today_at if now_ist < today_at else today_at + timedelta(days=1)
        return nxt.astimezone(timezone.utc)

    if frequency == "weekly":
        day_map = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
        days = [day_map[d] for d in (post_days or []) if d in day_map]
        if not days:
            days = [0, 2, 4]  # Mon / Wed / Fri default
        # Start at i=0 so today is included if its slot hasn't passed yet
        for i in range(0, 8):
            candidate = today_at + timedelta(days=i)
            if candidate.weekday() in days and now_ist < candidate:
                return candidate.astimezone(timezone.utc)
        return (today_at + timedelta(days=7)).astimezone(timezone.utc)

    if frequency == "biweekly":
        return (today_at + timedelta(weeks=2)).astimezone(timezone.utc)

    if frequency == "monthly":
        y = now_ist.year
        m = now_ist.month + 1
        if m > 12:
            m, y = 1, y + 1
        d = min(now_ist.day, calendar.monthrange(y, m)[1])
        nxt = now_ist.replace(year=y, month=m, day=d, hour=hour, minute=minute, second=0)
        return nxt.astimezone(timezone.utc)

    # Fallback: tomorrow
    return (today_at + timedelta(days=1)).astimezone(timezone.utc)


# ── Helper: generate content with Groq ───────────────────────────────────────

async def _generate_content(topic: str, platform: str) -> str:
    import httpx
    from app.core.config import settings

    hints = {
        "facebook_page": "Write a Facebook post (150-250 words). Include 3-5 hashtags at the end.",
        "instagram":     "Write an Instagram caption (100-180 words). Include 8-12 hashtags at the end.",
    }
    hint = hints.get(platform, "Write a social media post with relevant hashtags.")

    prompt = (
        "You are a social media manager for an NGO focused on sanitation, "
        "menstrual hygiene and WASH (Water, Sanitation, Hygiene).\n\n"
        f"Write a social media post about: {topic}\n\n"
        f"{hint}\n\n"
        "Write ONLY the post text. No quotes, no 'Here is your post:' prefix."
    )

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json={
                "model": settings.DEFAULT_AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 600,
                "temperature": 0.85,
            },
        )
    if res.status_code != 200:
        raise RuntimeError(f"Groq error {res.status_code}: {res.text[:300]}")
    return res.json()["choices"][0]["message"]["content"].strip()


# ── Helper: post to Meta ──────────────────────────────────────────────────────

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
                raise RuntimeError(f"FB error: {r.json().get('error',{}).get('message', r.text)}")
            return r.json().get("id") or r.json().get("post_id", "")

        if account.platform == "instagram":
            if not image_url:
                raise RuntimeError("Instagram requires an image_url")
            c = await client.post(f"{GRAPH}/{account.account_id}/media",
                                  data={"image_url": image_url, "caption": content,
                                        "access_token": token})
            if c.status_code != 200:
                raise RuntimeError(f"IG container: {c.json().get('error',{}).get('message', c.text)}")
            p = await client.post(f"{GRAPH}/{account.account_id}/media_publish",
                                  data={"creation_id": c.json()["id"], "access_token": token})
            if p.status_code != 200:
                raise RuntimeError(f"IG publish: {p.json().get('error',{}).get('message', p.text)}")
            return p.json().get("id", "")

    raise RuntimeError(f"Unsupported platform: {account.platform}")


# ── Job 1: publish manually-scheduled posts ───────────────────────────────────

async def process_scheduled_posts() -> None:
    """Mark campaign posts with scheduled_at <= now as published."""
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import CampaignPost

    try:
        async with async_session_factory() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(CampaignPost).where(
                    and_(CampaignPost.status == "scheduled",
                         CampaignPost.scheduled_at <= now)
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
        logger.error("process_scheduled_posts error: %s", exc)


# ── Job 2: run auto-campaigns ─────────────────────────────────────────────────

async def run_auto_campaigns() -> None:
    """
    Every 5 min: find active auto-campaigns where next_run_at <= now.
    For each: generate content with Groq → post to Meta → save CampaignPost
              → advance next_run_at.
    """
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignPost, SocialAccount

    try:
        async with async_session_factory() as db:
            now = datetime.now(timezone.utc)

            result = await db.execute(
                select(Campaign).where(
                    and_(
                        Campaign.is_scheduled == True,
                        Campaign.status == "active",
                        Campaign.next_run_at != None,
                        Campaign.next_run_at <= now,
                        Campaign.social_account_id != None,
                    )
                ).limit(10)
            )
            campaigns = result.scalars().all()
            if not campaigns:
                return

            logger.info("Auto-campaigns due: %d", len(campaigns))

            for campaign in campaigns:
                try:
                    # Load social account
                    sa = (await db.execute(
                        select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
                    )).scalar_one_or_none()

                    if not sa or not sa.is_active:
                        logger.warning("Campaign %s: social account missing/inactive", campaign.id)
                        campaign.next_run_at = _next_run(
                            campaign.frequency, campaign.post_time, campaign.post_days or [], now
                        )
                        continue

                    # Generate content
                    topic = campaign.topic or campaign.name
                    content = await _generate_content(topic, sa.platform)

                    # Post to Meta
                    platform_post_id = await _post_to_meta(sa, content, campaign.image_url)

                    # Save record
                    cp = CampaignPost(
                        campaign_id=campaign.id,
                        platform=sa.platform,
                        content=content,
                        status="published",
                        published_at=now,
                        sequence_order=(campaign.published_posts or 0) + 1,
                        media_urls=[platform_post_id] if platform_post_id else [],
                    )
                    db.add(cp)
                    campaign.published_posts = (campaign.published_posts or 0) + 1
                    campaign.total_posts     = (campaign.total_posts     or 0) + 1
                    campaign.last_run_at     = now
                    campaign.next_run_at     = _next_run(
                        campaign.frequency, campaign.post_time, campaign.post_days or [], now
                    )
                    logger.info("Campaign '%s' posted to %s | next: %s",
                                campaign.name, sa.platform, campaign.next_run_at)

                except Exception as exc:
                    logger.error("Campaign %s failed: %s", campaign.id, exc)
                    db.add(CampaignPost(
                        campaign_id=campaign.id,
                        platform="unknown",
                        content=f"[Auto-post failed: {str(exc)[:300]}]",
                        status="failed",
                    ))
                    # Advance anyway to avoid infinite retry loop
                    campaign.next_run_at = _next_run(
                        campaign.frequency, campaign.post_time, campaign.post_days or [], now
                    )

            await db.commit()

    except Exception as exc:
        logger.error("run_auto_campaigns error: %s", exc, exc_info=True)


# ── Scheduler init ────────────────────────────────────────────────────────────

def init_scheduler() -> None:
    scheduler.add_job(process_scheduled_posts, trigger="interval", minutes=5,
                      id="post_publisher",        replace_existing=True)
    scheduler.add_job(run_auto_campaigns,         trigger="interval", minutes=5,
                      id="auto_campaign_runner",  replace_existing=True)
