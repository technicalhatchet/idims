import logging
import os
from typing import Optional

from celery import Celery
from celery.schedules import crontab

from app.config import settings

logger = logging.getLogger(__name__)


def resolve_redis_url() -> str:
    return (getattr(settings, "REDIS_URL", None) or os.getenv("REDIS_URL") or "").strip()


def setup_background_tasks() -> Celery:
    """Create Celery app. Raises if REDIS_URL is missing (worker/beat only)."""
    redis_url = resolve_redis_url()
    if not redis_url:
        raise RuntimeError(
            "REDIS_URL is required to run Celery worker or beat. "
            "Set REDIS_URL on the Railway worker and beat services."
        )

    celery = Celery(
        "app",
        broker=redis_url,
        backend=redis_url,
    )

    celery.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_time_limit=30 * 60,
        worker_prefetch_multiplier=1,
        worker_max_tasks_per_child=50,
        broker_connection_retry=True,
        broker_connection_retry_on_startup=True,
        broker_connection_max_retries=None,
        beat_schedule={
            "process-scheduled-outreach": {
                "task": "app.background.tasks.scheduled_outreach.process_scheduled_outreach_tick",
                "schedule": 300,
            },
            "process-deploy-reminders": {
                "task": "app.background.tasks.push.process_deploy_reminders",
                "schedule": 60,
            },
            "send-morning-schedule-summaries": {
                "task": "app.background.tasks.push.send_morning_schedule_summaries",
                "schedule": crontab(minute="0,15,30,45"),
            },
            "portal-narrowing-batch": {
                "task": "app.background.tasks.portal_scheduling.run_narrowing_batch",
                "schedule": crontab(minute="0,15,30,45"),
            },
            "portal-scheduling-deadlines": {
                "task": "app.background.tasks.portal_scheduling.process_scheduling_deadlines",
                "schedule": crontab(minute="*/15"),
            },
        },
    )

    celery.autodiscover_tasks(["app.background.tasks"])
    logger.info("Celery background tasks initialized with Redis")
    return celery


_redis = resolve_redis_url()
celery_app: Optional[Celery]
if _redis:
    try:
        celery_app = setup_background_tasks()
    except Exception as exc:
        logger.error("Failed to initialize Celery: %s", exc)
        celery_app = None
else:
    celery_app = None
    logger.warning("REDIS_URL not configured; Celery worker/beat unavailable (API may still run)")
