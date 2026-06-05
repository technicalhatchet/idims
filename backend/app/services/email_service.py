from typing import Optional
import uuid
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    _conf: Optional[ConnectionConfig] = None

    @classmethod
    def _resolve_from_address(cls) -> Optional[str]:
        for candidate in (settings.MAIL_FROM, settings.DEFAULT_FROM_EMAIL):
            if candidate and "@" in candidate:
                return candidate
        return None

    @classmethod
    def _get_conf(cls) -> Optional[ConnectionConfig]:
        if cls._conf is not None:
            return cls._conf
        mail_from = cls._resolve_from_address()
        if not mail_from or not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
            return None
        cls._conf = ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=mail_from,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
        )
        return cls._conf

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
            
            conf = EmailService._get_conf()
            if not conf:
                logger.warning("Email not configured; skipping quote email")
                return False

            fm = FastMail(conf)
            await fm.send_message(message)
            return True
            
        except Exception as e:
            logger.exception("Error sending quote email: %s", e)
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
            
            conf = EmailService._get_conf()
            if not conf:
                logger.warning("Email not configured; skipping quote status email")
                return False

            fm = FastMail(conf)
            await fm.send_message(message)
            return True
            
        except Exception as e:
            logger.exception("Error sending quote status update email: %s", e)
            return False 