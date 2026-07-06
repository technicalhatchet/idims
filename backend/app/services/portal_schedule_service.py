"""Client portal self-scheduling — availability, estimate, instant confirm."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ValidationException
from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.technician import Technician
from app.models.user import User
from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderNote
from app.schemas.work_order import InitialAppointmentCreate
from app.services import client_appliance_service as appliance_svc
from app.services.diagnostic_booking_service import (
    appliance_to_booking_key,
    build_booking_estimate,
)
from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings
from app.services.scheduling_constraints_service import (
    TechnicianOccupancyCache,
    slot_is_available,
)
from app.services.work_order_service import WorkOrderService
from app.utils.travel_calculator import (
    get_default_shop_address,
    get_travel_time_and_distance,
    sanitize_address_for_routing,
)

logger = logging.getLogger(__name__)

PORTAL_CALL_MESSAGE = "Please call us at (419) 515-3394 to schedule service."
SCHEDULE_SUPPORT_PHONE = "(419) 515-3394"


def _portal_booking_estimate(db: Session, client: Client, appliance: ClientAppliance, address: str) -> dict:
    return build_booking_estimate(
        db,
        appliance_to_booking_key(appliance),
        address,
        zone_exempt=appliance_svc.client_scheduling_zone_exempt(client),
    )


def _enum_value(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def _parse_hhmm(value: str) -> Tuple[int, int]:
    hour, minute = (value or "00:00").split(":")
    return int(hour), int(minute)


def _combine_date_time(on_date: date, hhmm: str) -> datetime:
    h, m = _parse_hhmm(hhmm)
    return datetime.combine(on_date, time(h, m))


def _resolve_actor_user_id(db: Session, client: Client) -> uuid.UUID:
    if client.user_id:
        return client.user_id
    if client.created_by:
        return client.created_by
    admin = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .order_by(User.created_at.asc())
        .first()
    )
    if admin:
        return admin.id
    raise ValidationException("Unable to resolve portal actor user")


def _get_appliance(db: Session, client_id: uuid.UUID, appliance_id: uuid.UUID) -> ClientAppliance:
    appliance = appliance_svc.get_client_appliance(db, client_id, appliance_id)
    if not appliance.make or not appliance.equipment_type or not appliance.equipment_subtype:
        raise ValidationException(
            "Appliance must have type, subtype, and make before scheduling."
        )
    return appliance


def _service_address(db: Session, appliance: ClientAppliance) -> str:
    address = appliance_svc.service_address_for_appliance(db, appliance)
    if address:
        return address
    raise ValidationException(
        "Appliance must be linked to a property with an address. "
        "Edit the appliance and select a service location."
    )


def _service_location_from_address(address: str) -> dict:
    trimmed = (address or "").strip()
    return {"address": trimmed} if trimmed else {}


def _booking_date_range(settings: dict) -> Tuple[date, date]:
    today = date.today()
    booking = settings.get("booking") or {}
    min_days = int(booking.get("min_days_out", 1))
    max_days = int(booking.get("max_days_out", 21))
    start = today + timedelta(days=min_days)
    end = today + timedelta(days=max_days)
    return start, end


def _enabled_windows(settings: dict) -> List[Tuple[str, dict]]:
    windows = settings.get("scheduling_windows") or {}
    result = []
    for name in ("morning", "afternoon", "evening"):
        cfg = windows.get(name) or {}
        if cfg.get("enabled"):
            result.append((name, cfg))
    return result


def _get_technicians(db: Session, settings: dict) -> List[Technician]:
    auto = settings.get("auto_assign") or {}
    fallback_id = auto.get("fallback_technician_id")
    if fallback_id:
        try:
            fid = uuid.UUID(str(fallback_id))
        except ValueError:
            fid = None
        if fid:
            tech = (
                db.query(Technician)
                .options(joinedload(Technician.user))
                .filter(Technician.id == fid, Technician.status == "active")
                .first()
            )
            if tech:
                return [tech]

    return (
        db.query(Technician)
        .options(joinedload(Technician.user))
        .filter(Technician.status == "active")
        .all()
    )


def _travel_minutes_to_address(property_address: str) -> float:
    shop = get_default_shop_address()
    dest = sanitize_address_for_routing(property_address) or property_address
    minutes, _ = get_travel_time_and_distance(shop, dest)
    return float(minutes) if minutes is not None else 9999.0


def _window_has_capacity(
    db: Session,
    on_date: date,
    window_name: str,
    window_cfg: dict,
    duration_minutes: int,
    technicians: List[Technician],
    *,
    occupancy_cache: Optional[TechnicianOccupancyCache] = None,
) -> bool:
    start = _combine_date_time(on_date, window_cfg.get("start", "08:00"))
    end = _combine_date_time(on_date, window_cfg.get("end", "12:00"))
    slot_step = 60
    current = start

    while current + timedelta(minutes=duration_minutes) <= end:
        slot_end = current + timedelta(minutes=duration_minutes)
        for tech in technicians:
            if slot_is_available(
                db, tech.id, current, slot_end, occupancy_cache=occupancy_cache
            ):
                return True
        current += timedelta(minutes=slot_step)
    return False


def _find_best_slot(
    db: Session,
    on_date: date,
    window_name: str,
    window_cfg: dict,
    duration_minutes: int,
    property_address: str,
    settings: dict,
    *,
    occupancy_cache: Optional[TechnicianOccupancyCache] = None,
    travel_minutes: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    technicians = _get_technicians(db, settings)
    if not technicians:
        return None

    start = _combine_date_time(on_date, window_cfg.get("start", "08:00"))
    end = _combine_date_time(on_date, window_cfg.get("end", "12:00"))
    base_travel = (
        travel_minutes
        if travel_minutes is not None
        else _travel_minutes_to_address(property_address)
    )

    day_cache = occupancy_cache
    if day_cache is None:
        day_cache = TechnicianOccupancyCache.build(
            db,
            [tech.id for tech in technicians],
            datetime.combine(on_date, time.min),
            datetime.combine(on_date, time.max),
        )

    candidates: List[Tuple[float, datetime, datetime, Technician]] = []
    current = start
    while current + timedelta(minutes=duration_minutes) <= end:
        slot_end = current + timedelta(minutes=duration_minutes)
        for tech in technicians:
            if day_cache.slot_is_available(tech.id, current, slot_end):
                candidates.append((base_travel, current, slot_end, tech))
        current += timedelta(minutes=30)

    if not candidates:
        return None

    candidates.sort(key=lambda row: (row[0], row[1]))
    travel, slot_start, slot_end, tech = candidates[0]
    return {
        "scheduled_start": slot_start,
        "scheduled_end": slot_end,
        "technician_id": tech.id,
        "technician_name": tech.name if hasattr(tech, "name") else str(tech.id),
        "time_window": window_name,
        "travel_time_before": int(travel) if travel < 9999 else None,
    }


def _format_window_label(window_cfg: dict) -> str:
    start = window_cfg.get("start", "")
    end = window_cfg.get("end", "")

    def fmt(t):
        h, m = _parse_hhmm(t)
        d = datetime(2000, 1, 1, h, m)
        s = d.strftime("%I:%M %p")
        return s[1:] if s.startswith("0") else s

    return f"{fmt(start)} – {fmt(end)}"


def _narrowing_copy(on_date: date) -> Optional[str]:
    tomorrow = date.today() + timedelta(days=1)
    if on_date == tomorrow:
        return "Your arrival window will be narrowed tonight around 5:30 PM."
    if on_date > tomorrow:
        return "Your arrival window will be narrowed the evening before your appointment."
    return None


def get_open_work_order_for_appliance(
    db: Session, client_id: uuid.UUID, appliance_id: uuid.UUID
) -> Optional[WorkOrder]:
    open_statuses = appliance_svc.OPEN_REPAIR_STATUSES
    try:
        appliance = appliance_svc.get_client_appliance(db, client_id, appliance_id)
    except ValueError:
        return None

    for wo in appliance_svc.work_orders_for_appliance(db, appliance):
        if _enum_value(wo.status) in open_statuses:
            return wo
    return None


def get_scheduling_status(db: Session, client: Client, appliance_id: uuid.UUID) -> dict:
    _assert_can_schedule(db, client)
    appliance = _get_appliance(db, client.id, appliance_id)
    open_wo = get_open_work_order_for_appliance(db, client.id, appliance_id)
    return {
        "can_schedule": open_wo is None,
        "open_work_order_id": str(open_wo.id) if open_wo else None,
        "open_work_order_number": open_wo.order_number if open_wo else None,
        "blocked_message": (
            "You already have an open service request for this appliance."
            if open_wo
            else None
        ),
        "call_us_phone": SCHEDULE_SUPPORT_PHONE,
    }


def _assert_can_schedule(db: Session, client: Client) -> None:
    if not appliance_svc.client_self_scheduling_allowed(client, db):
        raise ValidationException(
            f"Online scheduling is not available for your account. {PORTAL_CALL_MESSAGE}"
        )


def _build_availability_days(
    db: Session,
    *,
    settings: dict,
    technicians: List[Technician],
    duration_minutes: int,
    start_date: date,
    end_date: date,
    occupancy_cache: TechnicianOccupancyCache,
) -> List[dict]:
    days: List[dict] = []
    cursor = start_date
    while cursor <= end_date:
        windows_out = []
        for name, cfg in _enabled_windows(settings):
            available = _window_has_capacity(
                db,
                cursor,
                name,
                cfg,
                duration_minutes,
                technicians,
                occupancy_cache=occupancy_cache,
            )
            windows_out.append({
                "name": name,
                "available": available,
                "display_range": _format_window_label(cfg),
                "narrowing_note": _narrowing_copy(cursor),
            })
        if any(w["available"] for w in windows_out):
            days.append({
                "date": cursor.isoformat(),
                "windows": windows_out,
            })
        cursor += timedelta(days=1)
    return days


def get_schedule_prep(db: Session, client: Client, appliance_id: uuid.UUID) -> dict:
    """Single round-trip: pricing estimate + calendar availability."""
    _assert_can_schedule(db, client)
    settings = get_portal_scheduling_settings(db)
    appliance = _get_appliance(db, client.id, appliance_id)
    address = _service_address(db, appliance)
    estimate = _portal_booking_estimate(db, client, appliance, address)
    estimate["appliance_id"] = str(appliance.id)

    if not estimate.get("serviceable"):
        return {
            "estimate": estimate,
            "availability": {
                "serviceable": False,
                "service_area_message": estimate.get("service_area_message"),
                "days": [],
            },
        }

    duration = int((estimate.get("diagnostic") or {}).get("duration_minutes") or 45)
    technicians = _get_technicians(db, settings)
    start_date, end_date = _booking_date_range(settings)

    occupancy_cache = TechnicianOccupancyCache.build(
        db,
        [tech.id for tech in technicians],
        datetime.combine(start_date, time.min),
        datetime.combine(end_date, time.max),
    )
    days = _build_availability_days(
        db,
        settings=settings,
        technicians=technicians,
        duration_minutes=duration,
        start_date=start_date,
        end_date=end_date,
        occupancy_cache=occupancy_cache,
    )

    return {
        "estimate": estimate,
        "availability": {
            "serviceable": True,
            "duration_minutes": duration,
            "days": days,
        },
    }


def get_availability(db: Session, client: Client, appliance_id: uuid.UUID) -> dict:
    prep = get_schedule_prep(db, client, appliance_id)
    return prep["availability"]


def get_estimate(db: Session, client: Client, appliance_id: uuid.UUID) -> dict:
    return get_schedule_prep(db, client, appliance_id)["estimate"]


async def confirm_schedule(
    db: Session,
    client: Client,
    *,
    appliance_id: uuid.UUID,
    scheduled_date: date,
    time_window: str,
    symptoms: List[str],
    issue_description: Optional[str] = None,
) -> dict:
    _assert_can_schedule(db, client)
    settings = get_portal_scheduling_settings(db)

    if time_window not in ("morning", "afternoon", "evening"):
        raise ValidationException("Invalid time window.")

    start_date, end_date = _booking_date_range(settings)
    if scheduled_date < start_date or scheduled_date > end_date:
        raise ValidationException("Selected date is outside the allowed booking range.")

    appliance = _get_appliance(db, client.id, appliance_id)
    open_wo = get_open_work_order_for_appliance(db, client.id, appliance_id)
    if open_wo:
        raise ValidationException(
            "You already have an open service request for this appliance. "
            "Please contact us or request an update on the existing order."
        )

    address = _service_address(db, appliance)
    booking_key = appliance_to_booking_key(appliance)
    estimate = _portal_booking_estimate(db, client, appliance, address)
    if not estimate.get("serviceable"):
        raise ValidationException(estimate.get("service_area_message") or "Address not serviceable.")

    diagnostic = estimate.get("diagnostic")
    if not diagnostic:
        raise ValidationException("Unable to resolve diagnostic service for this appliance.")

    windows = settings.get("scheduling_windows") or {}
    window_cfg = windows.get(time_window) or {}
    if not window_cfg.get("enabled"):
        raise ValidationException(f"The {time_window} window is not available.")

    duration = int(diagnostic.get("duration_minutes") or 45)
    travel_minutes = None
    if not appliance_svc.client_scheduling_zone_exempt(client):
        travel_minutes = _travel_minutes_to_address(address)
    slot = _find_best_slot(
        db,
        scheduled_date,
        time_window,
        window_cfg,
        duration,
        address,
        settings,
        travel_minutes=travel_minutes,
    )
    if not slot:
        raise ValidationException(
            "That time window is no longer available. Please choose another date or window."
        )

    actor_id = _resolve_actor_user_id(db, client)
    symptom_list = [s for s in (symptoms or []) if s]
    if issue_description and issue_description.strip():
        symptom_list.append(issue_description.strip())

    description_parts = [
        f"Portal self-schedule — {appliance.make or ''} {appliance.equipment_subtype or ''}".strip(),
        f"Window: {time_window} ({_format_window_label(window_cfg)})",
    ]
    if symptom_list:
        description_parts.append("Issues: " + "; ".join(symptom_list))

    service_id = uuid.UUID(diagnostic["service_id"])
    work_order_data = {
        "client_id": client.id,
        "property_id": appliance.property_id,
        "appliance_id": appliance.id,
        "description": ". ".join(description_parts),
        "priority": "medium",
        "service_location": _service_location_from_address(address),
        "equipment_make": appliance.make,
        "equipment_model": appliance.model,
        "equipment_serial": appliance.serial,
        "equipment_version": appliance.equipment_version,
        "equipment_type": appliance.equipment_type,
        "equipment_subtype": appliance.equipment_subtype,
        "is_wall_mounted": appliance.is_wall_mounted,
        "symptoms": symptom_list or None,
        "created_by": actor_id,
        "services": [
            {
                "service_id": service_id,
                "name": diagnostic.get("name"),
                "quantity": 1,
                "unit_price": diagnostic.get("price"),
                "price": diagnostic.get("price"),
            }
        ],
    }

    initial_appointment = InitialAppointmentCreate(
        appointment_type="diagnostic",
        scheduled_start=slot["scheduled_start"],
        assigned_technician_id=slot["technician_id"],
        service_ids=[service_id],
        time_window=time_window,
        travel_time_before=slot.get("travel_time_before"),
    )

    work_order, appointment = await WorkOrderService.create_work_order_with_initial_appointment(
        db, work_order_data, initial_appointment, actor_id
    )

    work_order.appliance_id = appliance.id
    work_order.property_id = appliance.property_id
    db.commit()
    db.refresh(work_order)
    db.refresh(appointment)

    try:
        from app.services.web_push_service import notify_portal_self_schedule

        notify_portal_self_schedule(
            db,
            work_order,
            appointment,
            client,
            time_window=time_window,
            window_display=_format_window_label(window_cfg),
        )
    except Exception as exc:
        logger.warning("Push for portal self-schedule failed: %s", exc)

    return {
        "success": True,
        "work_order_id": str(work_order.id),
        "order_number": work_order.order_number,
        "appointment_id": str(appointment.id),
        "scheduled_start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
        "scheduled_end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
        "time_window": time_window,
        "window_display": _format_window_label(window_cfg),
        "narrowing_note": _narrowing_copy(scheduled_date),
        "estimated_total": estimate.get("estimated_total"),
    }


def request_update_on_appliance(
    db: Session,
    client: Client,
    appliance_id: uuid.UUID,
    message: str,
) -> dict:
    message = (message or "").strip()
    if not message:
        raise ValidationException("Please enter a message.")

    appliance = _get_appliance(db, client.id, appliance_id)
    open_wo = get_open_work_order_for_appliance(db, client.id, appliance_id)
    if not open_wo:
        raise ValidationException("No open service request found for this appliance.")

    actor_id = _resolve_actor_user_id(db, client)
    note = WorkOrderNote(
        work_order_id=open_wo.id,
        user_id=actor_id,
        note=f"[Portal update request] {message}",
        is_private=False,
    )
    db.add(note)
    db.commit()

    try:
        from app.services.web_push_service import notify_portal_update_request

        notify_portal_update_request(db, open_wo, client, message)
    except Exception as exc:
        logger.warning("Push for portal update request failed: %s", exc)

    return {
        "success": True,
        "work_order_id": str(open_wo.id),
        "order_number": open_wo.order_number,
    }
