"""
Celery tasks for analytics aggregation.
"""
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger("brandora.workers.analytics")


def _run_async(coro):
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
    return loop.run_until_complete(coro)


@celery_app.task(name="app.workers.analytics_tasks.reset_monthly_generation_counts")
def reset_monthly_generation_counts() -> dict:
    """
    Beat task: reset ai_generations_used for all orgs on billing period reset.
    Runs on the 1st of each month via Celery Beat.
    """
    from app.core.database import async_session_factory
    from app.schemas.organization import Organization
    from sqlalchemy import select, update

    async def _reset():
        async with async_session_factory() as session:
            await session.execute(
                update(Organization).values(ai_generations_used=0)
            )
            await session.commit()
            logger.info("Monthly generation counts reset for all organizations.")
        return {"status": "reset_complete"}

    return _run_async(_reset())


@celery_app.task(name="app.workers.analytics_tasks.compute_content_quality_backfill")
def compute_content_quality_backfill() -> dict:
    """
    Backfill quality scores for content generations that don't have them.
    """
    from app.core.database import async_session_factory
    from app.schemas.content import ContentGeneration
    from app.services.ai_service import AIService
    from sqlalchemy import select

    async def _backfill():
        ai_service = AIService()
        async with async_session_factory() as session:
            result = await session.execute(
                select(ContentGeneration)
                .where(
                    ContentGeneration.quality_score.is_(None),
                    ContentGeneration.is_deleted == False,
                )
                .limit(50)
            )
            items = result.scalars().all()
            updated = 0
            for item in items:
                try:
                    score = ai_service._heuristic_quality_score(item.generated_content, item.platform)
                    item.quality_score = score
                    updated += 1
                except Exception as exc:
                    logger.warning("Quality backfill failed for item", item_id=str(item.id), error=str(exc))
            await session.commit()
        return {"updated": updated}

    return _run_async(_backfill())
