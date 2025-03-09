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
        notification: NotificationCreate,
        send_immediately: bool = True
    ) -> Notification:
        """Create a notification and optionally send it immediately"""
        if not notification.user_id:
            raise BadRequestException("User ID is required for notification")
        
        # Create notification record
        db_notification = Notification(
            user_id=notification.user_id,
            template_id=notification.template_id,
            title=notification.title,
            content=notification.content,
            type=notification.type,
            status="pending",
            related_id=notification.related_id,
            related_type=notification.related_type,
        )
        
        db.add(db_notification)
        db.commit()
        db.refresh(db_notification)
        
        # Send notification if requested
        if send_immediately:
            success = await NotificationService.send_notification(db_notification)
            
            if success:
                db_notification.status = "sent"
                db_notification.sent_at = datetime.utcnow()
                db.commit()
        
        return db_notification
    
    @staticmethod
    async def send_notification(notification: Notification) -> bool:
        """Send a notification based on its type with enhanced error handling"""
        if not notification or not notification.user_id:
            return False
        
        try:
            # Get user information (in a real implementation, you'd fetch from DB)
            user_email = "user@example.com"  # Replace with actual user email
            user_phone = "+12345678901"      # Replace with actual user phone
            
            if notification.type == "email":
                return await NotificationService.send_email(
                    user_email,
                    notification.title,
                    notification.content
                )
            elif notification.type == "sms":
                return await NotificationService.send_sms(
                    user_phone,
                    notification.content
                )
            elif notification.type == "push":
                return await NotificationService.send_push_notification(
                    notification.user_id,
                    notification.title,
                    notification.content
                )
            elif notification.type == "in_app":
                # In-app notifications don't need to be sent externally
                return True
            else:
                logger.error(f"Unsupported notification type: {notification.type}")
                return False
        except Exception as e:
            logger.error(f"Error sending notification: {str(e)}")
            return False