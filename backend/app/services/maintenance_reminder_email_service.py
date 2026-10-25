"""Daily maintenance summary emails (one per client per calendar month max)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.frontend_site_urls import build_frontend_url
from app.models.client import Client
from app.services.customer_outreach_service import automatic_outreach_allowed, log_skipped_test_mode
from app.services.email_service import EmailService
from app.services.maintenance_service import DUE_SOON_DAYS, household_due_summary
from app.services.maintenance_unsubscribe_token import create_maintenance_unsubscribe_token

logger = logging.getLogger(__name__)


def _one_click_unsubscribe_url(token: str) -> str:
    base = (settings.BACKEND_URL or "").rstrip("/")
    if not base:
        base = build_frontend_url("").rstrip("/")
    return f"{base}/api/public/maintenance-email/unsubscribe?token={token}"


def _confirm_unsubscribe_page_url(token: str) -> str:
    from urllib.parse import quote

    return build_frontend_url(f"/maintenance/unsubscribe?token={quote(token, safe='')}")


def _build_list_unsubscribe_headers(token: str) -> dict:
    one_click = _one_click_unsubscribe_url(token)
    return {
        "List-Unsubscribe": f"<{one_click}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


def _summary_html(client: Client, summary: dict, token: str) -> str:
    name = client.first_name or "there"
    lines = []
    for item in summary.get("items") or []:
        lines.append(
            f"<li><strong>{item.get('appliance_label') or 'Appliance'}</strong>: "
            f"{item.get('task_name')} (due {item.get('next_due_at')})</li>"
        )
    items_html = "\n".join(lines) if lines else ""
    portal = build_frontend_url("/cxdashboard/appliances")
    unsub = _confirm_unsubscribe_page_url(token)
    return f"""
    <p>Hi {name},</p>
    <p>You have <strong>{summary.get('count', 0)}</strong> maintenance item(s) due in the next {DUE_SOON_DAYS} days:</p>
    <ul>{items_html}</ul>
    <p><a href="{portal}">View your appliances</a> in the customer portal.</p>
    <p style="font-size:12px;color:#666;">
      <a href="{unsub}">Unsubscribe</a> from maintenance reminder emails.
    </p>
    """


async def send_maintenance_summary_for_client(db: Session, client_id: UUID) -> bool:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client or client.maintenance_emails_opt_out:
        return False
    if not (client.email or "").strip():
        return False
    if not automatic_outreach_allowed(db, client.id):
        log_skipped_test_mode(
            channel="maintenance_reminder_email",
            client_id=client.id,
        )
        return False

    from app.services.maintenance_service import client_email_allowed_this_month

    if not client_email_allowed_this_month(client):
        return False

    summary = household_due_summary(db, client.id)
    if summary.get("count", 0) < 1:
        return False

    token = create_maintenance_unsubscribe_token(client.id)
    subject = f"Maintenance reminders ({summary['count']} due soon)"
    html = _summary_html(client, summary, token)
    headers = _build_list_unsubscribe_headers(token)

    from app.services.notification_service import NotificationService

    ok = await NotificationService.send_email(
        client.email,
        subject,
        html,
        extra_headers=headers,
    )
    if ok:
        client.last_maintenance_email_at = datetime.utcnow()
        db.flush()
    return ok


def send_maintenance_summaries_sync(db: Session) -> int:
    """Process all eligible clients; returns count of emails sent."""
    from app.services.worker_feature_flags_service import worker_feature_enabled

    if not worker_feature_enabled(db, "maintenance_reminder_emails"):
        return 0

    from app.services.feature_flags_service import feature_enabled_for_system

    if not feature_enabled_for_system(db, "maintenance_reminders"):
        return 0

    clients = (
        db.query(Client)
        .filter(Client.status == "active", Client.maintenance_emails_opt_out.is_(False))
        .all()
    )
    sent = 0
    import asyncio

    for client in clients:
        try:
            if asyncio.run(send_maintenance_summary_for_client(db, client.id)):
                sent += 1
                db.commit()
            else:
                db.rollback()
        except Exception as exc:
            logger.exception("Maintenance email failed client=%s: %s", client.id, exc)
            db.rollback()
    return sent
