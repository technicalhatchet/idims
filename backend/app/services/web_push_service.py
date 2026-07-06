"""Web Push notifications: pending work orders, deploy reminders, proximity nudges."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
import uuid

from sqlalchemy.orm import Session
from pywebpush import WebPushException, webpush

from app.config import settings
from app.models.client import Client
from app.models.push_subscription import DeployReminder, PushSubscription
from app.models.technician import Technician
from app.models.user import User
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.models.property import Property
from app.utils.travel_calculator import geocode_address, haversine_distance

logger = logging.getLogger(__name__)

DEPLOY_BUFFER_MINUTES = 5
DEFAULT_TRAVEL_SECONDS = 20 * 60
PROXIMITY_MILES = 0.25


def _vapid_configured() -> bool:
    return bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY and settings.VAPID_SUBJECT)


def _subscription_payload(sub: PushSubscription) -> Dict[str, Any]:
    return {
        "endpoint": sub.endpoint,
        "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key},
    }


def send_push_to_user(
    db: Session,
    user_id: uuid.UUID,
    *,
    title: str,
    body: str,
    url: Optional[str] = None,
    tag: Optional[str] = None,
) -> int:
    """Send push to all subscriptions for a user. Returns count delivered."""
    if not _vapid_configured():
        return 0

    subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subs:
        return 0

    delivered = 0
    stale: List[PushSubscription] = []
    for sub in subs:
        if not _vapid_configured():
            break
        payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
        try:
            webpush(
                subscription_info=_subscription_payload(sub),
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
            delivered += 1
        except WebPushException as exc:
            status_code = getattr(exc.response, "status_code", None) if exc.response else None
            logger.warning("Web push failed for subscription %s: %s (status=%s)", sub.id, exc, status_code)
            if status_code in (404, 410):
                stale.append(sub)
        except Exception as exc:
            logger.error("Unexpected web push error for subscription %s: %s", sub.id, exc)

    for sub in stale:
        db.delete(sub)
    if stale:
        db.commit()

    return delivered


def _tech_user_id(db: Session, appointment: WorkOrderAppointment) -> Optional[uuid.UUID]:
    if not appointment.assigned_technician_id:
        return None
    tech = db.query(Technician).filter(Technician.id == appointment.assigned_technician_id).first()
    return tech.user_id if tech else None


def _appointment_status(appointment: WorkOrderAppointment) -> str:
    raw = appointment.status
    if hasattr(raw, "value"):
        return str(raw.value).lower()
    return str(raw or "").lower()


def _service_address(db: Session, work_order: WorkOrder) -> Optional[str]:
    sl = work_order.service_location
    if isinstance(sl, dict):
        addr = sl.get("address") or sl.get("street")
        if addr:
            return str(addr)
    elif isinstance(sl, str) and sl.strip():
        return sl.strip()

    if work_order.property_id:
        prop = db.query(Property).filter(Property.id == work_order.property_id).first()
        if prop and prop.address:
            return prop.address
    return None


def ensure_job_coords(db: Session, work_order: WorkOrder) -> Optional[Tuple[float, float]]:
    """Return cached lat/lng from service_location, geocoding once if needed."""
    sl = work_order.service_location
    if not isinstance(sl, dict):
        sl = {}

    lat, lng = sl.get("lat"), sl.get("lng")
    if lat is not None and lng is not None:
        return float(lat), float(lng)

    address = _service_address(db, work_order)
    if not address:
        return None

    coords = geocode_address(address)
    if not coords:
        return None

    merged = dict(sl)
    merged["lat"] = coords["lat"]
    merged["lng"] = coords["lng"]
    work_order.service_location = merged
    db.add(work_order)
    db.flush()
    return coords["lat"], coords["lng"]


def _deploy_fire_at(appointment: WorkOrderAppointment, en_route_at: datetime) -> datetime:
    travel_sec = appointment.travel_time_before
    if not travel_sec or travel_sec <= 0:
        travel_sec = DEFAULT_TRAVEL_SECONDS
    return en_route_at + timedelta(seconds=int(travel_sec)) + timedelta(minutes=DEPLOY_BUFFER_MINUTES)


def schedule_deploy_reminder(db: Session, appointment: WorkOrderAppointment) -> Optional[DeployReminder]:
    user_id = _tech_user_id(db, appointment)
    if not user_id:
        logger.info("No technician user for appointment %s; skip deploy reminder", appointment.id)
        return None

    now = datetime.utcnow()
    fire_at = _deploy_fire_at(appointment, now)
    existing = (
        db.query(DeployReminder)
        .filter(DeployReminder.appointment_id == appointment.id)
        .first()
    )
    if existing:
        existing.user_id = user_id
        existing.work_order_id = appointment.work_order_id
        existing.fire_at = fire_at
        existing.sent_at = None
        existing.canceled_at = None
        db.commit()
        db.refresh(existing)
        return existing

    reminder = DeployReminder(
        appointment_id=appointment.id,
        work_order_id=appointment.work_order_id,
        user_id=user_id,
        fire_at=fire_at,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    logger.info(
        "Scheduled deploy reminder for appointment %s at %s (travel=%ss + %smin buffer)",
        appointment.id,
        fire_at.isoformat(),
        appointment.travel_time_before or DEFAULT_TRAVEL_SECONDS,
        DEPLOY_BUFFER_MINUTES,
    )
    return reminder


def cancel_deploy_reminder(db: Session, appointment_id: uuid.UUID) -> None:
    reminder = (
        db.query(DeployReminder)
        .filter(
            DeployReminder.appointment_id == appointment_id,
            DeployReminder.canceled_at.is_(None),
            DeployReminder.sent_at.is_(None),
        )
        .first()
    )
    if reminder:
        reminder.canceled_at = datetime.utcnow()
        db.commit()


def _send_deploy_nudge(
    db: Session,
    reminder: DeployReminder,
    appointment: WorkOrderAppointment,
    work_order: WorkOrder,
) -> bool:
    if reminder.sent_at or reminder.canceled_at:
        return False
    if _appointment_status(appointment) != "en_route":
        reminder.canceled_at = datetime.utcnow()
        db.commit()
        return False

    order_label = work_order.order_number or str(work_order.id)[:8]
    url = f"/work_orders/{work_order.id}/mobile"
    tag = f"deploy-{appointment.id}"
    count = send_push_to_user(
        db,
        reminder.user_id,
        title="Tap In Progress",
        body=f"You're at the job site for #{order_label}. Mark the visit in progress.",
        url=url,
        tag=tag,
    )
    reminder.sent_at = datetime.utcnow()
    db.commit()
    return count > 0


def process_due_deploy_reminders(db: Session) -> int:
    """Fire deploy nudges whose timer has elapsed. Returns count sent."""
    now = datetime.utcnow()
    due = (
        db.query(DeployReminder)
        .filter(
            DeployReminder.fire_at <= now,
            DeployReminder.sent_at.is_(None),
            DeployReminder.canceled_at.is_(None),
        )
        .all()
    )
    sent = 0
    for reminder in due:
        appointment = (
            db.query(WorkOrderAppointment)
            .filter(WorkOrderAppointment.id == reminder.appointment_id)
            .first()
        )
        if not appointment:
            reminder.canceled_at = datetime.utcnow()
            db.commit()
            continue
        work_order = db.query(WorkOrder).filter(WorkOrder.id == reminder.work_order_id).first()
        if not work_order:
            reminder.canceled_at = datetime.utcnow()
            db.commit()
            continue
        if _send_deploy_nudge(db, reminder, appointment, work_order):
            sent += 1
    return sent


def check_deploy_proximity(
    db: Session,
    appointment_id: uuid.UUID,
    user_id: uuid.UUID,
    lat: float,
    lng: float,
) -> Dict[str, Any]:
    """
    Cheap hybrid: haversine vs cached job coords (~¼ mi).
    If still en_route and close, send deploy nudge immediately.
    """
    appointment = (
        db.query(WorkOrderAppointment)
        .filter(WorkOrderAppointment.id == appointment_id)
        .first()
    )
    if not appointment:
        return {"sent": False, "reason": "appointment_not_found"}
    if _appointment_status(appointment) != "en_route":
        return {"sent": False, "reason": "not_en_route"}

    tech_user = _tech_user_id(db, appointment)
    if tech_user and tech_user != user_id:
        return {"sent": False, "reason": "not_assigned_tech"}

    reminder = (
        db.query(DeployReminder)
        .filter(DeployReminder.appointment_id == appointment_id)
        .first()
    )
    if reminder and reminder.sent_at:
        return {"sent": False, "reason": "already_sent"}

    work_order = db.query(WorkOrder).filter(WorkOrder.id == appointment.work_order_id).first()
    if not work_order:
        return {"sent": False, "reason": "work_order_not_found"}

    job_coords = ensure_job_coords(db, work_order)
    if not job_coords:
        return {"sent": False, "reason": "no_job_coords"}

    job_lat, job_lng = job_coords
    miles = haversine_distance(lat, lng, job_lat, job_lng)
    if miles > PROXIMITY_MILES:
        return {"sent": False, "reason": "too_far", "distance_miles": round(miles, 3)}

    if not reminder:
        reminder = DeployReminder(
            appointment_id=appointment.id,
            work_order_id=appointment.work_order_id,
            user_id=user_id,
            fire_at=datetime.utcnow(),
        )
        db.add(reminder)
        db.flush()

    notify_user = reminder.user_id or user_id
    order_label = work_order.order_number or str(work_order.id)[:8]
    count = send_push_to_user(
        db,
        notify_user,
        title="Tap In Progress",
        body=f"You're at the job site for #{order_label}. Mark the visit in progress.",
        url=f"/work_orders/{work_order.id}/mobile",
        tag=f"deploy-{appointment.id}",
    )
    reminder.sent_at = datetime.utcnow()
    db.commit()
    return {"sent": count > 0, "distance_miles": round(miles, 3)}


def handle_appointment_status_push(
    db: Session,
    appointment: WorkOrderAppointment,
    previous_status: str,
    new_status: str,
) -> None:
    prev = (previous_status or "").lower()
    new = (new_status or "").lower()
    if new == "en_route" and prev != "en_route":
        schedule_deploy_reminder(db, appointment)
    elif prev == "en_route" and new != "en_route":
        cancel_deploy_reminder(db, appointment.id)


def _admin_manager_users(db: Session) -> List[User]:
    staff = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    return [u for u in staff if u.is_admin or u.is_manager]


def _portal_staff_users(db: Session) -> List[User]:
    """Admin, manager, and technician users who should see portal activity."""
    staff = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    return [u for u in staff if u.is_admin or u.is_manager or u.is_technician]


def _notify_users(
    db: Session,
    users: List[User],
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
) -> int:
    if not users:
        return 0
    total = 0
    seen: set[uuid.UUID] = set()
    for user in users:
        if user.id in seen:
            continue
        seen.add(user.id)
        total += send_push_to_user(
            db,
            user.id,
            title=title,
            body=body,
            url=url,
            tag=tag,
        )
    return total


def _notify_admin_managers(
    db: Session,
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
) -> int:
    return _notify_users(db, _admin_manager_users(db), title=title, body=body, url=url, tag=tag)


def _notify_portal_staff(
    db: Session,
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    extra_user_ids: Optional[List[uuid.UUID]] = None,
) -> int:
    users_by_id = {u.id: u for u in _portal_staff_users(db)}
    for user_id in extra_user_ids or []:
        if user_id in users_by_id:
            continue
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
        if user:
            users_by_id[user.id] = user
    return _notify_users(
        db,
        list(users_by_id.values()),
        title=title,
        body=body,
        url=url,
        tag=tag,
    )


def notify_pending_work_order(db: Session, work_order: WorkOrder) -> int:
    """Push to admin/manager staff when a new pending work order arrives."""
    if (work_order.status or "").lower() != "pending":
        return 0

    order_label = work_order.order_number or str(work_order.id)[:8]
    return _notify_admin_managers(
        db,
        title="New pending work order",
        body=f"#{order_label} needs scheduling.",
        url=f"/work_orders/{work_order.id}/mobile",
        tag=f"pending-wo-{work_order.id}",
    )


def notify_portal_self_schedule(
    db: Session,
    work_order: WorkOrder,
    appointment: WorkOrderAppointment,
    client: Client,
    *,
    time_window: str,
    window_display: str,
) -> int:
    """Push to admin/manager/technician staff when a client self-schedules through the portal."""
    order_label = work_order.order_number or str(work_order.id)[:8]
    client_name = client.display_name if hasattr(client, "display_name") else f"{client.first_name} {client.last_name}"

    date_part = ""
    if appointment.scheduled_start:
        start = appointment.scheduled_start
        if getattr(start, "tzinfo", None) is not None:
            start = start.replace(tzinfo=None)
        date_part = f"{start.month}/{start.day}"

    appliance_bits: List[str] = []
    if work_order.equipment_make:
        appliance_bits.append(str(work_order.equipment_make))
    if work_order.equipment_subtype:
        appliance_bits.append(str(work_order.equipment_subtype).replace("_", " "))
    appliance_label = " ".join(appliance_bits) or "appliance"

    window_label = (time_window or "").strip().capitalize() or window_display
    when = f"{date_part} {window_label}".strip() if date_part else window_label
    body = f"{client_name} booked #{order_label} — {when} ({appliance_label})."
    if len(body) > 180:
        body = body[:177] + "..."

    extra_user_ids: List[uuid.UUID] = []
    tech_user_id = _tech_user_id(db, appointment)
    if tech_user_id:
        extra_user_ids.append(tech_user_id)

    return _notify_portal_staff(
        db,
        title="Portal booking confirmed",
        body=body,
        url=f"/work_orders/{work_order.id}/mobile",
        tag=f"portal-schedule-{work_order.id}",
        extra_user_ids=extra_user_ids or None,
    )


def notify_portal_update_request(
    db: Session,
    work_order: WorkOrder,
    client: Client,
    message: str,
) -> int:
    """Push when a client requests an update on an open portal work order."""
    order_label = work_order.order_number or str(work_order.id)[:8]
    client_name = client.display_name if hasattr(client, "display_name") else f"{client.first_name} {client.last_name}"
    preview = (message or "").strip().replace("\n", " ")
    if len(preview) > 100:
        preview = preview[:97] + "..."

    return _notify_portal_staff(
        db,
        title="Portal update request",
        body=f"{client_name} on #{order_label}: {preview}" if preview else f"{client_name} requested an update on #{order_label}.",
        url=f"/work_orders/{work_order.id}/mobile",
        tag=f"portal-update-{work_order.id}",
    )
