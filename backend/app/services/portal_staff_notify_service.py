"""In-app, push, and email alerts to staff for client portal events."""

from __future__ import annotations

import logging
import os
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.frontend_site_urls import build_frontend_url
from app.models.user import User as DBUser
from app.models.work_order import WorkOrder
from app.services.notification_delivery import deliver_resend_email, deliver_sync_in_threadpool
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

DEFAULT_PORTAL_OPS_EMAIL = "chester@atomicrepair419.com"


def portal_ops_email() -> str:
    return (os.getenv("PORTAL_OPS_EMAIL") or DEFAULT_PORTAL_OPS_EMAIL).strip()


async def _notify_admins_in_app(
    db: Session,
    *,
    title: str,
    message: str,
    reference_id: UUID,
    related_type: str,
) -> None:
    admins = db.query(DBUser).filter(DBUser.is_active.is_(True)).all()
    for user in admins:
        if not user.is_admin:
            continue
        try:
            await NotificationService.create_notification(
                db,
                {
                    "user_id": user.id,
                    "title": title,
                    "message": message,
                    "type": "in_app",
                    "reference_id": reference_id,
                    "related_type": related_type,
                },
            )
        except Exception:
            logger.exception("Staff in-app notification failed user_id=%s", user.id)


async def _email_ops(subject: str, body_html: str) -> None:
    to = portal_ops_email()
    if not to:
        return
    try:
        await deliver_resend_email(to, subject, body_html)
    except Exception:
        logger.exception("Portal ops email failed to=%s subject=%s", to, subject)


def _push_for_work_order(
    db: Session,
    *,
    rule_key: str,
    title: str,
    body: str,
    work_order: WorkOrder,
    tag: str,
) -> int:
    from app.services.web_push_service import notify_admins_push

    url = build_frontend_url(f"/techboard/work-orders/{work_order.id}")
    return notify_admins_push(
        db,
        title=title,
        body=body,
        url=url,
        tag=tag,
        rule_key=rule_key,
    )


async def notify_staff_estimate_decision(
    db: Session,
    *,
    work_order: WorkOrder,
    decision: str,
    signer_name: Optional[str] = None,
    decline_reason: Optional[str] = None,
) -> None:
    order = work_order.order_number or str(work_order.id)[:8]
    if decision == "approved":
        message = f"Estimate approved for WO #{order}: order parts"
        if signer_name:
            message = f"Estimate approved for WO #{order} by {signer_name}: order parts"
        email_subject = f"Estimate approved — WO #{order}"
    else:
        reason = (decline_reason or "").strip()
        message = f"Estimate declined for WO #{order}"
        if signer_name:
            message += f" by {signer_name}"
        if reason:
            message += f" — {reason}"
        email_subject = f"Estimate declined — WO #{order}"

    await _notify_admins_in_app(
        db,
        title="Estimate decision",
        message=message,
        reference_id=work_order.id,
        related_type="work_order",
    )

    wo_url = build_frontend_url(f"/techboard/work-orders/{work_order.id}")
    body_html = f"<p>{message}</p><p><a href=\"{wo_url}\">Open work order in TechDeck</a></p>"
    await _email_ops(email_subject, body_html)

    try:
        await deliver_sync_in_threadpool(
            _push_for_work_order,
            db,
            rule_key="portal_estimate_decision",
            title="Estimate decision",
            body=message,
            work_order=work_order,
            tag=f"estimate-{work_order.id}",
        )
    except Exception:
        logger.exception("Push notify failed for estimate decision WO %s", order)


async def notify_staff_customer_media_upload(
    db: Session,
    *,
    work_order: WorkOrder,
    file_count: int,
) -> None:
    from app.services.feature_flags_service import feature_enabled

    if not feature_enabled(db, "customer_media_uploads", None):
        return
    order = work_order.order_number or str(work_order.id)[:8]
    noun = "file" if file_count == 1 else "files"
    message = f"Customer uploaded {file_count} {noun} on WO #{order}"
    email_subject = f"Customer media — WO #{order}"

    await _notify_admins_in_app(
        db,
        title="Customer media",
        message=message,
        reference_id=work_order.id,
        related_type="work_order",
    )

    wo_url = build_frontend_url(f"/techboard/work-orders/{work_order.id}")
    body_html = f"<p>{message}</p><p><a href=\"{wo_url}\">Open work order in TechDeck</a></p>"
    await _email_ops(email_subject, body_html)

    try:
        await deliver_sync_in_threadpool(
            _push_for_work_order,
            db,
            rule_key="portal_customer_media",
            title="Customer media",
            body=message,
            work_order=work_order,
            tag=f"customer-media-{work_order.id}",
        )
    except Exception:
        logger.exception("Push notify failed for customer media WO %s", order)
