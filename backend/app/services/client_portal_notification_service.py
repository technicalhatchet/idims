"""Fan-out in-app notifications to every active portal login on a client."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_login import ClientLogin
from app.services.portal_login_service import active_login_user_ids
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

_TENANT_BLOCKED_NOTIFICATION_TYPES = frozenset({
    "estimate",
    "estimate_approval",
    "estimate_auto_approved",
    "invoice",
    "payment",
    "review_request",
})


def owner_portal_login_user_ids(db: Session, client_id: UUID) -> List[UUID]:
    rows = (
        db.query(ClientLogin.user_id, ClientLogin.role)
        .filter(
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.is_(None),
            ClientLogin.user_id.isnot(None),
        )
        .all()
    )
    out: List[UUID] = []
    for user_id, role in rows:
        if not user_id:
            continue
        if (role or "owner").strip().lower() == "tenant":
            continue
        out.append(user_id)
    return out


def notify_owner_portal_logins_sync(
    db: Session,
    client_id: UUID,
    *,
    title: str,
    message: str,
    notification_type: str = "in_app",
    reference_id: Optional[UUID] = None,
    related_type: Optional[str] = None,
    meta_data: Optional[Dict[str, Any]] = None,
    automatic_outreach: bool = False,
) -> List[UUID]:
    if automatic_outreach:
        from app.services.customer_outreach_service import (
            automatic_outreach_allowed,
            log_skipped_test_mode,
        )

        if not automatic_outreach_allowed(db, client_id):
            log_skipped_test_mode(
                channel="portal_in_app",
                client_id=client_id,
                detail=title,
            )
            return []

    user_ids = owner_portal_login_user_ids(db, client_id)
    if not user_ids:
        client = db.query(Client).filter(Client.id == client_id).first()
        if client and client.user_id:
            user_ids = [client.user_id]
    if not user_ids:
        return []

    from app.models.notification import Notification
    from datetime import datetime

    notified: List[UUID] = []
    for user_id in user_ids:
        try:
            db.add(
                Notification(
                    user_id=user_id,
                    title=title,
                    content=message,
                    type=notification_type,
                    related_id=reference_id,
                    related_type=related_type or "system",
                    is_read=False,
                    meta_data=meta_data or {},
                    created_at=datetime.utcnow(),
                )
            )
            notified.append(user_id)
        except Exception as exc:
            logger.error(
                "Failed owner portal notification client=%s user=%s: %s",
                client_id,
                user_id,
                exc,
            )
    db.flush()
    return notified


def portal_notification_recipient_user_ids(
    db: Session,
    client_id: UUID,
    *,
    notification_type: str,
    work_order_property_id: Optional[UUID] = None,
) -> List[UUID]:
    """Fan-out targets respecting tenant property scope (Wave 3)."""
    from app.models.client_login_property_access import ClientLoginPropertyAccess

    ntype = (notification_type or "").lower()
    logins = (
        db.query(ClientLogin)
        .filter(
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.is_(None),
            ClientLogin.user_id.isnot(None),
        )
        .all()
    )
    if not logins:
        client = db.query(Client).filter(Client.id == client_id).first()
        if client and client.user_id:
            return [client.user_id]
        return []

    user_ids: List[UUID] = []
    for login in logins:
        if not login.user_id:
            continue
        role = (getattr(login, "role", None) or "owner").strip().lower()
        if role == "tenant":
            if ntype in _TENANT_BLOCKED_NOTIFICATION_TYPES:
                continue
            if work_order_property_id:
                allowed = (
                    db.query(ClientLoginPropertyAccess.property_id)
                    .filter(ClientLoginPropertyAccess.client_login_id == login.id)
                    .all()
                )
                allowed_ids = {row[0] for row in allowed}
                if work_order_property_id not in allowed_ids:
                    continue
        user_ids.append(login.user_id)
    return user_ids


async def notify_client_portal_users(
    db: Session,
    client_id: UUID,
    *,
    title: str,
    message: str,
    notification_type: str = "in_app",
    reference_id: Optional[UUID] = None,
    related_type: Optional[str] = None,
    meta_data: Optional[Dict[str, Any]] = None,
    automatic_outreach: bool = False,
    work_order_property_id: Optional[UUID] = None,
) -> List[UUID]:
    """Create one notification per active login user_id. Returns notified user ids."""
    if automatic_outreach:
        from app.services.customer_outreach_service import (
            automatic_outreach_allowed,
            log_skipped_test_mode,
        )

        if not automatic_outreach_allowed(db, client_id):
            log_skipped_test_mode(
                channel="portal_in_app",
                client_id=client_id,
                detail=title,
            )
            return []

    user_ids = portal_notification_recipient_user_ids(
        db,
        client_id,
        notification_type=notification_type,
        work_order_property_id=work_order_property_id,
    )

    notified: List[UUID] = []
    for user_id in user_ids:
        try:
            await NotificationService.create_notification(
                db,
                {
                    "user_id": user_id,
                    "title": title,
                    "message": message,
                    "type": notification_type,
                    "reference_id": reference_id,
                    "related_type": related_type,
                    "meta_data": meta_data or {},
                },
            )
            notified.append(user_id)
        except Exception as exc:
            logger.error(
                "Failed portal notification for client=%s user=%s: %s",
                client_id,
                user_id,
                exc,
            )
    return notified
