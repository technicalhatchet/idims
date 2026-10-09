"""Customer-facing booking / appointment emails (Resend)."""

from __future__ import annotations

import html
import logging
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import resolve_email_logo_url, settings
from app.models.client import Client
from app.models.work_order import WorkOrder, WorkOrderAppointment

logger = logging.getLogger(__name__)


def _is_real_customer_email(email: Optional[str]) -> bool:
    if not email or not str(email).strip():
        return False
    return "@noreply.atomicrepair419.com" not in email.lower()


def _send_resend_html(to_email: str, subject: str, html_body: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured; skipping email to %s", to_email)
        return
    httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": "Atomic Repair <booking@atomicrepair419.com>",
            "to": to_email,
            "subject": subject,
            "html": html_body,
        },
        timeout=30.0,
    )


def _email_shell(inner_rows: str) -> str:
    logo = resolve_email_logo_url()
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f6" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td bgcolor="#0f172a" style="background-color:#0f172a;padding:24px 28px;">
              <img src="{logo}" alt="Atomic Repair" width="220" height="auto" style="display:block;max-width:220px;height:auto;border:0;">
            </td>
          </tr>
          {inner_rows}
          <tr>
            <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">Atomic Repair · Toledo, OH · (419) 740-0146 · atomicrepair419.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_booking_received_email(
    *,
    customer_email: str,
    booking_name: str,
    order_number: str,
    booking_appliance: str,
    booking_time: str,
    estimated_total: Optional[float] = None,
) -> None:
    if not _is_real_customer_email(customer_email):
        return

    first = html.escape((booking_name or "").split()[0] or "there")
    total_block = ""
    if estimated_total is not None:
        total_block = (
            f'<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#374151;">'
            f"Estimated total at visit: <strong style=\"color:#0891b2;\">${estimated_total:.2f}</strong> "
            f"(diagnostic + trip; 50% of diagnostic applied toward repair if you proceed).</p>"
        )

    inner = f"""
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">Thanks, {first}!</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">
                We received your service request <strong style="color:#ea580c;">#{html.escape(order_number)}</strong>
                for your <strong>{html.escape(booking_appliance)}</strong>.
                Preferred timing: <strong>{html.escape(booking_time)}</strong>.
              </p>
              {total_block}
              <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#374151;">
                <strong>What happens next:</strong> Our team will contact you to confirm your appointment date and time.
                Payment is collected when we schedule — not online.
              </p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                When you request Today, we work toward a same-day diagnostic visit when capacity allows. We will call to
                confirm your appointment. Repairs that need special-order parts may require a follow-up visit.
              </p>
            </td>
          </tr>"""

    _send_resend_html(
        customer_email,
        f"We received your service request — {order_number}",
        _email_shell(inner),
    )


def notify_customer_appointment_scheduled(
    db: Session,
    work_order: WorkOrder,
    appointment: WorkOrderAppointment,
) -> None:
    client = (
        db.query(Client).filter(Client.id == work_order.client_id).first()
        if work_order.client_id
        else None
    )
    if not client or not _is_real_customer_email(client.email):
        return

    start = appointment.scheduled_start
    when = "TBD"
    if start:
        when = start.strftime("%A, %B %d, %Y at %I:%M %p").lstrip("0").replace(" 0", " ")

    order_number = work_order.order_number or str(work_order.id)[:8]
    inner = f"""
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">You&apos;re scheduled</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">
                Your appointment for work order <strong style="color:#ea580c;">#{html.escape(order_number)}</strong>
                is confirmed for <strong>{html.escape(when)}</strong>.
              </p>
              <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#374151;">
                Your technician will diagnose the issue and review repair options with you. If parts must be ordered,
                we will schedule a return visit when they arrive.
              </p>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#374151;">
                If you need to reschedule, call us at <a href="tel:4197400146" style="color:#0891b2;">(419) 740-0146</a>.
              </p>
            </td>
          </tr>"""

    try:
        _send_resend_html(
            client.email,
            f"Appointment confirmed — {order_number}",
            _email_shell(inner),
        )
    except Exception as exc:
        logger.warning("Appointment scheduled email failed: %s", exc)
