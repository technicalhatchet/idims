import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session
import aiohttp
from app.config import settings
from app.models.notification import Notification, NotificationTemplate
from app.schemas.notification import NotificationCreate
from app.core.exceptions import BadRequestException, NotFoundException
from app.services.cache_service import cache_service
from app.models.user import User
from app.models.quote import Quote
import uuid
import jinja2
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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
            elif provider == "zoho":
                return await NotificationService._send_zoho_email(
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
    async def _send_zoho_email(
        to_email: str,
        subject: str,
        content: str,
        from_email: str,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send email using Zoho SMTP server"""
        if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
            logger.error("Zoho Mail credentials not configured")
            return False
        
        try:
            # Create message
            message = MIMEMultipart()
            message["From"] = f"{settings.MAIL_FROM_NAME} <{from_email}>"
            message["To"] = to_email
            message["Subject"] = subject
            
            if reply_to:
                message["Reply-To"] = reply_to
                
            # Attach HTML content
            message.attach(MIMEText(content, "html"))
            
            # Connect to Zoho SMTP server
            with smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.send_message(message)
                
            logger.info(f"Email sent to {to_email} via Zoho SMTP")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email via Zoho SMTP: {str(e)}")
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
        notification_data: Dict[str, Any]
    ) -> Notification:
        """Create a notification in the database"""
        try:
            # Extract data from the notification_data dict
            notification = Notification(
                user_id=notification_data.get("user_id"),
                title=notification_data.get("title"),
                content=notification_data.get("message"),
                type=notification_data.get("type", "in_app"),
                related_id=notification_data.get("reference_id"),
                related_type=notification_data.get("related_type", "system"),
                is_read=notification_data.get("is_read", False),
                meta_data=notification_data.get("meta_data", {}),
                created_at=datetime.utcnow()
            )
            
            db.add(notification)
            db.commit()
            db.refresh(notification)
            
            return notification
        except Exception as e:
            logger.error(f"Error creating notification: {str(e)}")
            db.rollback()
            raise

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
                notification_data={
                    "user_id": client.id,
                    "title": f"Quote #{quote_id} Update",
                    "message": message,
                    "type": "in_app",
                    "related_id": quote_id,
                    "related_type": "quote"
                }
            )
            notifications.append(notification)
        
        # Notify managers and admins
        managers = db.query(User).filter(
            User.role.in_(["manager", "admin"])
        ).all()
        
        for manager in managers:
            notification = await NotificationService.create_notification(
                db=db,
                notification_data={
                    "user_id": manager.id,
                    "title": f"Quote #{quote_id} Update",
                    "message": message,
                    "type": "in_app",
                    "related_id": quote_id,
                    "related_type": "quote"
                }
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
        
        # Use the model's mark_as_read method
        notification.mark_as_read()
        
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

    @staticmethod
    def _load_template(template_name: str) -> str:
        """Load an email template from the template directory"""
        try:
            template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "email")
            template_path = os.path.join(template_dir, f"{template_name}.html")
            
            # If template doesn't exist, use a default template
            if not os.path.exists(template_path):
                logger.warning(f"Template {template_name} not found, using default")
                template_path = os.path.join(template_dir, "default.html")
            
            with open(template_path, "r") as file:
                return file.read()
        except Exception as e:
            logger.error(f"Error loading template {template_name}: {str(e)}")
            # Return a very basic template as fallback
            return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>{{subject}}</title>
            </head>
            <body>
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <h2>{{subject}}</h2>
                    <div>{{message|safe}}</div>
                </div>
            </body>
            </html>
            """

    @staticmethod
    async def send_email_with_template(
        recipients: List[str],
        subject: str,
        template_name: str,
        template_data: Dict[str, Any],
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        db: Optional[Session] = None
    ) -> bool:
        """Send an email using a template"""
        try:
            # First try to get the template from the database
            template_content = None
            if db:
                db_template = db.query(NotificationTemplate).filter(
                    NotificationTemplate.name == template_name,
                    NotificationTemplate.type == "email"
                ).first()
                
                if db_template:
                    template_content = db_template.content
            
            # If not found in the database, load from file
            if not template_content:
                template_content = NotificationService._load_template(template_name)
            
            # Render the template with Jinja2
            template = jinja2.Template(template_content)
            rendered_content = template.render(**template_data, subject=subject)
            
            # Send to all recipients
            success = True
            for recipient in recipients:
                result = await NotificationService.send_email(
                    recipient, subject, rendered_content, from_email, reply_to, attachments
                )
                if not result:
                    success = False
                    logger.error(f"Failed to send email to {recipient}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending templated email: {str(e)}")
            return False
    
    @staticmethod
    async def send_client_registration_email(
        db: Session,
        client_id: uuid.UUID,
        client_email: str,
        data: Dict[str, Any]
    ) -> bool:
        """Send a registration email to a client with an invitation to create an account"""
        
        # Make sure we have the necessary registration data
        if not client_email:
            raise BadRequestException("Missing client email")
        
        # Generate Auth0 registration URL
        auth0_domain = settings.AUTH0_DOMAIN
        auth0_client_id = settings.AUTH0_CLIENT_ID
        redirect_uri = f"{settings.FRONTEND_URL}/auth/callback"
        
        # Creating a registration link that will pre-fill the user's email
        # and redirect them to the app after registration
        registration_link = f"https://{auth0_domain}/authorize?response_type=code&client_id={auth0_client_id}&redirect_uri={redirect_uri}&scope=openid%20profile%20email&screen_hint=signup&pre_fill_email={client_email}"
        
        # Default registration template data
        template_data = {
            "client_name": data.get("name", "Valued Customer"),
            "company_name": data.get("company", ""),
            "registration_link": registration_link,
            "custom_message": data.get("custom_message", ""),
            "sent_by": data.get("sent_by", "The Service Team"),
            "site_name": settings.SITE_NAME,
            "contact_email": settings.CONTACT_EMAIL,
            "logo_url": settings.LOGO_URL,
            "year": datetime.now().year
        }
        
        # Send the email using the template
        return await NotificationService.send_email_with_template(
            recipients=[client_email],
            subject=f"Welcome to {settings.SITE_NAME} - Create Your Account",
            template_name="client_registration",
            template_data=template_data,
            db=db
        )