import logging
from celery import shared_task
from datetime import datetime, timedelta
import os
from pathlib import Path
import shutil
import tempfile
import asyncio
from sqlalchemy import text

from app.config import settings
from app.db.database import get_db_session
from app.models.settings import SystemLog

logger = logging.getLogger(__name__)

@shared_task(name="app.background.tasks.maintenance.perform_db_maintenance")
def perform_db_maintenance():
    """Perform database maintenance tasks"""
    logger.info("Starting database maintenance task")
    
    try:
        # Get database session
        db = get_db_session()
        
        # 1. Database vacuum
        if settings.DATABASE_URL.startswith('postgresql'):
            try:
                logger.info("Running VACUUM ANALYZE on database")
                db.execute(text("VACUUM ANALYZE"))
                logger.info("VACUUM ANALYZE completed successfully")
            except Exception as e:
                logger.error(f"Error running VACUUM ANALYZE: {str(e)}")
        
        # 2. Clean up expired sessions
        try:
            # If using a sessions table
            logger.info("Cleaning up expired sessions")
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            result = db.execute(
                text("DELETE FROM sessions WHERE last_activity < :cutoff_date"),
                {"cutoff_date": thirty_days_ago}
            )
            logger.info(f"Deleted {result.rowcount} expired sessions")
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {str(e)}")
        
        # 3. Remove old notifications
        try:
            logger.info("Removing old notifications")
            ninety_days_ago = datetime.utcnow() - timedelta(days=90)
            result = db.execute(
                text("DELETE FROM notifications WHERE created_at < :cutoff_date AND is_read = true"),
                {"cutoff_date": ninety_days_ago}
            )
            logger.info(f"Deleted {result.rowcount} old notifications")
        except Exception as e:
            logger.error(f"Error cleaning up notifications: {str(e)}")
        
        # 4. Optimize database indexes
        if settings.DATABASE_URL.startswith('postgresql'):
            try:
                logger.info("Optimizing database indexes")
                db.execute(text("REINDEX DATABASE CONCURRENTLY"))
                logger.info("Database indexes optimized successfully")
            except Exception as e:
                logger.error(f"Error optimizing indexes: {str(e)}")
        
        # 5. Log maintenance activity
        SystemLog.log_event(
            db=db, 
            event_type="database_maintenance", 
            details={
                "timestamp": datetime.utcnow().isoformat(),
                "maintenance_type": "routine",
                "tasks_performed": [
                    "vacuum_analyze", 
                    "clean_expired_sessions", 
                    "remove_old_notifications",
                    "optimize_indexes"
                ]
            },
            severity="info"
        )
        
        # Commit changes
        db.commit()
        
        # Close the session
        db.close()
        
        logger.info("Database maintenance completed successfully")
        return "Database maintenance completed successfully"
        
    except Exception as e:
        logger.error(f"Error performing database maintenance: {str(e)}")
        if 'db' in locals():
            db.rollback()
            db.close()
        raise

@shared_task(name="app.background.tasks.maintenance.clean_temp_files")
def clean_temp_files():
    """Clean temporary files older than a certain threshold"""
    logger.info("Starting temporary file cleanup task")
    
    try:
        # Define temp directories to clean
        temp_dirs = [
            Path("storage/temp"),
            Path("storage/uploads/temp"),
            Path(tempfile.gettempdir()) / "service_business"
        ]
        
        # Ensure directories exist
        for temp_dir in temp_dirs:
            if not temp_dir.exists():
                continue
            
            # Set threshold (files older than 24 hours)
            threshold = datetime.now() - timedelta(hours=24)
            
            # Count files and track size
            total_files = 0
            total_size = 0
            
            # Clean old files
            for item in temp_dir.glob('**/*'):
                if item.is_file():
                    # Check file modification time
                    mtime = datetime.fromtimestamp(item.stat().st_mtime)
                    if mtime < threshold:
                        # Track stats before deletion
                        total_files += 1
                        total_size += item.stat().st_size
                        
                        # Delete file
                        try:
                            os.remove(item)
                        except (PermissionError, OSError) as e:
                            logger.warning(f"Could not delete temp file {item}: {str(e)}")
            
            # Log stats
            logger.info(f"Cleaned up {total_files} temporary files ({total_size / (1024 * 1024):.2f} MB) from {temp_dir}")
        
        return f"Cleaned up {total_files} temporary files"
        
    except Exception as e:
        logger.error(f"Error cleaning temporary files: {str(e)}")
        raise

