"""
Campaign Automation Engine — core logic.

Responsibilities:
  1. generate_schedule()     — creates all CampaignPost slot records for a campaign
  2. generate_post_content() — uses Groq AI to create unique content for one post
  3. generate_post_image()   — delegates to image_generation service
  4. _next_slots()           — internal schedule calculator
"""
import logging
from datetime import datetime, time, timedelta, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.schemas.campaign import Campaign, CampaignPost

logger = logging.getLogger("brandora.engine")

_IST = timezone(timedelta(hours=5, minutes=30))
_UTC = timezone.utc

# Platform-specific writing guides
_PLATFORM_GUIDES: dict[str, str] = {
    "instagram": (
        "Instagram caption (100-180 words). "
        "Start with a hook sentence. Use line breaks for readability. "
        "Include 8-12 relevant hashtags at the very end."
    ),
    "facebook_page": (
        "Facebook post (150-250 words). "
        "Conversational tone. Include a question to drive engagement. "
        "Add 3-5 hashtags at the end."
    ),
    "linkedin": (
        "LinkedIn post (150-300 words). "
        "Professional tone. Use bullet points or short paragraphs. "
        "End with a thought-provoking question. Add 3-5 professional hashtags."
    ),
    "twitter": (
        "Twitter/X post (max 280 characters including hashtags). "
        "Punchy, direct. Include 2-3 hashtags."
    ),
}


def _parse_time(post_time: str) -> tuple[int, int]:
    try:
        h, m = map(int, (post_time or "09:00").split(":"))
        return h, m
    except Exception:
        return 9, 0


def _day_abbr_to_int(abbr: str) -> int | None:
    mapping = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
    return mapping.get(abbr.lower())


def generate_schedule_times(
    start_date,
    end_date,
    frequency: str,
    post_time: str,
    post_days: list[str] | None,
) -> list[datetime]:
    """
    Return a list of UTC datetimes for every scheduled slot in the campaign window.
    All times are expressed in IST then converted to UTC.
    """
    hour, minute = _parse_time(post_time)
    post_days = post_days or []

    start_ist = datetime.combine(start_date, time(hour, minute)).replace(tzinfo=_IST)
    end_ist   = datetime.combine(end_date,   time(23, 59, 59)).replace(tzinfo=_IST)
    now_utc   = datetime.now(_UTC)

    slots: list[datetime] = []
    cursor = start_ist

    if frequency == "daily":
        while cursor <= end_ist:
            utc_slot = cursor.astimezone(_UTC)
            if utc_slot > now_utc:
                slots.append(utc_slot)
            cursor += timedelta(days=1)

    elif frequency == "alternate_days":
        while cursor <= end_ist:
            utc_slot = cursor.astimezone(_UTC)
            if utc_slot > now_utc:
                slots.append(utc_slot)
            cursor += timedelta(days=2)

    elif frequency == "weekly":
        target_days = [d for abbr in post_days if (d := _day_abbr_to_int(abbr)) is not None]
        if not target_days:
            target_days = [0, 2, 4]  # Mon / Wed / Fri default
        while cursor <= end_ist:
            if cursor.weekday() in target_days:
                utc_slot = cursor.astimezone(_UTC)
                if utc_slot > now_utc:
                    slots.append(utc_slot)
            cursor += timedelta(days=1)

    elif frequency == "monthly":
        while cursor <= end_ist:
            utc_slot = cursor.astimezone(_UTC)
            if utc_slot > now_utc:
                slots.append(utc_slot)
            # Advance to same day next month
            m = cursor.month + 1
            y = cursor.year
            if m > 12:
                m, y = 1, y + 1
            import calendar
            d = min(cursor.day, calendar.monthrange(y, m)[1])
            cursor = cursor.replace(year=y, month=m, day=d)

    elif frequency == "custom" and post_days:
        # custom: post_days treated as specific weekday abbreviations
        target_days = [d for abbr in post_days if (d := _day_abbr_to_int(abbr)) is not None]
        while cursor <= end_ist:
            if cursor.weekday() in target_days:
                utc_slot = cursor.astimezone(_UTC)
                if utc_slot > now_utc:
                    slots.append(utc_slot)
            cursor += timedelta(days=1)

    return slots


async def generate_post_content(
    campaign,
    platform: str,
    post_index: int,
    total_posts: int,
) -> tuple[str, list[str]]:
    """
    Generate unique content for a single campaign post using Groq AI.
    Returns (content_text, hashtags_list).
    """
    import httpx
    from app.core.config import settings

    guide = _PLATFORM_GUIDES.get(platform, "social media post with relevant hashtags")

    topic = campaign.topic or campaign.name
    goal = campaign.campaign_goal or "raise awareness"
    audience = campaign.target_audience or "general public"
    tone = campaign.tone or "professional"
    keywords_text = ", ".join(campaign.keywords or [])
    cta = campaign.cta or ""
    hashtags_hint = ", ".join(campaign.target_hashtags or [])

    # Vary content focus to avoid repetition across posts
    variation_hints = [
        "Focus on the problem and why it matters.",
        "Share an inspiring story or statistic.",
        "Highlight the impact of the solution.",
        "Use a call-to-action angle — motivate the audience to act.",
        "Educate the audience with a key fact or tip.",
        "Celebrate progress or milestones.",
        "Ask a thought-provoking question to spark discussion.",
    ]
    variation = variation_hints[post_index % len(variation_hints)]

    prompt = (
        f"You are a social media content writer for an NGO.\n\n"
        f"Campaign: {campaign.name}\n"
        f"Goal: {goal}\n"
        f"Topic: {topic}\n"
        f"Target audience: {audience}\n"
        f"Tone: {tone}\n"
        f"Keywords to include: {keywords_text}\n"
        f"CTA to include: {cta}\n"
        f"Relevant hashtags: {hashtags_hint}\n\n"
        f"Post {post_index + 1} of {total_posts} — {variation}\n\n"
        f"Write a {guide}\n\n"
        "IMPORTANT: Make this post UNIQUE — do not repeat content from previous posts. "
        "Output ONLY the post text. No 'Here is your post:' prefix, no quotes."
    )

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json={
                "model": settings.DEFAULT_AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 700,
                "temperature": 0.88,
            },
        )

    if res.status_code != 200:
        raise RuntimeError(f"Groq error {res.status_code}: {res.text[:200]}")

    full_text = res.json()["choices"][0]["message"]["content"].strip()

    # Extract hashtags from content
    import re
    hashtag_pattern = re.compile(r"#\w+")
    found_hashtags = hashtag_pattern.findall(full_text)

    return full_text, found_hashtags
