"""Web Push notifications: pending work orders, deploy reminders, proximity nudges."""

from __future__ import annotations

import json
import logging
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo
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
from app.services.push_notification_settings_service import (
    get_push_rule,
    is_morning_briefing_due_now,
)
from app.services.scheduling_constraints_service import (
    APPOINTMENT_STATUS_CANCELED,
    appointment_local_naive,
)
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

    rule = get_push_rule(db, "deploy_reminder")
    if not rule.get("enabled", True):
        return False
    notify_user = db.query(User).filter(User.id == reminder.user_id).first()
    if notify_user and not _user_matches_recipients(notify_user, rule.get("recipients") or {}):
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


def _user_matches_recipients(user: User, recipients: Dict[str, Any]) -> bool:
    if user.is_admin and recipients.get("admin", True):
        return True
    if user.is_manager and recipients.get("manager", True):
        return True
    if user.is_technician and recipients.get("technician", True):
        return True
    return False


def _users_for_recipients(
    db: Session,
    recipients: Dict[str, Any],
    *,
    extra_user_ids: Optional[List[uuid.UUID]] = None,
) -> List[User]:
    staff = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    users_by_id = {u.id: u for u in staff if _user_matches_recipients(u, recipients)}
    for user_id in extra_user_ids or []:
        if user_id in users_by_id:
            continue
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
        if user:
            users_by_id[user.id] = user
    return list(users_by_id.values())


def _notify_push_rule(
    db: Session,
    rule_key: str,
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    extra_user_ids: Optional[List[uuid.UUID]] = None,
) -> int:
    rule = get_push_rule(db, rule_key)
    if not rule.get("enabled", True):
        return 0
    recipients = rule.get("recipients") or {}
    extra = list(extra_user_ids or [])
    users = _users_for_recipients(db, recipients, extra_user_ids=extra or None)
    return _notify_users(db, users, title=title, body=body, url=url, tag=tag)


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


def notify_pending_work_order(db: Session, work_order: WorkOrder) -> int:
    """Push to admin/manager staff when a new pending work order arrives."""
    if (work_order.status or "").lower() != "pending":
        return 0

    order_label = work_order.order_number or str(work_order.id)[:8]
    return _notify_push_rule(
        db,
        "pending_work_order",
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

    return _notify_push_rule(
        db,
        "portal_self_schedule",
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

    return _notify_push_rule(
        db,
        "portal_update_request",
        title="Portal update request",
        body=f"{client_name} on #{order_label}: {preview}" if preview else f"{client_name} requested an update on #{order_label}.",
        url=f"/work_orders/{work_order.id}/mobile",
        tag=f"portal-update-{work_order.id}",
    )


def notify_portal_scheduling_request(
    db: Session,
    work_order: WorkOrder,
    client: Client,
    *,
    time_window: str,
) -> int:
    """Push when a client submits a same-day / priority scheduling request."""
    order_label = work_order.order_number or str(work_order.id)[:8]
    client_name = client.display_name if hasattr(client, "display_name") else f"{client.first_name} {client.last_name}"
    meta = work_order.portal_scheduling_meta or {}
    tier = meta.get("service_tier") or "standard"
    tier_label = "Same-day" if tier == "standard" else tier.replace("_", " ").title()

    appliance_bits: List[str] = []
    if work_order.equipment_make:
        appliance_bits.append(str(work_order.equipment_make))
    if work_order.equipment_subtype:
        appliance_bits.append(str(work_order.equipment_subtype).replace("_", " "))
    appliance_label = " ".join(appliance_bits) or "appliance"
    window_label = (time_window or "").strip().capitalize()

    body = f"{tier_label} request: {client_name} — {appliance_label} ({window_label}). #{order_label}"
    if len(body) > 180:
        body = body[:177] + "..."

    extra_user_ids: List[uuid.UUID] = []
    if work_order.assigned_technician_id:
        tech_user_id = _tech_user_id_for_technician(db, work_order.assigned_technician_id)
        if tech_user_id:
            extra_user_ids.append(tech_user_id)

    return _notify_push_rule(
        db,
        "portal_same_day_request",
        title="Scheduling approval needed",
        body=body,
        url=f"/work_orders/{work_order.id}/mobile",
        tag=f"portal-request-{work_order.id}",
        extra_user_ids=extra_user_ids or None,
    )


def _tech_user_id_for_technician(db: Session, technician_id: uuid.UUID) -> Optional[uuid.UUID]:
    tech = db.query(Technician).filter(Technician.id == technician_id).first()
    return tech.user_id if tech else None


def _shop_timezone() -> ZoneInfo:
    try:
        return ZoneInfo(settings.SHOP_TIMEZONE or "America/Detroit")
    except Exception:
        return ZoneInfo("America/Detroit")


def _shop_now() -> datetime:
    return datetime.now(_shop_timezone())


def _shop_today_bounds() -> Tuple[datetime, datetime, str]:
    """Return naive shop-local start/end of today and ISO date key."""
    today = _shop_now().date()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)
    return start, end, today.isoformat()


def _format_shop_time(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    local = appointment_local_naive(dt)
    label = local.strftime("%I:%M %p")
    return label[1:] if label.startswith("0") else label


def _morning_briefing_scope(db: Session, user: User) -> Optional[str]:
    """shop = all appointments today; technician = only assigned to this tech."""
    rule = get_push_rule(db, "morning_briefing")
    if not rule.get("enabled", True):
        return None

    recipients = rule.get("recipients") or {}
    if not _user_matches_recipients(user, recipients):
        return None

    office = (user.is_admin and recipients.get("admin")) or (
        user.is_manager and recipients.get("manager")
    )
    if office:
        return "shop"

    if user.is_technician and recipients.get("technician"):
        if rule.get("technicians_see_own_jobs_only", True):
            tech = db.query(Technician).filter(Technician.user_id == user.id).first()
            return "technician" if tech else None
        return "shop"

    return None


def _today_appointments_for_user(
    db: Session,
    user: User,
    *,
    day_start: datetime,
    day_end: datetime,
) -> List[WorkOrderAppointment]:
    scope = _morning_briefing_scope(db, user)
    if not scope:
        return []

    query = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.scheduled_start < day_end,
            WorkOrderAppointment.scheduled_end > day_start,
            WorkOrderAppointment.status != APPOINTMENT_STATUS_CANCELED,
            WorkOrderAppointment.status != "completed",
        )
        .order_by(WorkOrderAppointment.scheduled_start.asc())
    )

    if scope == "technician":
        tech = db.query(Technician).filter(Technician.user_id == user.id).first()
        if not tech:
            return []
        query = query.filter(WorkOrderAppointment.assigned_technician_id == tech.id)

    return query.all()


