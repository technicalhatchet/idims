import logging

from celery import shared_task

from app.db.database import SessionLocal
from app.services.web_push_service import process_due_deploy_reminders

logger = logging.getLogger(__name__)


@shared_task(name="app.background.tasks.push.process_deploy_reminders")
def process_deploy_reminders():
    """Fire deploy nudges when travel_time_before + buffer has elapsed."""
    logger.debug("Processing due deploy reminders")
    db = SessionLocal()
    try:
        sent = process_due_deploy_reminders(db)
        if sent:
            logger.info("Sent %s deploy reminder push(es)", sent)
        return sent
    except Exception as exc:
        logger.error("Deploy reminder task failed: %s", exc, exc_info=True)
        raise
    finally:
        db.close()


@shared_task(name="app.background.tasks.push.send_morning_schedule_summaries")
def send_morning_schedule_summaries_task():
    """Daily morning push: job count + first appointment time for subscribed staff."""
    from app.services.web_push_service import send_morning_schedule_summaries

    logger.info("Sending morning schedule summary pushes")
    db = SessionLocal()
    try:
        sent = send_morning_schedule_summaries(db)
        if sent:
            logger.info("Sent morning schedule summary to %s user(s)", sent)
        return sent
    except Exception as exc:
        logger.error("Morning schedule summary task failed: %s", exc, exc_info=True)
        raise
    finally:
        db.close()
