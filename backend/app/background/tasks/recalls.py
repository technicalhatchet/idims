import asyncio
import logging

from celery import shared_task
from celery.schedules import crontab

from app.db.database import SessionLocal

logger = logging.getLogger(__name__)


@shared_task(name="app.background.tasks.recalls.sync_cpsc_recalls_daily")
def sync_cpsc_recalls_daily():
    from app.services.feature_flags_service import feature_enabled_for_system
    from app.services.cpsc_recall_sync_service import run_cpsc_recall_sync
    from app.services.cpsc_recall_staff_notify_service import notify_staff_new_pending_recall_matches

    db = SessionLocal()
    try:
        if not feature_enabled_for_system(db, "recall_alerts"):
            return {"skipped": "feature_disabled"}
        new_recalls, new_pending, _total = run_cpsc_recall_sync(db)
        if new_pending > 0:
            asyncio.run(notify_staff_new_pending_recall_matches(db, new_pending))
        return {
            "new_recalls": new_recalls,
            "new_pending_matches": new_pending,
        }
    except Exception as exc:
        logger.error("CPSC recall sync failed: %s", exc, exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()
