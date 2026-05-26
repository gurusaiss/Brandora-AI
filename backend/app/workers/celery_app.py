"""
Celery application factory and configuration.
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "brandora_ai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.content_tasks",
        "app.workers.scheduler_tasks",
        "app.workers.analytics_tasks",
    ],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="Asia/Kolkata",
    enable_utc=True,
    # Routing
    task_routes={
        "app.workers.content_tasks.*": {"queue": "content"},
        "app.workers.scheduler_tasks.*": {"queue": "scheduler"},
        "app.workers.analytics_tasks.*": {"queue": "analytics"},
    },
    task_default_queue="default",
    # Reliability
    worker_prefetch_multiplier=1,  # One task at a time per worker
    task_acks_late=True,           # Ack after completion (retries on worker crash)
    task_reject_on_worker_lost=True,
    # Result expiry
    result_expires=86400,          # 24 hours
    # Rate limits
    task_annotations={
        "app.workers.content_tasks.generate_content_async": {"rate_limit": "60/m"},
        "app.workers.content_tasks.bulk_generate_campaign_content": {"rate_limit": "10/m"},
    },
)
