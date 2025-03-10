import logging
from datetime import datetime, timedelta
from celery import shared_task
from sqlalchemy import and_
import uuid

from app.db.database import get_db_session
from app.models.work_order import WorkOrder
from app.models.technician import Technician
from app.models.client import Client
from app.models.user import User
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationCreate

logger = logging.getLogger(__name__)

@shared_task(name="app.background.tasks.reminders.send_appointment_reminders")
def send_appointment_reminders():
    """Send appointment reminders for upcoming work orders"""
    logger.info("Starting appointment reminders task")
    
    try:
        # Get database session
        db = get_db_session()
        
        # Current time
        now = datetime.utcnow()
        
        # Send reminders for appointments in the next 24 hours
        start_threshold = now + timedelta(hours=23)
        end_threshold = now + timedelta(hours=25)
        
        # Find work orders with scheduled times in the reminder window
        work_orders = db.query(WorkOrder).filter(
            and_(
                WorkOrder.scheduled_start >= start_threshold,
                WorkOrder.scheduled_start <= end_threshold,
                WorkOrder.status.in_(["scheduled", "pending"])
            )
        ).all()
        
        logger.info(f"Found {len(work_orders)} upcoming appointments for reminders")
        
        for work_order in work_orders:
            # Send reminder to client
            if work_order.client_id:
                client = db.query(Client).filter(Client.id == work_order.client_id).first()
                if client and client.user_id:
                    logger.debug(f"Sending client reminder for work order {work_order.order_number}")
                    
                    # Create notification
                    notification_data = NotificationCreate(
                        user_id=client.user_id,
                        title="Appointment Reminder",
                        content=f"Your appointment #{work_order.order_number} is scheduled for {work_order.scheduled_start.strftime('%B %d at %I:%M %p')}.",
                        type="in_app",
                        related_id=work_order.id,
                        related_type="work_order"
                    )
                    
                    await NotificationService.create_notification(db, notification_data)
                    
                    # If client has mobile number, send SMS
                    if client.mobile:
                        sms_message = f"Reminder: Your service is scheduled for tomorrow at {work_order.scheduled_start.strftime('%I:%M %p')}. Work Order: {work_order.order_number}."
                        await NotificationService.send_sms(client.mobile, sms_message)
            
            # Send reminder to technician
            if work_order.assigned_technician_id:
                technician = db.query(Technician).filter(Technician.id == work_order.assigned_technician_id).first()
                if technician and technician.user_id:
                    logger.debug(f"Sending technician reminder for work order {work_order.order_number}")
                    
                    # Create notification
                    notification_data = NotificationCreate(
                        user_id=technician.user_id,
                        title="Upcoming Job Reminder",
                        content=f"You have an upcoming job #{work_order.order_number} scheduled for {work_order.scheduled_start.strftime('%B %d at %I:%M %p')}.",
                        type="in_app",
                        related_id=work_order.id,
                        related_type="work_order"
                    )
                    
                    await NotificationService.create_notification(db, notification_data)
                    
                    # If technician has mobile number via user, send SMS
                    user = db.query(User).filter(User.id == technician.user_id).first()
                    if user and user.phone:
                        sms_message = f"Reminder: You have a job scheduled for tomorrow at {work_order.scheduled_start.strftime('%I:%M %p')}. Work Order: {work_order.order_number}."
                        await NotificationService.send_sms(user.phone, sms_message)
        
        # Close the session
        db.close()
        
        logger.info("Completed appointment reminders task")
        return f"Sent reminders for {len(work_orders)} appointments"
        
    except Exception as e:
        logger.error(f"Error sending appointment reminders: {str(e)}")
        if 'db' in locals():
            db.close()
        raise

@shared_task(name="app.background.tasks.reminders.schedule_appointment_reminder")
def schedule_appointment_reminder(work_order_id, user_id, scheduled_time, hours_before=24):
    """Schedule a reminder for a specific appointment"""
    logger.info(f"Scheduling reminder for work order {work_order_id}, {hours_before} hours before appointment")
    
    try:
        # Convert IDs and time
        work_order_id = uuid.UUID(work_order_id) if isinstance(work_order_id, str) else work_order_id
        user_id = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        
        if isinstance(scheduled_time, str):
            scheduled_time = datetime.fromisoformat(scheduled_time)
        
        # Calculate when to send the reminder
        reminder_time = scheduled_time - timedelta(hours=hours_before)
        
        # If the reminder time is in the past, don't schedule it
        if reminder_time <= datetime.utcnow():
            logger.info(f"Reminder time {reminder_time} is in the past, not scheduling")
            return "Reminder time in the past"
        
        # Get database session
        db = get_db_session()
        
        # Get work order
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if not work_order:
            logger.error(f"Work order {work_order_id} not found")
            db.close()
            return f"Work order {work_order_id} not found"
        
        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User {user_id} not found")
            db.close()
            return f"User {user_id} not found"
        
        # Create a scheduled task for the reminder
        from celery.result import AsyncResult
        
        # Schedule the task to run at the reminder time
        task = send_specific_reminder.apply_async(
            args=[str(work_order_id), str(user_id), hours_before],
            eta=reminder_time
        )
        
        logger.info(f"Scheduled reminder task {task.id} for {reminder_time}")
        
        # Close the session
        db.close()
        
        return f"Scheduled reminder for {scheduled_time}, {hours_before} hours in advance"
        
    except Exception as e:
        logger.error(f"Error scheduling appointment reminder: {str(e)}")
        if 'db' in locals():
            db.close()
        raise

@shared_task(name="app.background.tasks.reminders.send_specific_reminder")
def send_specific_reminder(work_order_id, user_id, hours_before=24):
    """Send a reminder for a specific appointment"""
    logger.info(f"Sending specific reminder for work order {work_order_id}")
    
    try:
        # Convert IDs
        work_order_id = uuid.UUID(work_order_id) if isinstance(work_order_id, str) else work_order_id
        user_id = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        
        # Get database session
        db = get_db_session()
        
        # Get work order
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if not work_order:
            logger.error(f"Work order {work_order_id} not found")
            db.close()
            return f"Work order {work_order_id} not found"
        
        # Get user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User {user_id} not found")
            db.close()
            return f"User {user_id} not found"
        
        # Create appropriate message based on hours before
        if hours_before == 24:
            title = "Appointment Tomorrow"
            content = f"Your appointment #{work_order.order_number} is scheduled for tomorrow at {work_order.scheduled_start.strftime('%I:%M %p')}."
        elif hours_before == 1:
            title = "Appointment Soon"
            content = f"Your appointment #{work_order.order_number} is scheduled in about 1 hour at {work_order.scheduled_start.strftime('%I:%M %p')}."
        else:
            title = "Appointment Reminder"
            content = f"Your appointment #{work_order.order_number} is scheduled for {work_order.scheduled_start.strftime('%B %d at %I:%M %p')}."
        
        # Create notification
        notification_data = NotificationCreate(
            user_id=user_id,
            title=title,
            content=content,
            type="in_app",
            related_id=work_order.id,
            related_type="work_order"
        )
        
        await NotificationService.create_notification(db, notification_data, send_immediately=True)
        
        # Close the session
        db.close()
        
        logger.info(f"Sent reminder for work order {work_order_id}")
        return f"Sent reminder for work order {work_order_id}"
        
    except Exception as e:
        logger.error(f"Error sending specific reminder: {str(e)}")
        if 'db' in locals():
            db.close()
        raise