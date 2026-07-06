import logging

from celery import shared_task

from app.db.database import SessionLocal
from app.services.portal_narrowing_service import run_narrowing_batch
from app.services.portal_same_day_service import process_scheduling_deadlines

logger = logging.getLogger(__name__)


@shared_task(name="app.background.tasks.portal_scheduling.run_narrowing_batch")
def run_narrowing_batch_task():
    """Send narrowed ETA notices for tomorrow's appointments (default 5:30 PM shop time)."""
    db = SessionLocal()
    try:
        count = run_narrowing_batch(db)
        if count:
            logger.info("Portal narrowing batch processed %s appointment(s)", count)
        return count
    except Exception as exc:
        logger.error("Portal narrowing batch failed: %s", exc, exc_info=True)
        raise
    finally:
        db.close()


@shared_task(name="app.background.tasks.portal_scheduling.process_scheduling_deadlines")
def process_scheduling_deadlines_task():
    """Auto-deny pending same-day / priority requests past their cutoff."""
    db = SessionLocal()
    try:
        count = process_scheduling_deadlines(db)
        if count:
            logger.info("Auto-denied %s pending scheduling request(s)", count)
        return count
    except Exception as exc:
        logger.error("Scheduling deadline task failed: %s", exc, exc_info=True)
        raise
    finally:
        db.close()