def _morning_briefing_message(appointments: List[WorkOrderAppointment], *, shop_scope: bool) -> str:
    count = len(appointments)
    if count == 0:
        return "No jobs on the schedule for today."

    first_time = _format_shop_time(appointments[0].scheduled_start)
    job_word = "job" if count == 1 else "jobs"
    if shop_scope:
        if first_time:
            return f"{count} {job_word} on the board today. First appointment: {first_time}."
        return f"{count} {job_word} on the board today."

    if first_time:
        return f"{count} {job_word} today. First stop: {first_time}."
    return f"{count} {job_word} today."


def _morning_briefing_already_sent(user: User, today_key: str) -> bool:
    prefs = user.preferences if isinstance(user.preferences, dict) else {}
    return prefs.get("morning_briefing_sent") == today_key


def _mark_morning_briefing_sent(db: Session, user: User, today_key: str) -> None:
    prefs = dict(user.preferences or {})
    prefs["morning_briefing_sent"] = today_key
    user.preferences = prefs
    db.add(user)


def send_morning_briefing_to_user(
    db: Session,
    user: User,
    *,
    day_start: datetime,
    day_end: datetime,
    today_key: str,
) -> int:
    """Send one morning schedule summary push to a user. Returns deliveries."""
    if not user.is_active:
        return 0

    scope = _morning_briefing_scope(db, user)
    if not scope:
        return 0

    appointments = _today_appointments_for_user(
        db, user, day_start=day_start, day_end=day_end
    )
    body = _morning_briefing_message(appointments, shop_scope=(scope == "shop"))
    url = "/techboard" if scope == "technician" else "/schedule"
    tag = f"morning-briefing-{today_key}"

    delivered = send_push_to_user(
        db,
        user.id,
        title="Today's schedule",
        body=body,
        url=url,
        tag=tag,
    )
    if delivered:
        _mark_morning_briefing_sent(db, user, today_key)
        db.commit()
    return delivered


def maybe_send_morning_briefing_for_user(
    db: Session,
    user_id: uuid.UUID,
    *,
    force: bool = False,
) -> bool:
    """Idempotent morning briefing for one user (heartbeat or Celery)."""
    if not _vapid_configured():
        return False

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        return False

    day_start, day_end, today_key = _shop_today_bounds()
    if _morning_briefing_already_sent(user, today_key):
        return False

    if not force and not is_morning_briefing_due_now(db):
        return False

    return send_morning_briefing_to_user(
        db,
        user,
        day_start=day_start,
        day_end=day_end,
        today_key=today_key,
    ) > 0


def send_morning_schedule_summaries(db: Session) -> int:
    """Push today's job count + first start time to subscribed staff (once per day each)."""
    if not _vapid_configured():
        return 0
    if not is_morning_briefing_due_now(db):
        return 0

    day_start, day_end, today_key = _shop_today_bounds()
    user_ids = [
        row[0]
        for row in db.query(PushSubscription.user_id).distinct().all()
    ]
    sent_users = 0
    for user_id in user_ids:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
        if not user or _morning_briefing_already_sent(user, today_key):
            continue
        if send_morning_briefing_to_user(
            db,
            user,
            day_start=day_start,
            day_end=day_end,
            today_key=today_key,
        ):
            sent_users += 1
    return sent_users
