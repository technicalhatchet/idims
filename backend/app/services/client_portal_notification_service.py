"""Fan-out in-app notifications to every active portal login on a client."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.services.portal_login_service import active_login_user_ids
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


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
) -> List[UUID]:
    """Create one notification per active login user_id. Returns notified user ids."""
    user_ids = active_login_user_ids(db, client_id)
    if not user_ids:
        client = db.query(Client).filter(Client.id == client_id).first()
        if client and client.user_id:
            user_ids = [client.user_id]
    if not user_ids:
        return []

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
