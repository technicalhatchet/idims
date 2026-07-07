"""Same-day / priority portal scheduling requests — approval workflow."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationException
from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.work_order import WorkOrder, WorkOrderNote
from app.schemas.work_order import WorkOrderAppointmentCreate
from app.services import client_appliance_service as appliance_svc
from app.services.notification_service import NotificationService
from app.services.portal_scheduling_helpers import (
    REQUEST_STATUS_APPROVED,
    REQUEST_STATUS_AUTO_DENIED,
    REQUEST_STATUS_DENIED,
    REQUEST_STATUS_PENDING,
    SERVICE_TIER_EMERGENCY,
    SERVICE_TIER_PRIORITY,
    SERVICE_TIER_STANDARD,
    apply_tier_pricing,
    is_priority_request_open,
    is_standard_same_day_open,
    pending_scheduling_request,
    priority_cutoff_time,
    reschedulable_after_denial,
    resolve_service_tier,
    same_day_submission_cutoff,
    shop_today,
)
from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings
from app.services.portal_square_payment_service import charge_portal_booking, get_square_config
from app.services.work_order_service import WorkOrderService

logger = logging.getLogger(__name__)

SCHEDULE_SUPPORT_PHONE = "(419) 515-3394"


def _import_schedule_svc():
    from app.services import portal_schedule_service as svc

    return svc


async def _notify_client_scheduling_decision(
    db: Session,
    client: Client,
    *,
    approved: bool,
    work_order: WorkOrder,
    window_display: str = "",
    reason: str = "",
    settings: dict,
) -> None:
    comms = settings.get("comms") or {}
    order_label = work_order.order_number or str(work_order.id)[:8]

    if approved:
        if not (comms.get("same_day_approval_sms") or comms.get("same_day_approval_email")):
            return
        message = (
            f"Your service request #{order_label} has been approved"
            + (f" for {window_display}." if window_display else ".")
            + " We'll see you soon!"
        )
        subject = "Your service request was approved"
    else:
        if not (comms.get("denial_sms") or comms.get("denial_email")):
            return
        detail = f" Reason: {reason}" if reason else ""
        message = (
            f"We're unable to approve your same-day request #{order_label} at this time.{detail} "
            f"Your service request is still open — log in to the portal to pick another day, "
            f"or call {SCHEDULE_SUPPORT_PHONE} for help."
        )
        subject = "Update on your service request"

    if comms.get("same_day_approval_sms" if approved else "denial_sms") and client.phone:
        try:
            await NotificationService.send_sms(client.phone, message)
        except Exception as exc:
            logger.warning("Scheduling SMS failed: %s", exc)

    if comms.get("same_day_approval_email" if approved else "denial_email") and client.email:
        try:
            await NotificationService.send_email(
                to_email=client.email,
                subject=subject,
                body=message,
            )
        except Exception as exc:
            logger.warning("Scheduling email failed: %s", exc)


async def request_schedule(
    db: Session,
    client: Client,
    *,
    appliance_id: uuid.UUID,
    scheduled_date: date,
    time_window: str,
    symptoms: List[str],
    issue_description: Optional[str] = None,
    priority_requested: bool = False,
    square_source_id: Optional[str] = None,
    payment_idempotency_key: Optional[str] = None,
) -> dict:
    """Create a pending same-day / priority scheduling request (no appointment yet)."""
    svc = _import_schedule_svc()
    svc._assert_can_schedule(db, client)
    settings = get_portal_scheduling_settings(db)
    today = shop_today()

    if scheduled_date != today:
        raise ValidationException(
            "Approval requests are only for same-day service. "
            "Choose tomorrow or later for instant booking."
        )

    if time_window not in ("morning", "afternoon", "evening"):
        raise ValidationException("Invalid time window.")

    tier = resolve_service_tier(
        settings,
        scheduled_date=scheduled_date,
        priority_requested=priority_requested,
    )

    if tier == SERVICE_TIER_STANDARD and not is_standard_same_day_open(settings):
        if is_priority_request_open(settings):
            raise ValidationException(
                "Standard same-day scheduling has closed. "
                "Request priority service or schedule for tomorrow."
            )
        raise ValidationException(
            f"Same-day scheduling is closed. Please call {SCHEDULE_SUPPORT_PHONE}."
        )

    if tier in (SERVICE_TIER_PRIORITY, SERVICE_TIER_EMERGENCY) and not is_priority_request_open(settings):
        raise ValidationException(
            f"Priority service requests are closed for today. Please call {SCHEDULE_SUPPORT_PHONE}."
        )

    appliance = svc._get_appliance(db, client.id, appliance_id)
    open_wo = svc.get_open_work_order_for_appliance(db, client.id, appliance_id)
    if open_wo:
        if not reschedulable_after_denial(open_wo.portal_scheduling_meta):
            raise ValidationException(
                "You already have an open service request for this appliance."
            )

    address = svc._service_address(db, appliance)
    estimate = svc._portal_booking_estimate(db, client, appliance, address)
    if not estimate.get("serviceable"):
        raise ValidationException(estimate.get("service_area_message") or "Address not serviceable.")

    estimate = apply_tier_pricing(estimate, tier, settings)
    diagnostic = estimate.get("diagnostic")
    if not diagnostic:
        raise ValidationException("Unable to resolve diagnostic service for this appliance.")

    windows = settings.get("scheduling_windows") or {}
    window_cfg = windows.get(time_window) or {}
    if not window_cfg.get("enabled"):
        raise ValidationException(f"The {time_window} window is not available.")

    payment_meta = None
    square_cfg = get_square_config(db)
    if square_cfg["requires_payment"]:
        amount = estimate.get("estimated_total")
        if amount is None:
            raise ValidationException("Unable to determine payment amount.")
        payment_meta = await charge_portal_booking(
            db,
            amount=float(amount),
            source_id=square_source_id or "",
            idempotency_key=payment_idempotency_key,
        )

    actor_id = svc._resolve_actor_user_id(db, client)
    symptom_list = svc._symptom_list(symptoms, issue_description)
    tier_label = estimate.get("tier_label") or tier

    description_parts = [
        f"Portal scheduling request ({tier_label}) — {appliance.make or ''} {appliance.equipment_subtype or ''}".strip(),
        f"Requested window: {time_window} ({svc._format_window_label(window_cfg)})",
    ]
    if symptom_list:
        description_parts.append("Issues: " + "; ".join(symptom_list))

    service_id = uuid.UUID(diagnostic["service_id"])
    work_order_data = {
        "client_id": client.id,
        "property_id": appliance.property_id,
        "appliance_id": appliance.id,
        "description": ". ".join(description_parts),
        "priority": "high" if tier != SERVICE_TIER_STANDARD else "medium",
        "service_location": svc._service_location_from_address(address),
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

    if open_wo and reschedulable_after_denial(open_wo.portal_scheduling_meta):
        work_order = open_wo
        work_order.description = ". ".join(description_parts)
        work_order.priority = "high" if tier != SERVICE_TIER_STANDARD else "medium"
        work_order.service_tier = tier
        prior_meta = work_order.portal_scheduling_meta or {}
        work_order.portal_scheduling_meta = {
            "type": "scheduling_request",
            "status": REQUEST_STATUS_PENDING,
            "requested_date": scheduled_date.isoformat(),
            "time_window": time_window,
            "service_tier": tier,
            "estimated_total": estimate.get("estimated_total"),
            "pricing_snapshot": estimate,
            "payment": payment_meta or prior_meta.get("payment"),
            "requested_at": datetime.utcnow().isoformat(),
            "previous_denial": {
                "status": prior_meta.get("status"),
                "denied_at": prior_meta.get("denied_at"),
                "denial_reason": prior_meta.get("denial_reason"),
            },
        }
        db.commit()
        db.refresh(work_order)
    else:
        work_order = await WorkOrderService.create_work_order(db, work_order_data)
        work_order.appliance_id = appliance.id
        work_order.property_id = appliance.property_id
        work_order.service_tier = tier
        work_order.portal_scheduling_meta = {
            "type": "scheduling_request",
            "status": REQUEST_STATUS_PENDING,
            "requested_date": scheduled_date.isoformat(),
            "time_window": time_window,
            "service_tier": tier,
            "estimated_total": estimate.get("estimated_total"),
            "pricing_snapshot": estimate,
            "payment": payment_meta,
            "requested_at": datetime.utcnow().isoformat(),
        }
        db.commit()
        db.refresh(work_order)

    try:
        from app.services.web_push_service import notify_portal_scheduling_request

        delivered = notify_portal_scheduling_request(db, work_order, client, time_window=time_window)
        if delivered == 0:
            from app.services.web_push_service import notify_pending_work_order

            notify_pending_work_order(db, work_order)
    except Exception as exc:
        logger.warning("Push for scheduling request failed: %s", exc)

    return {
        "success": True,
        "pending_approval": True,
        "work_order_id": str(work_order.id),
        "order_number": work_order.order_number,
        "service_tier": tier,
        "tier_label": tier_label,
        "estimated_total": estimate.get("estimated_total"),
        "message": (
            "Your request was submitted. We'll confirm as soon as possible. "
            f"If you don't hear back before shop close, please call {SCHEDULE_SUPPORT_PHONE}."
        ),
    }


async def approve_schedule_request(
    db: Session,
    work_order: WorkOrder,
    *,
    actor_id: uuid.UUID,
    staff_note: Optional[str] = None,
) -> dict:
    """Approve a pending portal scheduling request and create the appointment."""
    meta = work_order.portal_scheduling_meta or {}
    if not pending_scheduling_request(meta):
        raise ValidationException("This work order is not awaiting scheduling approval.")

    svc = _import_schedule_svc()
    settings = get_portal_scheduling_settings(db)
    client = work_order.client
    if not client:
        raise ValidationException("Work order has no client.")

    scheduled_date = date.fromisoformat(meta["requested_date"])
    time_window = meta.get("time_window") or "morning"
    windows = settings.get("scheduling_windows") or {}
    window_cfg = windows.get(time_window) or {}

    appliance = None
    if work_order.appliance_id:
        try:
            appliance = appliance_svc.get_client_appliance(
                db, work_order.client_id, work_order.appliance_id
            )
        except ValueError:
            appliance = None

    address = ""
    if appliance:
        address = svc._service_address(db, appliance)
    elif work_order.service_location:
        address = (work_order.service_location or {}).get("address") or ""

    pricing = meta.get("pricing_snapshot") or {}
    diagnostic = pricing.get("diagnostic") or {}
    duration = int(diagnostic.get("duration_minutes") or 45)
    travel_minutes = None
    if appliance and not appliance_svc.client_scheduling_zone_exempt(client):
        travel_minutes = svc._travel_minutes_to_address(address)

    slot = svc._find_best_slot(
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
            "No slot available for the requested window. Choose another window or deny the request."
        )

    service_id = uuid.UUID(diagnostic["service_id"]) if diagnostic.get("service_id") else None
    if not service_id and work_order.service_items:
        service_id = work_order.service_items[0].service_id

    initial_appointment = WorkOrderAppointmentCreate(
        work_order_id=work_order.id,
        appointment_type="diagnostic",
        scheduled_start=slot["scheduled_start"],
        assigned_technician_id=slot["technician_id"],
        service_ids=[service_id] if service_id else [],
        time_window=time_window,
        travel_time_before=slot.get("travel_time_before"),
    )

    wo_svc = WorkOrderService(db)
    appointment = await wo_svc.create_work_order_appointment(
        initial_appointment,
        actor_id,
    )

    work_order.status = "scheduled"
    work_order.assigned_technician_id = slot["technician_id"]
    work_order.portal_scheduling_meta = {
        **meta,
        "status": REQUEST_STATUS_APPROVED,
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": str(actor_id),
    }
    if staff_note:
        db.add(
            WorkOrderNote(
                work_order_id=work_order.id,
                user_id=actor_id,
                note=f"[Scheduling approved] {staff_note.strip()}",
                is_private=True,
            )
        )

    db.commit()
    db.refresh(work_order)
    db.refresh(appointment)

    window_display = svc._format_window_label(window_cfg)
    await _notify_client_scheduling_decision(
        db,
        client,
        approved=True,
        work_order=work_order,
        window_display=window_display,
        settings=settings,
    )

    return {
        "success": True,
        "work_order_id": str(work_order.id),
        "appointment_id": str(appointment.id),
        "scheduled_start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
        "window_display": window_display,
    }


async def deny_schedule_request(
    db: Session,
    work_order: WorkOrder,
    *,
    actor_id: uuid.UUID,
    reason: Optional[str] = None,
    auto: bool = False,
) -> dict:
    meta = work_order.portal_scheduling_meta or {}
    if not pending_scheduling_request(meta):
        raise ValidationException("This work order is not awaiting scheduling approval.")

    settings = get_portal_scheduling_settings(db)
    client = work_order.client
    status = REQUEST_STATUS_AUTO_DENIED if auto else REQUEST_STATUS_DENIED

    work_order.portal_scheduling_meta = {
        **meta,
        "status": status,
        "denied_at": datetime.utcnow().isoformat(),
        "denial_reason": (reason or "").strip() or None,
    }
    if reason and not auto:
        db.add(
            WorkOrderNote(
                work_order_id=work_order.id,
                user_id=actor_id,
                note=f"[Scheduling denied] {reason.strip()}",
                is_private=True,
            )
        )

    db.commit()
    db.refresh(work_order)

    if client:
        await _notify_client_scheduling_decision(
            db,
            client,
            approved=False,
            work_order=work_order,
            reason=reason or "",
            settings=settings,
        )

    return {"success": True, "work_order_id": str(work_order.id), "status": status}


def process_scheduling_deadlines(db: Session) -> int:
    """Auto-deny stale pending scheduling requests. Returns count processed."""
    from app.services.portal_scheduling_helpers import shop_now
    from app.models.user import User

    settings = get_portal_scheduling_settings(db)
    now = shop_now()
    today = now.date()

    pending = (
        db.query(WorkOrder)
        .filter(
            WorkOrder.status == "pending",
            WorkOrder.portal_scheduling_meta.isnot(None),
        )
        .all()
    )

    admin = (
        db.query(User)
        .filter(User.is_active.is_(True), User.is_admin.is_(True))
        .order_by(User.created_at.asc())
        .first()
    )
    actor_id = admin.id if admin else None

    processed = 0
    for wo in pending:
        meta = wo.portal_scheduling_meta or {}
        if not pending_scheduling_request(meta):
            continue

        tier = meta.get("service_tier") or SERVICE_TIER_STANDARD
        requested_date_str = meta.get("requested_date")
        if not requested_date_str:
            continue
        requested_date = date.fromisoformat(requested_date_str)
        if requested_date != today:
            continue

        deadline = (
            priority_cutoff_time(settings, today)
            if tier in (SERVICE_TIER_PRIORITY, SERVICE_TIER_EMERGENCY)
            else same_day_submission_cutoff(settings, today)
        )

        if now < deadline:
            continue

        if not actor_id:
            logger.warning("Cannot auto-deny WO %s — no admin user", wo.id)
            continue

        try:
            asyncio.run(
                deny_schedule_request(
                    db,
                    wo,
                    actor_id=actor_id,
                    reason="We were unable to confirm your request before the cutoff.",
                    auto=True,
                )
            )
            processed += 1
        except Exception as exc:
            logger.warning("Auto-deny failed for WO %s: %s", wo.id, exc)
            db.rollback()

    return processed
