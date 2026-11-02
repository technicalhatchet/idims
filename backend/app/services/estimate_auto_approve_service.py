"""Estimate auto-approve under client/property limits (Wave 3)."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.property import Property
from app.models.work_order import WorkOrder
from app.services.portal_estimate_approval_service import (
    EstimateApprovalError,
    build_portal_estimate_snapshot,
    record_estimate_approval,
)

logger = logging.getLogger(__name__)


def effective_estimate_auto_approve_limit(
    db: Session,
    *,
    client: Client,
    property_id: Optional[UUID],
) -> Optional[Decimal]:
    if property_id:
        prop = db.query(Property).filter(Property.id == property_id).first()
        if prop and prop.estimate_auto_approve_limit is not None:
            return Decimal(str(prop.estimate_auto_approve_limit))
    if client.estimate_auto_approve_limit is not None:
        return Decimal(str(client.estimate_auto_approve_limit))
    return None


def try_auto_approve_pending_estimate(
    db: Session,
    work_order: WorkOrder,
) -> bool:
    """
    After promotion to pending_estimate_approval, auto-record approval when total <= limit.
    Returns True when an auto approval row was created.
    """
    from app.services.feature_flags_service import feature_enabled

    if not feature_enabled(db, "estimate_auto_approve", None):
        return False

    client = db.query(Client).filter(Client.id == work_order.client_id).first()
    if not client:
        return False

    limit = effective_estimate_auto_approve_limit(
        db,
        client=client,
        property_id=work_order.property_id,
    )
    if limit is None:
        return False

    snapshot = build_portal_estimate_snapshot(db, work_order)
    total = Decimal(str(snapshot["total"]))
    if total > limit:
        return False

    try:
        record_estimate_approval(
            db,
            work_order=work_order,
            client=client,
            login=None,
            decision="approved",
            signer_name=None,
            signature_png_b64=None,
            decline_reason=None,
            ip=None,
            user_agent="estimate_auto_approve",
            decision_source="auto",
        )
    except EstimateApprovalError as exc:
        logger.info(
            "Skip auto-approve WO %s: %s",
            work_order.id,
            exc.message,
        )
        return False

    from app.services.client_portal_notification_service import (
        notify_owner_portal_logins_sync,
    )

    notify_owner_portal_logins_sync(
        db,
        work_order.client_id,
        title="Estimate auto-approved",
        message=(
            f"Estimate for {work_order.order_number or 'work order'} "
            f"(${total:.2f}) was auto-approved under your ${limit:.2f} limit."
        ),
        notification_type="estimate_auto_approved",
        reference_id=work_order.id,
        related_type="work_order",
        automatic_outreach=True,
    )

    logger.info(
        "Auto-approved estimate WO %s total=%s limit=%s",
        work_order.id,
        total,
        limit,
    )
    return True
