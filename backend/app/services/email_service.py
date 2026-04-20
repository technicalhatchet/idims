from typing import Optional, Dict, Any
import uuid
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
import logging
from app.config import settings
from app.models.quote import Quote
from app.models.client import Client
from app.models.user import User

logger = logging.getLogger(__name__)

class EmailService:
    conf = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True
    )

    @staticmethod
    async def send_quote_email(
        quote_id: uuid.UUID,
        recipient_email: EmailStr,
        message: Optional[str] = None
    ) -> bool:
        """
        Send a quote email to a client.
        """
        try:
            # TODO: Fetch quote details from database
            # For now, using placeholder data
            subject = f"Quote #{quote_id}"
            body = message or "Please find attached your quote for review."
            
            message = MessageSchema(
                subject=subject,
                recipients=[recipient_email],
                body=body,
                subtype="html"
            )
            
            fm = FastMail(EmailService.conf)
            await fm.send_message(message)
            return True
            
        except Exception as e:
            # TODO: Add proper logging
            print(f"Error sending quote email: {str(e)}")
            return False

    @staticmethod
    async def send_quote_status_update_email(
        quote_id: uuid.UUID,
        recipient_email: EmailStr,
        status: str,
        message: Optional[str] = None
    ) -> bool:
        """
        Send an email notification about quote status updates.
        """
        try:
            subject = f"Quote #{quote_id} Status Update"
            body = f"Your quote status has been updated to {status}."
            if message:
                body += f"\n\nAdditional information: {message}"
            
            message = MessageSchema(
                subject=subject,
                recipients=[recipient_email],
                body=body,
                subtype="html"
            )
            
            fm = FastMail(EmailService.conf)
            await fm.send_message(message)
            return True
            
        except Exception as e:
            # TODO: Add proper logging
            print(f"Error sending quote status update email: {str(e)}")
            return False 