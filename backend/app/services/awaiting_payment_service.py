"""Awaiting Pay: jobs with money owed now, plus the pay link send log.

The list is every work order (not canceled) whose balance due today is at least a cent —
the same number the pay sheet, pay link and portal charge (compute_balance_due).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import exists, or_, text
from sqlalchemy.orm import Session, joinedload

from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderPart, WorkOrderService
from app.services.work_order_billing_helpers import (
    PART_DUE_STATUSES,
    compute_balance_due,
    compute_due_later,
)

logger = logging.getLogger(__name__)

SEND_CHANNELS = frozenset({"text", "email", "copy", "qr"})
# Postgres enum: "cancelled" is not a member and would error in SQL.
EXCLUDED_WO_STATUSES = ("canceled", "refunded")
PAYMENT_READY_VISIT_STATUSES = frozenset({"completed_pending_payment", "completed", "phone_payment"})
MIN_DUE = Decimal("0.01")


def _status(value: Any) -> str:
    return str(getattr(value, "value", value) or "").lower()


def record_send(db: Session, work_order_id: uuid.UUID, channel: str, user_id: Optional[uuid.UUID]) -> Dict[str, Any]:
    """Log that a pay link went out (caller commits). Raises ValueError on a bad channel."""
    channel = str(channel or "").strip().lower()
    if channel not in SEND_CHANNELS:
        raise ValueError(f"Unknown channel: {channel or '(none)'}")
    row = db.execute(
        text(
            "INSERT INTO pay_link_sends (work_order_id, channel, sent_by) "
            "VALUES (:wo, :channel, :user) RETURNING sent_at"
        ),
        {"wo": str(work_order_id), "channel": channel, "user": str(user_id) if user_id else None},
    ).first()
    return {"channel": channel, "sent_at": _iso(row[0]) if row else None}


def record_send_quietly(db: Session, work_order_id: uuid.UUID, channel: str, user_id: Optional[uuid.UUID]) -> None:
    """Best effort: a missing table (SQL not run yet) never breaks the send itself."""
    try:
        with db.begin_nested():
            record_send(db, work_order_id, channel, user_id)
    except Exception:  # noqa: BLE001
        logger.warning("pay_link_sends insert failed for %s (%s)", work_order_id, channel, exc_info=True)


def last_sends(db: Session, work_order_ids: Iterable[uuid.UUID]) -> Dict[str, Dict[str, Any]]:
    ids = [str(i) for i in work_order_ids]
    if not ids:
        return {}
    try:
        with db.begin_nested():
            rows = db.execute(
                text(
                    "SELECT DISTINCT ON (work_order_id) work_order_id, channel, sent_at "
                    "FROM pay_link_sends WHERE work_order_id = ANY(CAST(:ids AS uuid[])) "
                    "ORDER BY work_order_id, sent_at DESC"
                ),
                {"ids": ids},
            ).all()
    except Exception:  # noqa: BLE001
        logger.warning("pay_link_sends lookup failed (table missing?)", exc_info=True)
        return {}
    return {str(r[0]): {"channel": r[1], "sent_at": _iso(r[2])} for r in rows}


def _iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def owed_since(work_order: WorkOrder) -> Optional[datetime]:
    """When the money became owed: the latest payment-ready visit (its end, else its start)."""
    best = None
    for appt in work_order.appointments or []:
        if _status(appt.status) not in PAYMENT_READY_VISIT_STATUSES:
            continue
        when = appt.actual_end or appt.scheduled_start
        if when and (best is None or when > best):
            best = when
    return best or work_order.updated_at


def days_open(work_order: WorkOrder, now: Optional[datetime] = None) -> int:
    since = owed_since(work_order)
    if not since:
        return 0
    now = now or datetime.utcnow()
    if since.tzinfo is not None:
        since = since.astimezone(timezone.utc).replace(tzinfo=None)
    return max(0, (now.date() - since.date()).days)


def _client_label(work_order: WorkOrder) -> str:
    c = work_order.client
    if not c:
        return "No client"
    try:
        return c.display_name or "Client"
    except Exception:  # noqa: BLE001
        return (c.company_name or f"{c.first_name or ''} {c.last_name or ''}".strip() or "Client")


def _appliance_label(work_order: WorkOrder) -> str:
    kind = (work_order.equipment_subtype or work_order.equipment_type or "").replace("_", " ")
    return " ".join(x for x in [work_order.equipment_make, kind] if x).strip() or "Appliance"


def _candidates(db: Session) -> List[WorkOrder]:
    """Open money only: a billable service line or a due-status part, and not canceled."""
    billable_line = exists().where(
        WorkOrderService.work_order_id == WorkOrder.id,
        WorkOrderService.billing_status == "billable",
    )
    due_part = exists().where(
        WorkOrderPart.work_order_id == WorkOrder.id,
        WorkOrderPart.status.in_(sorted(PART_DUE_STATUSES)),
    )
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.service_items).joinedload(WorkOrderService.service),
            joinedload(WorkOrder.parts),
            joinedload(WorkOrder.appointments),
            joinedload(WorkOrder.client),
        )
        .filter(~WorkOrder.status.in_(EXCLUDED_WO_STATUSES))
        .filter(or_(billable_line, due_part))
        .all()
    )


def list_awaiting_payment(db: Session, *, now: Optional[datetime] = None) -> Dict[str, Any]:
    from app.services.pay_link_service import ensure_pay_token, pay_url_for_token

    items: List[Dict[str, Any]] = []
    rows: List[WorkOrder] = []
    for wo in _candidates(db):
        due = compute_balance_due(wo, db=db)
        if due < MIN_DUE:
            continue
        rows.append(wo)
        client = wo.client
        items.append({
            "id": str(wo.id),
            "order_number": wo.order_number,
            "status": _status(wo.status),
            "client": _client_label(wo),
            "phone": (client.mobile or client.phone) if client else None,
            "appliance": _appliance_label(wo),
            "balance_due": float(due),
            "due_later": float(compute_due_later(wo, db=db)),
            "days_open": days_open(wo, now),
            "pay_url": pay_url_for_token(ensure_pay_token(db, wo)),
        })

    sends = last_sends(db, [wo.id for wo in rows])
    for item in items:
        item["last_send"] = sends.get(item["id"])

    items.sort(key=lambda i: (-i["days_open"], -i["balance_due"]))
    return {
        "count": len(items),
        "total_due": round(sum(i["balance_due"] for i in items), 2),
        "total_later": round(sum(i["due_later"] for i in items), 2),
        "over_30": sum(1 for i in items if i["days_open"] >= 30),
        "items": items,
    }
