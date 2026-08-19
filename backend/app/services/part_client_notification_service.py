"""Client portal notifications when work-order part status changes."""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.work_order import WorkOrder, WorkOrderPart
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

CLIENT_NOTIFY_STATUSES = frozenset({"ordered", "received"})


async def notify_client_part_status_change(
    db: Session,
    work_order: Optional[WorkOrder],
    part: WorkOrderPart,
    new_status: str,
    previous_status: Optional[str],
) -> None:
    """Create an in-app notification for the client when a part is ordered or received."""
    if not work_order or not work_order.client_id:
        return
    if new_status == previous_status or new_status not in CLIENT_NOTIFY_STATUSES:
        return

    client = db.query(Client).filter(Client.id == work_order.client_id).first()
    if not client or not client.user_id:
        return

    part_label = (part.description or part.number or "Part").strip()
    order_num = work_order.order_number or str(work_order.id)[:8]

    if new_status == "ordered":
        title = "Part ordered for your repair"
        message = (
            f"We've ordered {part_label} for work order #{order_num}. "
            "We'll update you when it arrives."
        )
    else:
        title = "Part arrived for your repair"
        message = (
            f"{part_label} has arrived for work order #{order_num}. "
            "We'll contact you to schedule your return visit."
        )

    try:
        await NotificationService.create_notification(
            db,
            {
                "user_id": client.user_id,
                "title": title,
                "message": message,
                "type": "in_app",
                "reference_id": work_order.id,
                "related_type": "work_order",
                "meta_data": {
                    "part_id": str(part.id),
                    "part_status": new_status,
                    "work_order_number": order_num,
                },
            },
        )
    except Exception as exc:
        logger.error(
            "Failed to notify client of part status change (wo=%s part=%s status=%s): %s",
            work_order.id,
            part.id,
            new_status,
            exc,
        )
