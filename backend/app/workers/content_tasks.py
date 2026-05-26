"""
Celery tasks for async content generation.
"""
import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional

from app.workers.celery_app import celery_app

logger = logging.getLogger("brandora.workers.content")


def _run_async(coro):
    """Run an async coroutine in a Celery (sync) task."""
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
    default_retry_delay=30,
    name="app.workers.content_tasks.generate_content_async",
)
def generate_content_async(
    self,
    generation_id: str,
    topic: str,
    platform: str,
    brand_profile_data: Dict[str, Any],
    tone: str = "professional",
    context: Optional[str] = None,
    campaign_brief: Optional[str] = None,
    language: str = "en",
) -> Dict[str, Any]:
    """
    Async content generation task.
    Generates content and updates the DB record with results.
    """
    from app.services.ai_service import AIService
    from app.core.database import async_session_factory
    from app.schemas.content import ContentGeneration
    from sqlalchemy import select

    async def _generate():
        ai_service = AIService()
        result = await ai_service.generate_content(
            topic=topic,
            platform=platform,
            brand_profile=brand_profile_data,
            tone=tone,
            context=context,
            campaign_brief=campaign_brief,
            language=language,
        )

        # Update DB record
        async with async_session_factory() as session:
            db_result = await session.execute(
                select(ContentGeneration).where(
                    ContentGeneration.id == uuid.UUID(generation_id)
                )
            )
            generation = db_result.scalar_one_or_none()
            if generation:
                generation.generated_content = result["content"]
                generation.hashtags = result.get("hashtags", [])
                generation.quality_score = result.get("quality_score")
                generation.ai_model_used = result["model"]
                generation.tokens_used = result.get("tokens_used", 0)
                await session.commit()

        return result

    try:
        return _run_async(_generate())
    except Exception as exc:
        logger.error("Content generation task failed", generation_id=generation_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    name="app.workers.content_tasks.bulk_generate_campaign_content",
)
def bulk_generate_campaign_content(
    self,
    campaign_id: str,
    posts_config: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Generate multiple pieces of content for a campaign in bulk.
    posts_config: list of dicts with keys: topic, platform, tone, context
    """
    from app.services.ai_service import AIService
    from app.core.database import async_session_factory
    from app.schemas.campaign import Campaign, CampaignPost
    from sqlalchemy import select

    async def _bulk_generate():
        ai_service = AIService()
        results = []

        for post_cfg in posts_config:
            try:
                result = await ai_service.generate_content(
                    topic=post_cfg.get("topic", ""),
                    platform=post_cfg.get("platform", "linkedin"),
                    tone=post_cfg.get("tone", "professional"),
                    context=post_cfg.get("context"),
                    campaign_brief=post_cfg.get("campaign_brief"),
                )
                results.append({"success": True, "config": post_cfg, "result": result})
            except Exception as exc:
                results.append({"success": False, "config": post_cfg, "error": str(exc)})

        # Update campaign total posts
        async with async_session_factory() as session:
            campaign_result = await session.execute(
                select(Campaign).where(Campaign.id == uuid.UUID(campaign_id))
            )
            campaign = campaign_result.scalar_one_or_none()
            if campaign:
                successful = sum(1 for r in results if r["success"])
                campaign.total_posts = (campaign.total_posts or 0) + successful
                await session.commit()

        return {"campaign_id": campaign_id, "results": results}

    try:
        return _run_async(_bulk_generate())
    except Exception as exc:
        logger.error("Bulk generation failed", campaign_id=campaign_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="app.workers.content_tasks.repurpose_content_async",
)
def repurpose_content_async(
    self,
    content_id: str,
    target_platforms: List[str],
    brand_profile_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Asynchronously repurpose content for multiple platforms.
    """
    from app.services.ai_service import AIService
    from app.core.database import async_session_factory
    from app.schemas.content import ContentGeneration
    from sqlalchemy import select

    async def _repurpose():
        async with async_session_factory() as session:
            result = await session.execute(
                select(ContentGeneration).where(
                    ContentGeneration.id == uuid.UUID(content_id)
                )
            )
            source = result.scalar_one_or_none()
            if not source:
                return {"error": f"Content {content_id} not found"}

            ai_service = AIService()
            repurposed = await ai_service.repurpose_content(
                original_content=source.generated_content,
                original_platform=source.platform,
                target_platforms=target_platforms,
                brand_profile=brand_profile_data,
            )

            # Save repurposed generations
            saved_ids = []
            for item in repurposed:
                gen = ContentGeneration(
                    id=uuid.uuid4(),
                    organization_id=source.organization_id,
                    user_id=source.user_id,
                    input_topic=source.input_topic,
                    platform=item["platform"],
                    tone=source.tone,
                    generated_content=item["content"],
                    hashtags=item.get("hashtags", []),
                    quality_score=item.get("quality_score"),
                    ai_model_used=item["model"],
                    tokens_used=item.get("tokens_used", 0),
                    is_repurposed=True,
                    parent_generation_id=source.id,
                )
                session.add(gen)
                saved_ids.append(str(gen.id))

            source.is_repurposed = True
            await session.commit()

        return {"source_id": content_id, "repurposed_ids": saved_ids}

    try:
        return _run_async(_repurpose())
    except Exception as exc:
        logger.error("Repurpose task failed", content_id=content_id, error=str(exc))
        raise self.retry(exc=exc)
