"""
Image generation service for campaign posts.

Priority:
  1. OpenAI DALL-E 3   — if OPENAI_API_KEY is set (paid, ~$0.04/image)
  2. Pollinations.ai   — free, no API key required (URL-based generation)

Images are uploaded to Supabase Storage when possible for persistence.
If storage upload fails, the direct generation URL is used as fallback.
"""
import logging
import uuid
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger("brandora.image_gen")

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"
META_GRAPH = "https://graph.facebook.com/v19.0"


async def build_image_prompt(
    campaign_name: str,
    campaign_goal: str,
    topic: str,
    platform: str,
    keywords: list[str] | None = None,
) -> str:
    """Auto-generate an image prompt from campaign data using Groq."""
    platform_hints = {
        "instagram":     "square 1:1 ratio, vibrant colours, highly engaging visual",
        "facebook_page": "landscape 1.91:1, professional, clean background",
        "linkedin":      "professional corporate setting, 1.91:1 landscape",
        "twitter":       "bold, high-contrast, landscape, text-friendly background",
    }
    hint = platform_hints.get(platform, "social media optimised, clean design")
    kw_text = ", ".join(keywords[:5]) if keywords else ""

    prompt_body = (
        f"Create a concise image generation prompt (under 80 words) for a social media post.\n"
        f"Campaign: {campaign_name}\n"
        f"Goal: {campaign_goal}\n"
        f"Topic: {topic}\n"
        f"Keywords: {kw_text}\n"
        f"Platform spec: {hint}\n\n"
        "Rules: photorealistic or illustration style, no text/words in the image, "
        "inspirational, NGO/social-impact theme. Output ONLY the image prompt."
    )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                json={
                    "model": settings.DEFAULT_AI_MODEL,
                    "messages": [{"role": "user", "content": prompt_body}],
                    "max_tokens": 120,
                    "temperature": 0.7,
                },
            )
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("Prompt generation failed: %s", exc)

    return f"Inspiring NGO social impact image about {topic}, clean professional design, no text"


async def _generate_dalle(prompt: str) -> bytes | None:
    """Generate image bytes via DALL-E 3. Returns None if unavailable."""
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            response_format="url",
        )
        img_url = response.data[0].url
        async with httpx.AsyncClient(timeout=60) as hc:
            r = await hc.get(img_url)
            return r.content if r.status_code == 200 else None
    except Exception as exc:
        logger.warning("DALL-E generation failed: %s", exc)
        return None


def _pollinations_url(prompt: str) -> str:
    """Return a Pollinations.ai image URL (free, no key, generates on request)."""
    encoded = quote(prompt)
    return f"{POLLINATIONS_BASE}/{encoded}?width=1024&height=1024&nologo=true&enhance=true&seed={uuid.uuid4().int % 99999}"


async def _upload_to_supabase(image_bytes: bytes, path: str) -> str | None:
    """Upload bytes to Supabase Storage. Returns public URL or None."""
    try:
        from supabase import create_client
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        bucket = settings.SUPABASE_STORAGE_BUCKET

        sb.storage.from_(bucket).upload(
            path=path,
            file=image_bytes,
            file_options={"content-type": "image/png", "upsert": "true"},
        )
        public = sb.storage.from_(bucket).get_public_url(path)
        return public
    except Exception as exc:
        logger.warning("Supabase storage upload failed: %s", exc)
        return None


async def generate_campaign_image(
    campaign_id: str,
    post_id: str,
    campaign_name: str,
    campaign_goal: str,
    topic: str,
    platform: str,
    keywords: list[str] | None = None,
) -> tuple[str, str, str]:
    """
    Generate and persist an image for a campaign post.

    Returns (image_url, prompt_used, model_used).
    image_url is always a stable public URL.
    """
    image_prompt = await build_image_prompt(
        campaign_name, campaign_goal, topic, platform, keywords
    )
    model_used = "pollinations"

    # Try DALL-E 3 first if API key is configured
    if settings.OPENAI_API_KEY:
        image_bytes = await _generate_dalle(image_prompt)
        if image_bytes:
            model_used = "dall-e-3"
            storage_path = f"campaigns/{campaign_id}/{post_id}.png"
            stored_url = await _upload_to_supabase(image_bytes, storage_path)
            if stored_url:
                logger.info("Image stored in Supabase: %s", storage_path)
                return stored_url, image_prompt, model_used
            # Storage failed — Pollinations fallback below

    # Pollinations.ai: free, URL encodes the prompt, generates on-demand
    # The URL itself IS the image — stable as long as prompt doesn't change
    final_url = _pollinations_url(image_prompt)
    logger.info("Using Pollinations image (model=pollinations, campaign=%s)", campaign_id)
    return final_url, image_prompt, model_used
