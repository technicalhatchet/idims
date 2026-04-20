from celery import Celery
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def setup_background_tasks():
    """Setup background tasks with Celery"""
    try:
        if settings.REDIS_URL:
            celery = Celery(
                'app',
                broker=settings.REDIS_URL,
                backend=settings.REDIS_URL
            )

            # Configure Celery
            celery.conf.update(
                task_serializer='json',
                accept_content=['json'],
                result_serializer='json',
                timezone='UTC',
                enable_utc=True,
                task_track_started=True,
                task_time_limit=30 * 60,  # 30 minutes
                worker_prefetch_multiplier=1,
                worker_max_tasks_per_child=50,
                broker_connection_retry=True,
                broker_connection_retry_on_startup=True,
                broker_connection_max_retries=None,
                beat_schedule={
                    # Invoice overdue check - run daily at midnight
                    "check-overdue-invoices": {
                        "task": "app.background.tasks.invoices.check_overdue_invoices",
                        "schedule": 86400,  # 24 hours
                    },
                    
                    # Appointment reminders - run every hour
                    "send-appointment-reminders": {
                        "task": "app.background.tasks.reminders.send_appointment_reminders",
                        "schedule": 3600,  # 1 hour
                    },
                    
                    # Daily report generation - run at 1 AM
                    "generate-daily-reports": {
                        "task": "app.background.tasks.reports.generate_daily_reports",
                        "schedule": 86400,  # 24 hours
                    },
                    
                    # Weekly report generation - run at 2 AM on Mondays
                    "generate-weekly-reports": {
                        "task": "app.background.tasks.reports.generate_weekly_reports",
                        "schedule": 604800,  # 7 days
                    },
                    
                    # Monthly report generation - run at 3 AM on the 1st of each month
                    "generate-monthly-reports": {
                        "task": "app.background.tasks.reports.generate_monthly_reports",
                        "schedule": 2592000,  # 30 days
                    },
                    
                    # Database maintenance - run at 4 AM on Sundays
                    "db-maintenance": {
                        "task": "app.background.tasks.maintenance.perform_db_maintenance",
                        "schedule": 604800,  # 7 days
                    },
                }
            )

            # Auto-discover tasks
            celery.autodiscover_tasks(['app.background.tasks'])

            logger.info("Celery background tasks initialized with Redis")
            return celery
        else:
            logger.warning("Redis URL not configured, background tasks will be disabled")
            return None
    except Exception as e:
        logger.error(f"Failed to initialize background tasks: {str(e)}")
        return None