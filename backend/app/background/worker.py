import os
import logging
from celery import Celery
from celery.schedules import crontab

from app.config import settings

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "service_business",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    broker_connection_retry_on_startup=True
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    worker_prefetch_multiplier=1,
    worker_concurrency=settings.WORKERS,
    worker_max_tasks_per_child=1000,
)

# Auto-discover tasks in app/background/tasks
celery_app.autodiscover_tasks(
    ["app.background.tasks.invoices", "app.background.tasks.reminders", "app.background.tasks.reports"]
)

# Configure periodic tasks
celery_app.conf.beat_schedule = {
    # Invoice overdue check - run daily at midnight
    "check-overdue-invoices": {
        "task": "app.background.tasks.invoices.check_overdue_invoices",
        "schedule": crontab(hour=0, minute=0),
    },
    
    # Appointment reminders - run every hour
    "send-appointment-reminders": {
        "task": "app.background.tasks.reminders.send_appointment_reminders",
        "schedule": crontab(minute=0),
    },
    
    # Daily report generation - run at 1 AM
    "generate-daily-reports": {
        "task": "app.background.tasks.reports.generate_daily_reports",
        "schedule": crontab(hour=1, minute=0),
    },
    
    # Weekly report generation - run at 2 AM on Mondays
    "generate-weekly-reports": {
        "task": "app.background.tasks.reports.generate_weekly_reports",
        "schedule": crontab(hour=2, minute=0, day_of_week=1),
    },
    
    # Monthly report generation - run at 3 AM on the 1st of each month
    "generate-monthly-reports": {
        "task": "app.background.tasks.reports.generate_monthly_reports",
        "schedule": crontab(hour=3, minute=0, day_of_month=1),
    },
    
    # Database maintenance - run at 4 AM on Sundays
    "db-maintenance": {
        "task": "app.background.tasks.maintenance.perform_db_maintenance",
        "schedule": crontab(hour=4, minute=0, day_of_week=0),
    },
}

def setup_background_tasks():
    """Setup and return Celery app for background tasks"""
    logger.info("Setting up background tasks with Celery")
    return celery_app