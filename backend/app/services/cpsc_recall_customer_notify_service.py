"""Customer notice after staff confirms a recall match."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.cpsc_recall import ClientApplianceRecallMatch
from app.services.customer_outreach_service import automatic_outreach_allowed, log_skipped_test_mode
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)


async def notify_customer_confirmed_recall(db: Session, match_id: UUID) -> bool:
    match = (
        db.query(ClientApplianceRecallMatch)
        .options(
            joinedload(ClientApplianceRecallMatch.appliance).joinedload("client"),
            joinedload(ClientApplianceRecallMatch.recall),
        )
        .filter(ClientApplianceRecallMatch.id == match_id)
        .first()
    )
    if not match or match.status != "confirmed" or match.customer_notified_at:
        return False
    appt = match.appliance
    recall = match.recall
    if not appt or not recall or not appt.client_id:
        return False

    if not automatic_outreach_allowed(db, appt.client_id):
        log_skipped_test_mode(
            channel="recall_alert",
            client_id=appt.client_id,
            detail=f"match_id={match_id}",
        )
        return False

    label = appt.nickname or appt.make or "your appliance"
    title = "Important safety recall notice"
    message = (
        f"A government safety recall may apply to {label} "
        f"(model {appt.model or 'on file'}): {recall.title}. "
        "Open your appliance details in the portal for hazard, remedy, and the official CPSC link."
    )

    from app.services.client_portal_notification_service import notify_client_portal_users

    await notify_client_portal_users(
        db,
        appt.client_id,
        title=title,
        message=message,
        notification_type="in_app",
        reference_id=appt.id,
        related_type="client_appliance",
        meta_data={"cpsc_recall_id": recall.cpsc_recall_id, "recall_url": recall.url},
        automatic_outreach=True,
    )

    client = appt.client
    if client and (client.email or "").strip():
        subject = f"Safety recall notice — {label}"
        body = f"""
        <p>Hi {client.first_name or 'there'},</p>
        <p>{message}</p>
        <p><strong>Hazard:</strong> {recall.hazard or 'See CPSC listing.'}</p>
        <p><strong>Remedy:</strong> {recall.remedy or 'See CPSC listing.'}</p>
        <p><a href="{recall.url or 'https://www.saferproducts.gov/'}">View official CPSC recall</a></p>
        """
        try:
            from app.services.notification_delivery import deliver_resend_email as _email

            await _email(client.email, subject, body)
        except Exception:
            logger.exception("Recall customer email failed match_id=%s", match_id)

    match.customer_notified_at = utcnow_naive()
    db.add(match)
    db.commit()
    return True
