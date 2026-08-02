"""
APScheduler — runs inside the FastAPI process (no separate worker needed).

Jobs:
  1. generate_upcoming_content  — hourly: generate content+image for posts due in next 4h
  2. process_campaign_posts     — every 5 min: publish posts that are ready
  3. retry_failed_posts         — every 15 min: retry failed posts up to max_retries
  4. run_auto_campaigns         — every 5 min: legacy simple auto-campaigns
  5. reset_monthly_quotas       — daily 00:15 IST: zero ai_generations_used on the 1st

Publishing goes through app.services.publisher.publish_to_platform, which supports
Facebook Pages, Instagram Business, LinkedIn and Twitter/X.

Design rule: every scheduler function uses THREE phases so that no DB connection
is held open while making external HTTP calls (Groq, Meta Graph, image APIs):

  Phase 1 — short DB session: load data, mark in-progress, commit, close session
  Phase 2 — HTTP calls: no DB session open at all
  Phase 3 — short DB session: write results, commit, close session
"""
import calendar
import logging
import uuid as _uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

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


# ── Schedule helpers ──────────────────────────────────────────────────────────

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


# ── Lightweight duck-type for the publisher ───────────────────────────────────

class _MockSA:
    """Minimal duck-type of SocialAccount, used outside any DB session."""
    __slots__ = ("platform", "account_id", "access_token")

    def __init__(self, platform: str, account_id: str, access_token: str) -> None:
        self.platform     = platform
        self.account_id   = account_id
        self.access_token = access_token


# ── Publishing helper ─────────────────────────────────────────────────────────
# Delegates to the shared publisher service so the scheduler, the manual
# "Publish now" route, and the Celery worker all use identical platform logic.
# Supports facebook_page, instagram, linkedin and twitter.

async def _publish(account, content: str, image_url: str | None) -> str:
    from app.services.publisher import publish_to_platform
    return await publish_to_platform(account, content, image_url)


# ── Job 1: generate content for upcoming posts ────────────────────────────────

@dataclass
class _ContentJob:
    post_id:        _uuid.UUID
    campaign_id:    _uuid.UUID
    campaign:       Any          # detached Campaign ORM — simple attrs still accessible
    platform:       str
    post_index:     int
    total_posts:    int
    generate_images: bool


@dataclass
class _ContentResult:
    post_id:      _uuid.UUID
    campaign_id:  _uuid.UUID
    content:      str = ""
    hashtags:     list = field(default_factory=list)
    image_url:    Optional[str] = None
    image_prompt: Optional[str] = None
    image_model:  Optional[str] = None
    error:        Optional[str] = None