@shared_task(name="app.background.tasks.maintenance.rotate_logs")
def rotate_logs():
    """Rotate log files"""
    logger.info("Starting log rotation task")
    
    try:
        log_dir = Path("logs")
        if not log_dir.exists():
            logger.info("No logs directory found, skipping rotation")
            return "No logs directory found"
        
        # Get current timestamp for archived logs
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_dir = log_dir / "archive" / timestamp
        archive_dir.mkdir(parents=True, exist_ok=True)
        
        # Files to rotate
        log_files = [
            "app.log",
            "error.log",
            "access.log"
        ]
        
        # Rotate each log file
        rotated_count = 0
        for log_file in log_files:
            log_path = log_dir / log_file
            if log_path.exists() and log_path.stat().st_size > 10 * 1024 * 1024:  # 10 MB
                # Copy to archive
                archive_path = archive_dir / log_file
                shutil.copy2(log_path, archive_path)
                
                # Truncate original file
                with open(log_path, 'w') as f:
                    f.write(f"Log rotated at {datetime.now().isoformat()}\n")
                
                rotated_count += 1
                logger.info(f"Rotated {log_file} to {archive_path}")
        
        # Clean up old archives (keep last 10)
        archives = sorted([d for d in (log_dir / "archive").glob('*') if d.is_dir()])
        if len(archives) > 10:
            for old_archive in archives[:-10]:
                shutil.rmtree(old_archive)
                logger.info(f"Removed old log archive: {old_archive}")
        
        return f"Rotated {rotated_count} log files"
        
    except Exception as e:
        logger.error(f"Error rotating logs: {str(e)}")
        raise

@shared_task(name="app.background.tasks.maintenance.check_system_health")
def check_system_health():
    """Check overall system health and report issues"""
    logger.info("Starting system health check")
    
    try:
        health_issues = []
        health_status = "healthy"
        
        # 1. Check database connectivity
        db = get_db_session()
        try:
            # Simple query to test connection
            result = db.execute(text("SELECT 1")).scalar()
            if result != 1:
                health_issues.append("Database connectivity check failed")
                health_status = "degraded"
        except Exception as e:
            health_issues.append(f"Database connectivity error: {str(e)}")
            health_status = "critical"
        finally:
            db.close()
        
        # 2. Check disk space
        try:
            storage_path = Path(settings.LOCAL_STORAGE_PATH)
            if storage_path.exists():
                total, used, free = shutil.disk_usage(storage_path)
                percent_used = used / total * 100
                
                if percent_used > 90:
                    health_issues.append(f"Storage disk usage critical: {percent_used:.1f}% used")
                    health_status = "critical"
                elif percent_used > 80:
                    health_issues.append(f"Storage disk usage high: {percent_used:.1f}% used")
                    if health_status != "critical":
                        health_status = "degraded"
        except Exception as e:
            health_issues.append(f"Storage check error: {str(e)}")
            if health_status != "critical":
                health_status = "degraded"
        
        # 3. Check Redis connectivity if configured
        if settings.REDIS_URL:
            try:
                # This is synchronous, create a quick event loop to run async code
                async def check_redis():
                    import redis.asyncio as redis
                    redis_client = redis.from_url(settings.REDIS_URL)
                    await redis_client.ping()
                    await redis_client.close()
                
                asyncio.run(check_redis())
            except Exception as e:
                health_issues.append(f"Redis connectivity error: {str(e)}")
                if health_status != "critical":
                    health_status = "degraded"
        
        # 4. Log health check results
        db = get_db_session()
        SystemLog.log_event(
            db=db,
            event_type="system_health_check",
            details={
                "timestamp": datetime.utcnow().isoformat(),
                "status": health_status,
                "issues": health_issues
            },
            severity="info" if health_status == "healthy" else health_status
        )
        db.commit()
        db.close()
        
        # Report any issues to monitoring system (if configured)
        if health_status != "healthy" and hasattr(settings, 'MONITORING_WEBHOOK_URL') and settings.MONITORING_WEBHOOK_URL:
            # This would send an alert to your monitoring system
            # Implementation depends on your monitoring solution
            pass
        
        logger.info(f"System health check completed. Status: {health_status}")
        if health_issues:
            logger.warning(f"Health issues detected: {', '.join(health_issues)}")
        
        return {
            "status": health_status,
            "issues": health_issues,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error checking system health: {str(e)}")
        if 'db' in locals() and 'db' is not None:
            db.rollback()
            db.close()
        raise