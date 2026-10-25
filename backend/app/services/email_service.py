from typing import Any, Dict, List, Optional
import base64
import logging
import uuid

import httpx
from pydantic import EmailStr

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def resolve_outbound_from_address(override: Optional[str] = None) -> str:
    if override and "@" in override:
        return override.strip()
    for candidate in (settings.DEFAULT_FROM_EMAIL, settings.CONTACT_EMAIL):
        if candidate and "@" in candidate:
            return candidate.strip()
    return "service@atomicrepair419.com"


class EmailService:
    @staticmethod
    async def send_resend_email(
        to_email: str,
        subject: str,
        html: str,
        *,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
        timeout: float = 10.0,
    ) -> bool:
        """Send HTML email via Resend HTTP API."""
        if not settings.RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not configured; cannot send email to %s", to_email)
            return False
        if not to_email or not subject:
            return False

        from_addr = resolve_outbound_from_address(from_email)
        payload: Dict[str, Any] = {
            "from": f"{settings.MAIL_FROM_NAME} <{from_addr}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        if reply_to:
            payload["reply_to"] = reply_to
        if extra_headers:
            payload["headers"] = dict(extra_headers)
        if attachments:
            resend_attachments = []
            for item in attachments:
                filename = item.get("filename")
                content = item.get("content")
                if not filename or content is None:
                    continue
                if isinstance(content, bytes):
                    encoded = base64.b64encode(content).decode("ascii")
                else:
                    encoded = str(content)
                resend_attachments.append({"filename": filename, "content": encoded})
            if resend_attachments:
                payload["attachments"] = resend_attachments

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=timeout,
                )
            if response.status_code in (200, 201):
                return True
            logger.error(
                "Resend email failed: %s %s",
                response.status_code,
                response.text,
            )
            return False
        except Exception as exc:
            logger.exception("Resend email error to %s: %s", to_email, exc)
            return False

    @staticmethod
    def send_resend_email_sync(
        to_email: str,
        subject: str,
        html: str,
        *,
        from_email: Optional[str] = None,
        timeout: float = 10.0,
    ) -> bool:
        """Sync Resend send for BackgroundTasks / Celery (off the main event loop)."""
        if not settings.RESEND_API_KEY or not to_email:
            return False
        from_addr = resolve_outbound_from_address(from_email)
        payload = {
            "from": f"{settings.MAIL_FROM_NAME} <{from_addr}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        try:
            response = httpx.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=timeout,
            )
            return response.status_code in (200, 201)
        except Exception as exc:
            logger.exception("Resend sync email error to %s: %s", to_email, exc)
            return False

    @staticmethod
    async def send_quote_email(
        quote_id: uuid.UUID,
        recipient_email: EmailStr,
        message: Optional[str] = None,
    ) -> bool:
        subject = f"Quote #{quote_id}"
        body = message or "Please find attached your quote for review."
        return await EmailService.send_resend_email(
            str(recipient_email),
            subject,
            f"<p>{body}</p>",
        )

    @staticmethod
    async def send_quote_status_update_email(
        quote_id: uuid.UUID,
        recipient_email: EmailStr,
        status: str,
        message: Optional[str] = None,
    ) -> bool:
        subject = f"Quote #{quote_id} Status Update"
        body = f"Your quote status has been updated to {status}."
        if message:
            body += f"<br><br>Additional information: {message}"
        return await EmailService.send_resend_email(
            str(recipient_email),
            subject,
            f"<p>{body}</p>",
        )

    @staticmethod
    async def send_invoice_pdf_email(
        to_email: str,
        recipient_name: str,
        order_number: str,
        pdf_bytes: bytes,
        *,
        filename: Optional[str] = None,
    ) -> bool:
        if not to_email:
            return False

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
        return await EmailService.send_resend_email(
            to_email,
            f"Atomic Repair Invoice #{order_number}",
            html,
            attachments=[{"filename": attach_name, "content": pdf_bytes}],
            timeout=30.0,
        )

    @staticmethod
    async def send_work_order_document_pdf_email(
        to_email: str,
        recipient_name: str,
        order_number: str,
        pdf_bytes: bytes,
        *,
        doc_type: str = "invoice",
        filename: Optional[str] = None,
    ) -> bool:
        if not to_email:
            return False

        doc_label = "Invoice" if doc_type == "invoice" else "Estimate"
        doc_lower = doc_label.lower()
        safe_name = recipient_name.strip() or "there"
        attach_name = filename or f"{doc_lower}-{order_number}.pdf"
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;padding:2rem;border-radius:12px;">
          <h2 style="color:#fff;margin:0 0 1rem;">Your Atomic Repair {doc_label}</h2>
          <p style="color:#9ca3af;">Hi {safe_name},</p>
          <p style="color:#9ca3af;">Attached is {doc_lower} <strong style="color:#22d3ee;">#{order_number}</strong> for your recent service.</p>
          <p style="color:#6b7280;font-size:0.875rem;">Questions? Reply to this email or call (419) 794-1689.</p>
          <p style="color:#6b7280;font-size:0.75rem;margin-top:1.5rem;">Thank you for choosing Atomic Repair.</p>
        </div>
        """
        return await EmailService.send_resend_email(
            to_email,
            f"Atomic Repair {doc_label} #{order_number}",
            html,
            attachments=[{"filename": attach_name, "content": pdf_bytes}],
            timeout=30.0,
        )
