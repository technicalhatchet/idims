"""5:30 PM narrowing batch — compute ETA windows and notify clients."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.services.notification_service import NotificationService
from app.services.portal_eta_service import compute_client_eta_window
from app.services.portal_scheduling_helpers import format_display_time, parse_hhmm, shop_local_naive, shop_now
from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings

logger = logging.getLogger(__name__)

ACTIVE_APPOINTMENT_STATUSES = ("scheduled", "reschedule", "en_route", "in_progress")


def _narrowing_target_date(settings: dict, now: Optional[datetime] = None) -> date:
    """Appointments on shop-local tomorrow are narrowed when batch runs tonight."""
    now = shop_local_naive(now) if now is not None else shop_now()
    return (now + timedelta(days=1)).date()


def _batch_due_now(settings: dict, now: Optional[datetime] = None) -> bool:
    now = shop_local_naive(now) if now is not None else shop_now()
    batch_hhmm = settings.get("narrowing_batch_time", "17:30")
    bh, bm = parse_hhmm(batch_hhmm)
    batch_today = now.replace(hour=bh, minute=bm, second=0, microsecond=0)
    # Allow a 20-minute window so hourly/:15 cron catches it
    return batch_today <= now < batch_today + timedelta(minutes=20)


def _window_cfg(settings: dict, time_window: str) -> dict:
    windows = settings.get("scheduling_windows") or {}
    return windows.get(time_window) or {}


def _format_narrowing_message(
    client: Client,
    appointment: WorkOrderAppointment,
    eta_display: str,
    appt_date: date,
) -> str:
    name = client.first_name or "there"
    date_label = appt_date.strftime("%A, %B %d").replace(" 0", " ")
    return (
        f"Hi {name}, your Atomic Repair technician is scheduled for {date_label}. "
        f"Your arrival window is {eta_display}. "
        f"Questions? Call (419) 740-0146."
    )


async def _notify_client_narrowing(
    db: Session,
    client: Client,
    message: str,
    *,
    send_sms: bool,
    send_email: bool,
) -> None:
    if send_sms and client.phone:
        try:
            await NotificationService.send_sms(client.phone, message)
        except Exception as exc:
            logger.warning("Narrowing SMS failed for client %s: %s", client.id, exc)

    if send_email and client.email:
        try:
            await NotificationService.send_email(
                to_email=client.email,
                subject="Your appointment arrival window",
                body=message,
            )
        except Exception as exc:
            logger.warning("Narrowing email failed for client %s: %s", client.id, exc)


def run_narrowing_batch(db: Session, *, force: bool = False) -> int:
    """
    Narrow tomorrow's portal appointments and send SMS/email.
    Returns count of appointments processed.
    """
    import asyncio

    settings = get_portal_scheduling_settings(db)
    now = shop_now()

    if not force and not _batch_due_now(settings, now):
        return 0

    target = _narrowing_target_date(settings, now)
    day_start = datetime.combine(target, time.min)
    day_end = datetime.combine(target, time.max)

    appointments: List[WorkOrderAppointment] = (
        db.query(WorkOrderAppointment)
        .options(
            joinedload(WorkOrderAppointment.work_order).joinedload(WorkOrder.client),
        )
        .join(WorkOrder, WorkOrderAppointment.work_order_id == WorkOrder.id)
        .filter(
            WorkOrderAppointment.scheduled_start >= day_start,
            WorkOrderAppointment.scheduled_start <= day_end,
            WorkOrderAppointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
            WorkOrderAppointment.time_window.isnot(None),
        )
        .all()
    )

    comms = settings.get("comms") or {}
    send_sms = bool(comms.get("narrowing_sms", True))
    send_email = bool(comms.get("narrowing_email", True))

    processed = 0
    for appt in appointments:
        if appt.client_eta_narrowed_at and not force:
            continue

        tw = appt.time_window or "morning"
        eta = compute_client_eta_window(
            appt.scheduled_start,
            tw,
            window_cfg=_window_cfg(settings, tw),
        )
        if not eta:
            continue

        appt.client_eta_start = eta["eta_start"]
        appt.client_eta_end = eta["eta_end"]
        appt.client_eta_narrowed_at = datetime.utcnow()

        client = appt.work_order.client if appt.work_order else None
        if client and (send_sms or send_email):
            message = _format_narrowing_message(client, appt, eta["display"], target)
            asyncio.run(
                _notify_client_narrowing(
                    db, client, message, send_sms=send_sms, send_email=send_email
                )
            )

        processed += 1

    db.commit()
    return processed


def narrowing_visible_for_date(
    settings: dict,
    on_date: date,
    *,
    now: Optional[datetime] = None,
) -> bool:
    """True when narrowed ETA should be shown (after batch for tomorrow)."""
    now = shop_local_naive(now) if now is not None else shop_now()
    tomorrow = (now.date() + timedelta(days=1))
    if on_date != tomorrow:
        return False
    batch_hhmm = settings.get("narrowing_batch_time", "17:30")
    bh, bm = parse_hhmm(batch_hhmm)
    batch_today = now.replace(hour=bh, minute=bm, second=0, microsecond=0)
    return now >= batch_today
