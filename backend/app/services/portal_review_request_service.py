"""Send Google review requests after work orders are fully paid (Wave 1B)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.client import Client
from app.models.work_order import WorkOrder
from app.services.portal_reviews_settings_service import get_portal_reviews_settings
from app.services.work_order_billing_helpers import compute_balance_due
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

SKIP_STATUSES = frozenset({"refunded", "recall", "redo"})
REVIEW_COOLDOWN_DAYS = 180
PAID_STATUSES = frozenset({"completed", "closed"})


def _status_str(wo: WorkOrder) -> str:
    st = wo.status
    return st.value if hasattr(st, "value") else str(st)


def review_request_eligibility(
    db: Session,
    work_order: WorkOrder,
    *,
    force: bool = False,
) -> Optional[str]:
    """Return skip reason or None if eligible."""
    cfg = get_portal_reviews_settings(db)
    if not cfg.get("enabled") and not force:
        return "disabled"
    url = (cfg.get("google_review_url") or "").strip()
    if not url and not force:
        return "no_url"

    if work_order.review_requested_at and not force:
        return "already_sent"

    status = _status_str(work_order)
    if status in SKIP_STATUSES or work_order.is_redo:
        return "redo_recall_refund"
    if status not in PAID_STATUSES and not work_order.is_closed:
        return "not_completed"
    balance = float(compute_balance_due(work_order))
    if balance > 0.01:
        return "balance_due"

    client = work_order.client or db.query(Client).filter(Client.id == work_order.client_id).first()
    if not client or not (client.email or "").strip():
        return "no_email"

    if not force:
        cutoff = utcnow_naive() - timedelta(days=REVIEW_COOLDOWN_DAYS)
        recent = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.client_id == work_order.client_id,
                WorkOrder.review_requested_at.isnot(None),
                WorkOrder.review_requested_at >= cutoff,
                WorkOrder.id != work_order.id,
            )
            .first()
        )
        if recent:
            return "cooldown"

    return None


async def send_portal_review_request(
    db: Session,
    work_order_id: UUID,
    *,
    force: bool = False,
) -> Dict[str, Any]:
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        return {"sent": False, "reason": "not_found"}

    skip = review_request_eligibility(db, wo, force=force)
    if skip:
        return {"sent": False, "reason": skip}

    cfg = get_portal_reviews_settings(db)
    review_url = (cfg.get("google_review_url") or "").strip()
    client = wo.client or db.query(Client).filter(Client.id == wo.client_id).first()
    order = wo.order_number or str(wo.id)[:8]
    name = (client.first_name or client.display_name or "there").strip()

    email_ok = await _send_review_email(
        to_email=client.email,
        recipient_name=name,
        order_number=order,
        review_url=review_url,
    )

    try:
        from app.services.client_portal_notification_service import notify_client_portal_users

        await notify_client_portal_users(
            db,
            client_id=wo.client_id,
            title="How did we do?",
            message=f"Thanks for choosing Atomic Repair on order #{order}. We'd love your feedback.",
            reference_id=wo.id,
            related_type="work_order",
            meta_data={"action_url": review_url},
        )
    except Exception:
        logger.exception("Portal in-app review notification failed for WO %s", order)

    wo.review_requested_at = utcnow_naive()
    db.add(wo)
    db.commit()

    return {"sent": True, "email": email_ok}


async def _send_review_email(
    *,
    to_email: str,
    recipient_name: str,
    order_number: str,
    review_url: str,
) -> bool:
    if not settings.RESEND_API_KEY or not to_email:
        return False

    from_addr = settings.CONTACT_EMAIL or "service@atomicrepair419.com"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;padding:2rem;border-radius:12px;">
      <h2 style="color:#fff;margin:0 0 1rem;">How did we do?</h2>
      <p style="color:#9ca3af;">Hi {recipient_name},</p>
      <p style="color:#9ca3af;">Thank you for trusting Atomic Repair with order <strong style="color:#22d3ee;">#{order_number}</strong>.</p>
      <p style="margin:1.5rem 0;">
        <a href="{review_url}" style="display:inline-block;background:#22d3ee;color:#0A0F1E;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none;">Leave a Google review</a>
      </p>
      <p style="color:#6b7280;font-size:0.875rem;">We appreciate your feedback.</p>
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
                "subject": f"How was your service? (Order #{order_number})",
                "html": html,
            },
            timeout=30.0,
        )
        return response.status_code in (200, 201)
    except Exception:
        logger.exception("Review request email failed for order %s", order_number)
        return False


def work_order_paid_and_ready(db: Session, work_order: WorkOrder) -> bool:
    status = _status_str(work_order)
    if status in SKIP_STATUSES or work_order.is_redo:
        return False
    if status not in PAID_STATUSES and not work_order.is_closed:
        return False
    balance = float(compute_balance_due(work_order))
    if balance > 0.01:
        return False
    return True
