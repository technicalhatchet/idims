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

    @staticmethod
    async def send_invoice_pdf_email(
        to_email: str,
        recipient_name: str,
        order_number: str,
        pdf_bytes: bytes,
        *,
        filename: Optional[str] = None,
    ) -> bool:
        """
        Email a work-order invoice PDF via Resend (same provider as portal invites).
        """
        import base64

        import httpx

        from app.config import settings

        if not settings.RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not configured; cannot send invoice email")
            return False

        if not to_email:
            return False

        from_addr = settings.CONTACT_EMAIL or "service@atomicrepair419.com"
        safe_name = recipient_name.strip() or "there"
        attach_name = filename or f"invoice-{order_number}.pdf"
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;padding:2rem;border-radius:12px;">
          <h2 style="color:#fff;margin:0 0 1rem;">Your Atomic Repair Invoice</h2>
          <p style="color:#9ca3af;">Hi {safe_name},</p>
          <p style="color:#9ca3af;">Attached is invoice <strong style="color:#22d3ee;">#{order_number}</strong> for your recent service.</p>
          <p style="color:#6b7280;font-size:0.875rem;">Questions? Reply to this email or call (419) 794-1689.</p>
          <p style="color:#6b7280;font-size:0.75rem;margin-top:1.5rem;">Thank you for choosing Atomic Repair.</p>
        </div>
        """

        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"Atomic Repair <{from_addr}>",
                    "to": [to_email],
                    "subject": f"Atomic Repair Invoice #{order_number}",
                    "html": html,
                    "attachments": [
                        {
                            "filename": attach_name,
                            "content": base64.b64encode(pdf_bytes).decode("ascii"),
                        }
                    ],
                },
                timeout=30.0,
            )
            if response.status_code in (200, 201):
                return True
            logger.error("Resend invoice email failed: %s %s", response.status_code, response.text)
            return False
        except Exception as e:
            logger.exception("Error sending invoice email: %s", e)
            return False