async def generate_upcoming_content() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignImage, CampaignPost

    # ── Phase 1: load posts, mark generating ─────────────────────────────────
    jobs: list[_ContentJob] = []
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

            logger.info("Generating content for %d upcoming posts", len(posts))

            for post in posts:
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

                post.status = "generating"
                jobs.append(_ContentJob(
                    post_id=post.id, campaign_id=campaign.id, campaign=campaign,
                    platform=post.platform, post_index=post_index,
                    total_posts=len(all_posts), generate_images=campaign.generate_images,
                ))

            await db.commit()
    except Exception as exc:
        logger.error("generate_upcoming_content load error: %s", exc, exc_info=True)
        return

    if not jobs:
        return

    # ── Phase 2: AI generation (no DB session held) ───────────────────────────
    from app.services.campaign_engine import generate_post_content

    results: list[_ContentResult] = []
    for job in jobs:
        res = _ContentResult(post_id=job.post_id, campaign_id=job.campaign_id)
        try:
            content, hashtags = await generate_post_content(
                job.campaign, job.platform, job.post_index, job.total_posts
            )
            res.content  = content
            res.hashtags = hashtags

            if job.generate_images:
                try:
                    from app.services.image_generation import generate_campaign_image
                    img_url, prompt, model = await generate_campaign_image(
                        campaign_id=str(job.campaign_id), post_id=str(job.post_id),
                        campaign_name=job.campaign.name,
                        campaign_goal=job.campaign.campaign_goal or job.campaign.name,
                        topic=job.campaign.topic or job.campaign.name,
                        platform=job.platform, keywords=job.campaign.keywords,
                    )
                    res.image_url    = img_url
                    res.image_prompt = prompt
                    res.image_model  = model
                except Exception as img_exc:
                    logger.warning("Image gen failed post %s: %s", job.post_id, img_exc)
        except Exception as exc:
            logger.error("Content gen failed post %s: %s", job.post_id, exc)
            res.error = str(exc)[:300]
        results.append(res)

    # ── Phase 3: write results ────────────────────────────────────────────────
    try:
        async with async_session_factory() as db:
            for res in results:
                post = (await db.execute(
                    select(CampaignPost).where(CampaignPost.id == res.post_id)
                )).scalar_one_or_none()
                if not post:
                    continue

                if res.error:
                    post.status         = "scheduled"   # reset so it retries next hour
                    post.failure_reason = res.error
                else:
                    post.content  = res.content
                    post.hashtags = res.hashtags
                    post.status   = "scheduled"
                    if res.image_url:
                        post.image_url = res.image_url
                        db.add(CampaignImage(
                            campaign_id=res.campaign_id, post_id=res.post_id,
                            image_url=res.image_url, prompt_used=res.image_prompt,
                            model_used=res.image_model or "pollinations",
                        ))

            await db.commit()
    except Exception as exc:
        logger.error("generate_upcoming_content write error: %s", exc, exc_info=True)


# ── Job 2: publish scheduled posts ───────────────────────────────────────────

@dataclass
class _PostJob:
    post_id:      _uuid.UUID
    campaign_id:  _uuid.UUID
    content:      str
    image_url:    Optional[str]
    platform:     str
    account_id:   str
    access_token: str
    retry_count:  int
    max_retries:  int


async def process_campaign_posts() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignPost, SocialAccount

    # ── Phase 1: load posts, mark publishing ─────────────────────────────────
    jobs: list[_PostJob] = []
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
                campaign = (await db.execute(
                    select(Campaign).where(Campaign.id == post.campaign_id)
                )).scalar_one_or_none()

                if not campaign:
                    post.status         = "failed"
                    post.failure_reason = "Campaign not found"
                    continue

                # Skip posts whose campaign has been archived or completed
                if campaign.status in ("archived", "completed", "cancelled"):
                    post.status         = "failed"
                    post.failure_reason = f"Campaign is {campaign.status}"
                    continue

                if not campaign.social_account_id:
                    post.status         = "failed"
                    post.failure_reason = "No social account linked"
                    continue

                sa = (await db.execute(
                    select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
                )).scalar_one_or_none()

                if not sa or not sa.is_active:
                    post.status         = "failed"
                    post.failure_reason = "Social account inactive"
                    continue

                post.status = "publishing"
                jobs.append(_PostJob(
                    post_id=post.id, campaign_id=campaign.id,
                    content=post.content, image_url=post.image_url,
                    platform=sa.platform, account_id=sa.account_id,
                    access_token=sa.access_token,
                    retry_count=post.retry_count or 0,
                    max_retries=post.max_retries or 3,
                ))

            await db.commit()
    except Exception as exc:
        logger.error("process_campaign_posts load error: %s", exc, exc_info=True)
        return

    if not jobs:
        return

    # ── Phase 2: HTTP calls (no DB session open) ──────────────────────────────
    now = datetime.now(_UTC)
    outcomes: list[tuple] = []  # (post_id, campaign_id, ok, platform_id_or_err, retry_count)
    for job in jobs:
        try:
            pid = await _publish(
                _MockSA(job.platform, job.account_id, job.access_token),
                job.content, job.image_url,
            )
            outcomes.append((job.post_id, job.campaign_id, True, pid, job.retry_count))
        except Exception as exc:
            logger.error("Publish failed post %s: %s", job.post_id, exc)
            outcomes.append((job.post_id, job.campaign_id, False, str(exc)[:500], job.retry_count + 1))

    # ── Phase 3: write results ────────────────────────────────────────────────
    try:
        async with async_session_factory() as db:
            for post_id, campaign_id, ok, payload, retry_count in outcomes:
                post = (await db.execute(
                    select(CampaignPost).where(CampaignPost.id == post_id)
                )).scalar_one_or_none()
                if not post:
                    continue

                if ok:
                    post.status           = "published"
                    post.published_at     = now
                    post.platform_post_id = payload
                    campaign = (await db.execute(
                        select(Campaign).where(Campaign.id == campaign_id)
                    )).scalar_one_or_none()
                    if campaign:
                        campaign.published_posts = (campaign.published_posts or 0) + 1
                else:
                    post.retry_count    = retry_count
                    post.failure_reason = payload
                    post.status = "failed" if retry_count >= (post.max_retries or 3) else "retrying"

            await db.commit()
    except Exception as exc:
        logger.error("process_campaign_posts write error: %s", exc, exc_info=True)


