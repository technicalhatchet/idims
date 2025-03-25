import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session
import aiohttp
from app.config import settings
from app.models.notification import Notification, NotificationTemplate
from app.schemas.notification import NotificationCreate
from app.core.exceptions import BadRequestException
from app.services.cache_service import cache_service
from app.models.user import User
from app.models.quote import Quote
import uuid

logger = logging.getLogger(__name__)

class NotificationService:
    """Enhanced service for handling notifications (email, SMS, push)"""
    
    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        content: str,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send an email using the configured provider"""
        if not to_email or not subject or not content:
            raise BadRequestException("Missing required email parameters")
        
        provider = settings.EMAIL_PROVIDER.lower()
        from_email = from_email or settings.DEFAULT_FROM_EMAIL
        
        try:
            if provider == "sendgrid":
                return await NotificationService._send_sendgrid_email(
                    to_email, subject, content, from_email, reply_to, attachments
                )
            elif provider == "mailgun":
                return await NotificationService._send_mailgun_email(
                    to_email, subject, content, from_email, reply_to, attachments
                )
            elif provider == "ses":
                return await NotificationService._send_ses_email(
                    to_email, subject, content, from_email, reply_to, attachments
                )
            else:
                logger.error(f"Unsupported email provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            # Log email details for debugging but omit sensitive content
            logger.debug(f"Failed email: to={to_email}, subject={subject}, from={from_email}")
            return False
    
    @staticmethod
    async def _send_sendgrid_email(
        to_email: str,
        subject: str,
        content: str,
        from_email: str,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send email using SendGrid with improved error handling"""
        if not settings.SENDGRID_API_KEY:
            logger.error("SendGrid API key not configured")
            return False
        
        headers = {
            "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
        
        email_data = {
            "personalizations": [
                {
                    "to": [{"email": to_email}],
                    "subject": subject
                }
            ],
            "from": {"email": from_email},
            "content": [
                {
                    "type": "text/html",
                    "value": content
                }
            ]
        }
        
        if reply_to:
            email_data["reply_to"] = {"email": reply_to}
        
        if attachments:
            email_data["attachments"] = attachments
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers=headers,
                    json=email_data,
                    timeout=10
                ) as response:
                    if response.status == 202:
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"SendGrid error: {response.status} - {error_text}")
                        return False
            except aiohttp.ClientError as e:
                logger.error(f"SendGrid request failed: {str(e)}")
                return False
    
    @staticmethod
    async def _send_mailgun_email(
        to_email: str,
        subject: str,
        content: str,
        from_email: str,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send email using Mailgun with improved error handling"""
        if not settings.MAILGUN_API_KEY or not settings.MAILGUN_DOMAIN:
            logger.error("Mailgun credentials not configured")
            return False
        
        data = {
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "html": content
        }
        
        if reply_to:
            data["h:Reply-To"] = reply_to
        
        auth = aiohttp.BasicAuth("api", settings.MAILGUN_API_KEY)
        
        async with aiohttp.ClientSession() as session:
            try:
                files = []
                if attachments:
                    for attachment in attachments:
                        files.append(
                            ('attachment', (attachment['filename'], attachment['content'], attachment['type']))
                        )
                
                async with session.post(
                    f"https://api.mailgun.net/v3/{settings.MAILGUN_DOMAIN}/messages",
                    data=data,
                    auth=auth,
                    timeout=10
                ) as response:
                    if response.status == 200:
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Mailgun error: {response.status} - {error_text}")
                        return False
            except aiohttp.ClientError as e:
                logger.error(f"Mailgun request failed: {str(e)}")
                return False
    
    @staticmethod
    async def _send_ses_email(
        to_email: str,
        subject: str,
        content: str,
        from_email: str,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send email using AWS SES"""
        # In a real implementation, you would use boto3
        # This is a placeholder implementation
        logger.info(f"Sending SES email to: {to_email}, subject: {subject}")
        
        try:
            # Simulate successful email sending
            await cache_service.increment("emails_sent_count")
            return True
        except Exception as e:
            logger.error(f"SES email error: {str(e)}")
            return False
    
    @staticmethod
    async def send_sms(
        to_phone: str,
        message: str,
        sender_id: Optional[str] = None
    ) -> bool:
        """Send an SMS using the configured provider"""
        if not to_phone or not message:
            raise BadRequestException("Missing required SMS parameters")
        
        provider = settings.SMS_PROVIDER.lower()
        
        try:
            if provider == "twilio":
                return await NotificationService._send_twilio_sms(to_phone, message)
            elif provider == "nexmo":
                return await NotificationService._send_nexmo_sms(to_phone, message, sender_id)
            else:
                logger.error(f"Unsupported SMS provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"Error sending SMS: {str(e)}")
            return False
    
    @staticmethod
    async def _send_twilio_sms(to_phone: str, message: str) -> bool:
        """Send SMS using Twilio with improved error handling"""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.error("Twilio credentials not configured")
            return False
        
        auth = aiohttp.BasicAuth(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        data = {
            "To": to_phone,
            "From": settings.TWILIO_PHONE_NUMBER,
            "Body": message
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                    data=data,
                    auth=auth,
                    timeout=10
                ) as response:
                    if response.status == 201:
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Twilio error: {response.status} - {error_text}")
                        return False
            except aiohttp.ClientError as e:
                logger.error(f"Twilio request failed: {str(e)}")
                return False
    
    @staticmethod
    async def _send_nexmo_sms(
        to_phone: str, 
        message: str, 
        sender_id: Optional[str] = None
    ) -> bool:
        """Send SMS using Nexmo/Vonage"""
        # This is a placeholder implementation
        logger.info(f"Sending Nexmo SMS to: {to_phone}, sender: {sender_id or 'default'}")
        
        try:
            # Simulate successful SMS sending
            await cache_service.increment("sms_sent_count")
            return True
        except Exception as e:
            logger.error(f"Nexmo SMS error: {str(e)}")
            return False
    
    @staticmethod
    async def send_push_notification(
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        badge: Optional[int] = None,
        sound: Optional[str] = None
    ) -> bool:
        """Send a push notification with enhanced options"""
        logger.info(f"Sending push notification to user {user_id}: {title}")
        
        # This would be implemented with Firebase Cloud Messaging or similar
        # Here we just simulate success
        try:
            # Simulate push notification delivery
            await cache_service.increment("push_notifications_sent")
            return True
        except Exception as e:
            logger.error(f"Push notification error: {str(e)}")
            return False
    
    @staticmethod
    async def create_notification(
        db: Session,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: str,
        reference_id: Optional[uuid.UUID] = None,
        priority: str = "normal"
    ) -> Notification:
        """
        Create a new notification.
        """
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            reference_id=reference_id,
            priority=priority,
            is_read=False
        )
        
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        return notification

    @staticmethod
    async def create_quote_notification(
        db: Session,
        quote_id: uuid.UUID,
        action: str,
        message: str,
        created_by: uuid.UUID
    ) -> List[Notification]:
        """
        Create notifications for quote-related actions.
        """
        notifications = []
        
        # Get relevant users (client, manager, admin)
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        if not quote:
            return notifications
        
        # Notify client
        client = db.query(User).filter(User.id == quote.client_id).first()
        if client:
            notification = await NotificationService.create_notification(
                db=db,
                user_id=client.id,
                title=f"Quote #{quote_id} Update",
                message=message,
                notification_type="quote",
                reference_id=quote_id,
                priority="normal"
            )
            notifications.append(notification)
        
        # Notify managers and admins
        managers = db.query(User).filter(
            User.role.in_(["manager", "admin"])
        ).all()
        
        for manager in managers:
            notification = await NotificationService.create_notification(
                db=db,
                user_id=manager.id,
                title=f"Quote #{quote_id} Update",
                message=message,
                notification_type="quote",
                reference_id=quote_id,
                priority="normal"
            )
            notifications.append(notification)
        
        return notifications

    @staticmethod
    async def mark_notification_read(
        db: Session,
        notification_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Notification:
        """
        Mark a notification as read.
        """
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if not notification:
            raise NotFoundException(f"Notification with ID {notification_id} not found")
        
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        
        db.commit()
        db.refresh(notification)
        
        return notification

    @staticmethod
    async def get_user_notifications(
        db: Session,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False
    ) -> List[Notification]:
        """
        Get notifications for a user.
        """
        query = db.query(Notification).filter(Notification.user_id == user_id)
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        notifications = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
        
        return notifications