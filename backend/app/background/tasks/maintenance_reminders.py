import logging

from celery import shared_task

from app.db.database import get_db_session

logger = logging.getLogger(__name__)


@shared_task(name="app.background.tasks.maintenance_reminders.send_maintenance_reminder_summaries")
def send_maintenance_reminder_summaries():
    logger.info("Starting maintenance reminder email batch")
    db = get_db_session()
    try:
        from app.services.maintenance_reminder_email_service import send_maintenance_summaries_sync

        sent = send_maintenance_summaries_sync(db)
        logger.info("Maintenance reminder emails sent: %s", sent)
        return sent
    except Exception as exc:
        logger.exception("Maintenance reminder batch failed: %s", exc)
        db.rollback()
        raise
    finally:
        db.close()