# ── Job 3: reset retrying posts ───────────────────────────────────────────────

async def retry_failed_posts() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import CampaignPost

    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(CampaignPost).where(
                    and_(
                        CampaignPost.status == "retrying",
                        CampaignPost.retry_count < CampaignPost.max_retries,
                    )
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


# ── Job 4: run simple auto-campaigns ─────────────────────────────────────────

@dataclass
class _AutoJob:
    campaign_id:    _uuid.UUID
    campaign:       Any          # detached Campaign ORM — simple attrs still accessible
    frequency:      str
    post_time:      str
    post_days:      list
    platform:       str
    account_id:     str
    access_token:   str
    published_posts: int
    total_posts:    int
    image_url:      Optional[str]


@dataclass
class _AutoResult:
    campaign_id:    _uuid.UUID
    frequency:      str
    post_time:      str
    post_days:      list
    platform:       str
    ok:             bool
    platform_id:    str = ""
    content:        str = ""
    hashtags:       list = field(default_factory=list)
    error:          str = ""


async def run_auto_campaigns() -> None:
    from sqlalchemy import and_, select
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignPost, SocialAccount
    from app.services.campaign_engine import generate_post_content

    now = datetime.now(_UTC)

    # ── Phase 1: load due campaigns ───────────────────────────────────────────
    jobs: list[_AutoJob] = []
    try:
        async with async_session_factory() as db:
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
                sa = (await db.execute(
                    select(SocialAccount).where(SocialAccount.id == campaign.social_account_id)
                )).scalar_one_or_none()

                if not sa or not sa.is_active:
                    # Advance schedule even if SA is inactive
                    campaign.next_run_at = _next_run(
                        campaign.frequency, campaign.post_time, campaign.post_days or [], now
                    )
                    continue

                jobs.append(_AutoJob(
                    campaign_id=campaign.id, campaign=campaign,
                    frequency=campaign.frequency, post_time=campaign.post_time,
                    post_days=campaign.post_days or [],
                    platform=sa.platform, account_id=sa.account_id,
                    access_token=sa.access_token,
                    published_posts=campaign.published_posts or 0,
                    total_posts=campaign.total_posts or 999,
                    image_url=campaign.image_url,
                ))

            await db.commit()
    except Exception as exc:
        logger.error("run_auto_campaigns load error: %s", exc, exc_info=True)
        return

    if not jobs:
        return

    # ── Phase 2: generate content + post (no DB session) ─────────────────────
    auto_results: list[_AutoResult] = []
    for job in jobs:
        res = _AutoResult(
            campaign_id=job.campaign_id, frequency=job.frequency,
            post_time=job.post_time, post_days=job.post_days,
            platform=job.platform, ok=False,
        )
        try:
            content, hashtags = await generate_post_content(
                job.campaign, job.platform, job.published_posts, job.total_posts
            )
            pid = await _publish(
                _MockSA(job.platform, job.account_id, job.access_token),
                content, job.image_url,
            )
            res.ok        = True
            res.platform_id = pid
            res.content   = content
            res.hashtags  = hashtags
        except Exception as exc:
            logger.error("Auto-campaign %s failed: %s", job.campaign_id, exc)
            res.error = str(exc)[:500]
        auto_results.append(res)

    # ── Phase 3: persist results ───────────────────────────────────────────────
    now = datetime.now(_UTC)
    try:
        async with async_session_factory() as db:
            for res in auto_results:
                campaign = (await db.execute(
                    select(Campaign).where(Campaign.id == res.campaign_id)
                )).scalar_one_or_none()
                if not campaign:
                    continue

                if res.ok:
                    db.add(CampaignPost(
                        campaign_id=campaign.id, platform=res.platform,
                        content=res.content, hashtags=res.hashtags,
                        status="published", published_at=now, platform_post_id=res.platform_id,
                        sequence_order=(campaign.published_posts or 0) + 1,
                    ))
                    campaign.published_posts = (campaign.published_posts or 0) + 1
                    campaign.total_posts     = (campaign.total_posts or 0) + 1
                    campaign.last_run_at     = now
                else:
                    db.add(CampaignPost(
                        campaign_id=campaign.id, platform=res.platform,
                        content=f"[Failed: {res.error[:200]}]" if res.error else "[Failed]",
                        status="failed",
                        failure_reason=res.error[:500] if res.error else "Unknown error",
                    ))

                campaign.next_run_at = _next_run(res.frequency, res.post_time, res.post_days, now)

            await db.commit()
    except Exception as exc:
        logger.error("run_auto_campaigns write error: %s", exc, exc_info=True)


# ── Job 5: reset monthly AI generation quotas ─────────────────────────────────

async def reset_monthly_quotas() -> None:
    """
    Reset ai_generations_used to 0 for every organization at the start of a new
    billing month. Runs daily and no-ops unless it is the 1st of the month, so a
    missed cron day still resets on the next tick.
    """
    from sqlalchemy import update as sa_update
    from app.core.database import async_session_factory
    from app.schemas.organization import Organization

    now_ist = datetime.now(_IST)
    if now_ist.day != 1:
        return

    try:
        async with async_session_factory() as db:
            result = await db.execute(
                sa_update(Organization)
                .where(Organization.ai_generations_used > 0)
                .values(ai_generations_used=0)
            )
            await db.commit()
            logger.info("Monthly AI quotas reset for %d organizations", result.rowcount or 0)
    except Exception as exc:
        logger.error("reset_monthly_quotas error: %s", exc, exc_info=True)


# ── Job 6: refresh expiring social account tokens ─────────────────────────────

async def refresh_expiring_tokens() -> None:
    """
    Proactively refresh LinkedIn and Twitter OAuth tokens before they expire.
    Runs every 6 hours; targets accounts whose token expires within 7 days.

    Meta/Instagram: Page Access Tokens from long-lived UATs never expire — skipped.
    LinkedIn:       Access tokens last 60 days; refresh tokens last up to 1 year.
    Twitter:        Access tokens last 2 hours; refresh tokens are perpetual while used.
    """
    import base64 as _b64
    import httpx
    from sqlalchemy import select
    from app.core.database import async_session_factory
    from app.schemas.campaign import SocialAccount
    from app.core.config import settings

    LINKEDIN_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken"
    TWITTER_TOKEN  = "https://api.twitter.com/2/oauth2/token"

    cutoff = datetime.now(_UTC) + timedelta(days=7)

    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(SocialAccount).where(
                    SocialAccount.is_active       == True,
                    SocialAccount.platform.in_(["linkedin", "twitter"]),
                    SocialAccount.refresh_token   != None,
                    SocialAccount.token_expires_at <= cutoff,
                )
            )
            accounts = result.scalars().all()

        if not accounts:
            return

        logger.info("Token refresh: %d account(s) expiring within 7 days", len(accounts))

        async with httpx.AsyncClient(timeout=20) as client:
            for acct in accounts:
                try:
                    if acct.platform == "linkedin":
                        res = await client.post(
                            LINKEDIN_TOKEN,
                            data={
                                "grant_type":    "refresh_token",
                                "refresh_token": acct.refresh_token,
                                "client_id":     settings.LINKEDIN_CLIENT_ID,
                                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                            },
                            headers={"Content-Type": "application/x-www-form-urlencoded"},
                        )
                        if res.status_code != 200:
                            logger.warning("LinkedIn token refresh failed for %s: %s", acct.account_id, res.text)
                            continue
                        data = res.json()
                        new_access  = data.get("access_token")
                        new_refresh = data.get("refresh_token", acct.refresh_token)
                        expires_in  = data.get("expires_in", 5184000)

                    elif acct.platform == "twitter":
                        credentials = _b64.b64encode(
                            f"{settings.TWITTER_API_KEY}:{settings.TWITTER_API_SECRET}".encode()
                        ).decode()
                        res = await client.post(
                            TWITTER_TOKEN,
                            data={
                                "grant_type":    "refresh_token",
                                "refresh_token": acct.refresh_token,
                            },
                            headers={
                                "Authorization": f"Basic {credentials}",
                                "Content-Type":  "application/x-www-form-urlencoded",
                            },
                        )
                        if res.status_code != 200:
                            logger.warning("Twitter token refresh failed for %s: %s", acct.account_id, res.text)
                            continue
                        data = res.json()
                        new_access  = data.get("access_token")
                        new_refresh = data.get("refresh_token", acct.refresh_token)
                        expires_in  = data.get("expires_in", 7200)

                    else:
                        continue

                    # Write new tokens back
                    async with async_session_factory() as db2:
                        fresh = await db2.get(SocialAccount, acct.id)
                        if fresh:
                            fresh.access_token     = new_access
                            fresh.refresh_token    = new_refresh
                            fresh.token_expires_at = datetime.now(_UTC) + timedelta(seconds=expires_in)
                            await db2.commit()
                            logger.info("Refreshed %s token for %s", acct.platform, acct.account_name)

                except Exception as exc:
                    logger.error("Token refresh error for account %s: %s", acct.id, exc, exc_info=True)

    except Exception as exc:
        logger.error("refresh_expiring_tokens error: %s", exc, exc_info=True)


# ── Scheduler init ────────────────────────────────────────────────────────────

def init_scheduler() -> None:
    scheduler.add_job(generate_upcoming_content, trigger="interval", hours=1,
                      id="content_generator",   replace_existing=True)
    scheduler.add_job(process_campaign_posts,   trigger="interval", minutes=5,
                      id="post_publisher",       replace_existing=True)
    scheduler.add_job(retry_failed_posts,       trigger="interval", minutes=15,
                      id="retry_handler",        replace_existing=True)
    scheduler.add_job(run_auto_campaigns,       trigger="interval", minutes=5,
                      id="auto_campaign_runner", replace_existing=True)
    # Daily at 00:15 IST — no-ops on every day except the 1st
    scheduler.add_job(reset_monthly_quotas,     trigger="cron", hour=18, minute=45,
                      id="monthly_quota_reset",  replace_existing=True)
    # Every 6 hours: refresh LinkedIn/Twitter tokens expiring within 7 days
    scheduler.add_job(refresh_expiring_tokens,  trigger="interval", hours=6,
                      id="token_refresher",      replace_existing=True)
