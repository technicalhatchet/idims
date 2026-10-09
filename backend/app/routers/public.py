from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import datetime
import logging
import httpx
import re
import html

from app.config import resolve_email_logo_url, settings
from app.services.public_booking_emails import send_booking_received_email
from app.db.database import get_db
from app.models.client import Client
from app.models.property import Property
from app.models.work_order import WorkOrder
from app.services.tax_service import get_tax_service
from app.services.work_order_service import WorkOrderService
from app.services.diagnostic_booking_service import (
    build_booking_estimate,
    lookup_diagnostic_service,
    resolve_booking_equipment_fields,
    estimate_trip_charge,
    is_address_serviceable,
    OUT_OF_SERVICE_AREA_MESSAGE,
)
from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings
from app.services.portal_scheduling_helpers import (
    apply_tier_pricing,
    resolve_service_tier,
    scheduling_context,
    shop_today,
)

logger = logging.getLogger(__name__)

router = APIRouter()

ContactChannel = Literal["phone", "email", "sms"]


class BookingRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: str
    appliance: str
    issue: str
    time_preference: str
    equipment_subtype: Optional[str] = None
    custom_appliance: Optional[str] = None
    priority_requested: bool = False
    contact_preference_primary: ContactChannel
    contact_preference_backup: Optional[ContactChannel] = None
    communications_consent: bool = False

    @model_validator(mode="after")
    def validate_contact_and_consent(self):
        phone = (self.phone or "").strip()
        email = (self.email or "").strip()
        if not phone and not email:
            raise ValueError("Phone or email is required")
        if not self.communications_consent:
            raise ValueError("Appointment communications consent is required")
        if self.contact_preference_backup and self.contact_preference_backup == self.contact_preference_primary:
            raise ValueError("Backup contact method must differ from primary")

        def channel_available(channel: str) -> bool:
            if channel == "email":
                return bool(email)
            return bool(phone)

        if not channel_available(self.contact_preference_primary):
            raise ValueError(f"Primary contact method ({self.contact_preference_primary}) requires the matching contact info")
        if self.contact_preference_backup and not channel_available(self.contact_preference_backup):
            raise ValueError(
                f"Backup contact method ({self.contact_preference_backup}) requires the matching contact info"
            )
        return self


class BookingEstimateRequest(BaseModel):
    appliance: str = Field(..., description="Booking flow appliance id (e.g. washer, refrigerator)")
    address: str = Field(..., min_length=5)
    custom_appliance: Optional[str] = None
    equipment_subtype: Optional[str] = None
    time_preference: Optional[str] = None
    priority_requested: bool = False


def _lookup_diagnostic_service(db: Session, appliance: str, equipment_subtype: Optional[str] = None):
    """Thin wrapper for tests and legacy imports."""
    return lookup_diagnostic_service(db, appliance, equipment_subtype)


class DiagnosticEstimate(BaseModel):
    name: str
    price: float
    sku_code: Optional[str] = None


class TripChargeEstimate(BaseModel):
    zone_key: str
    zone_name: str
    amount: Optional[float]
    is_custom: bool
    method: str


class BookingEstimateResponse(BaseModel):
    diagnostic: Optional[DiagnosticEstimate] = None
    trip_charge: TripChargeEstimate
    estimated_total: Optional[float] = None
    note: Optional[str] = None
    serviceable: bool = True
    service_area_message: Optional[str] = None
    service_tier: Optional[str] = None
    tier_label: Optional[str] = None


def _booking_address_to_location(address: str) -> dict:
    """Normalize a single-line booking address for JSONB service/client fields."""
    trimmed = (address or "").strip()
    return {"address": trimmed} if trimmed else {}


def _normalize_phone(phone: Optional[str]) -> Optional[str]:
    trimmed = (phone or "").strip()
    return trimmed or None


def _normalize_email(email: Optional[str]) -> Optional[str]:
    trimmed = (email or "").strip().lower()
    return trimmed or None


def _placeholder_email_for_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")[-10:] or "unknown"
    return f"bookings+{digits}@noreply.atomicrepair419.com"


def _apply_public_booking_tier_pricing(
    db: Session,
    result: dict,
    *,
    time_preference: Optional[str],
    priority_requested: bool,
) -> dict:
    if (time_preference or "").strip().lower() != "today" or not priority_requested:
        return result
    settings = get_portal_scheduling_settings(db)
    priority_cfg = settings.get("priority_service") or {}
    if not priority_cfg.get("enabled", True):
        return result
    tier = resolve_service_tier(
        settings,
        scheduled_date=shop_today(),
        priority_requested=True,
    )
    if tier == "standard":
        return result
    return apply_tier_pricing(result, tier, settings)


def _merge_client_custom_fields(client: Client, patch: dict) -> None:
    existing = client.custom_fields if isinstance(client.custom_fields, dict) else {}
    client.custom_fields = {**existing, **patch}


def _push_pending_work_order(work_order_id: str) -> None:
    """Background task: notify staff via web push for a new pending work order."""
    import uuid as uuid_mod

    from app.db.database import SessionLocal
    from app.services.web_push_service import notify_pending_work_order

    db = SessionLocal()
    try:
        wo = (
            db.query(WorkOrder)
            .filter(WorkOrder.id == uuid_mod.UUID(work_order_id))
            .first()
        )
        if wo:
            notify_pending_work_order(db, wo)
    except Exception as exc:
        logger.warning("Push for pending work order %s failed: %s", work_order_id, exc)
    finally:
        db.close()


def send_booking_notification(
    booking_name: str,
    booking_phone: str,
    booking_email: str,
    booking_address: str,
    booking_appliance: str,
    booking_issue: str,
    booking_time: str,
    work_order_id: str,
    order_number: str,
    *,
    priority_requested: bool = False,
    contact_primary: str = "",
    contact_backup: str = "",
):
    phone_display = booking_phone or "—"
    email_display = booking_email or "—"
    priority_line = (
        "<tr><td colspan=\"2\" style=\"padding-bottom:16px;\">"
        "<span style=\"background-color:#7c2d12;color:#fdba74;font-size:12px;font-weight:700;"
        "padding:6px 12px;border-radius:6px;\">PRIORITY SAME-DAY DIAGNOSTIC REQUESTED</span>"
        "</td></tr>"
        if priority_requested
        else ""
    )
    backup_bit = ""
    if contact_backup:
        backup_bit = (
            " · backup: <strong style=\"color:#e5e7eb;\">"
            f"{html.escape(contact_backup)}</strong>"
        )
    comms_line = (
        "<tr><td colspan=\"2\" style=\"padding-bottom:12px;color:#9ca3af;font-size:13px;\">"
        "Contact preference: <strong style=\"color:#e5e7eb;\">"
        f"{html.escape(contact_primary)}</strong>{backup_bit}"
        "</td></tr>"
    )
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "from": "Atomic Repair Bookings <booking@atomicrepair419.com>",
                "to": "service@atomicrepair419.com",
                "subject": f"New Booking: {booking_appliance} - {booking_name}",
                "html": f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Booking - Atomic Repair 419</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f1a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid #2d2d4e;">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px;border-bottom:1px solid #2d2d4e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="{resolve_email_logo_url()}" alt="Atomic Repair 419" width="300" height="62" style="display:block;border:0;">
                  </td>
                  <td align="right">
                    <span style="background-color:#f59e0b;color:#0f0f1a;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;letter-spacing:0.5px;">ONLINE BOOKING</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#16213e;padding:16px 32px;border-bottom:1px solid #2d2d4e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Work Order</span>
                    <div style="color:#f59e0b;font-size:22px;font-weight:700;margin-top:2px;">{order_number}</div>
                  </td>
                  <td align="right">
                    <span style="background-color:#0f0f1a;color:#10b981;font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;border:1px solid #10b981;">Pending Scheduling</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;">
              <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Customer Information</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-bottom:20px;vertical-align:top;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Name</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{html.escape(booking_name)}</div>
                  </td>
                  <td width="50%" style="padding-bottom:20px;vertical-align:top;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Phone</div>
                    <div style="color:#f59e0b;font-size:15px;font-weight:600;">{html.escape(phone_display)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom:20px;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Email</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{html.escape(email_display)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom:20px;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Service Address</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{html.escape(booking_address)}</div>
                  </td>
                </tr>
                {comms_line}
                {priority_line}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid #2d2d4e;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Job Details</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-bottom:20px;vertical-align:top;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Appliance</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{html.escape(booking_appliance)}</div>
                  </td>
                  <td width="50%" style="padding-bottom:20px;vertical-align:top;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Preferred Time</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{html.escape(booking_time)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom:24px;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Issue Reported</div>
                    <div style="background-color:#0f0f1a;border:1px solid #2d2d4e;border-radius:8px;padding:14px 16px;color:#e5e7eb;font-size:14px;line-height:1.5;">{html.escape(booking_issue)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="{settings.FRONTEND_URL.rstrip('/')}/work_orders/{work_order_id}" style="display:block;background-color:#f59e0b;color:#0f0f1a;text-decoration:none;text-align:center;padding:15px 24px;border-radius:8px;font-weight:700;font-size:15px;">View and Schedule in IDIMS</a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0f0f1a;padding:20px 32px;border-top:1px solid #2d2d4e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color:#6b7280;font-size:12px;">Atomic Repair - Toledo, OH - 419 Area</div>
                    <div style="color:#4b5563;font-size:11px;margin-top:4px;">atomicrepair419.com</div>
                  </td>
                  <td align="right">
                    <div style="color:#4b5563;font-size:11px;">Internal notification</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
            }
        )
        logger.info(f"Booking notification sent: {response.status_code}")
    except Exception as e:
        logger.warning(f"Booking notification email failed: {e}")


def _maybe_send_booking_sms(
    phone: Optional[str],
    order_number: str,
    contact_primary: str,
    contact_backup: Optional[str],
) -> None:
    if not phone or not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN):
        return
    wants_sms = contact_primary == "sms" or contact_backup == "sms"
    if not wants_sms:
        return
    import asyncio

    from app.services.notification_service import NotificationService

    message = (
        f"Atomic Repair: We received your service request #{order_number}. "
        "We'll contact you soon to confirm your appointment."
    )

    async def _send() -> None:
        await NotificationService.send_sms(phone, message)

    try:
        asyncio.run(_send())
    except Exception as exc:
        logger.warning("Booking SMS failed (Twilio may be unconfigured): %s", exc)


@router.get("/booking/scheduling-context")
async def public_booking_scheduling_context(db: Session = Depends(get_db)):
    settings = get_portal_scheduling_settings(db)
    priority_cfg = settings.get("priority_service") or {}
    return {
        "priority_service_enabled": bool(priority_cfg.get("enabled", True)),
        "scheduling_context": scheduling_context(settings),
    }


@router.post("/booking/estimate", response_model=BookingEstimateResponse)
async def estimate_booking_pricing(
    request: BookingEstimateRequest,
    db: Session = Depends(get_db),
):
    """
    Public upfront pricing for the booking confirmation step.
    Returns diagnostic fee for the selected appliance and trip charge for the address.
    """
    address = (request.address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")

    subtype = (request.equipment_subtype or "").strip().lower() or None
    result = build_booking_estimate(
        db,
        request.appliance,
        address,
        equipment_subtype=subtype,
    )
    result = _apply_public_booking_tier_pricing(
        db,
        result,
        time_preference=request.time_preference,
        priority_requested=request.priority_requested,
    )

    diagnostic = None
    if result.get("diagnostic"):
        d = result["diagnostic"]
        diagnostic = DiagnosticEstimate(
            name=d["name"],
            price=d["price"],
            sku_code=d.get("sku_code"),
        )

    trip_charge = TripChargeEstimate(**result["trip_charge"])

    return BookingEstimateResponse(
        diagnostic=diagnostic,
        trip_charge=trip_charge,
        estimated_total=result.get("estimated_total"),
        note=result.get("note"),
        serviceable=result.get("serviceable", True),
        service_area_message=result.get("service_area_message"),
        service_tier=result.get("service_tier"),
        tier_label=result.get("tier_label"),
    )


@router.post("/booking")
async def create_booking(
    booking: BookingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Public endpoint for booking service - no auth required"""

    try:
        address = (booking.address or "").strip()
        if not address:
            raise HTTPException(status_code=400, detail="Service address is required")

        phone = _normalize_phone(booking.phone)
        email = _normalize_email(booking.email)

        trip = estimate_trip_charge(db, address)
        if not is_address_serviceable(trip):
            raise HTTPException(status_code=403, detail=OUT_OF_SERVICE_AREA_MESSAGE)

        equipment = resolve_booking_equipment_fields(
            booking.appliance,
            equipment_subtype=booking.equipment_subtype,
            custom_appliance=booking.custom_appliance,
        )
        display_label = equipment["display_label"]

        name_parts = booking.name.strip().split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        client = None
        if phone:
            client = db.query(Client).filter(Client.phone == phone).first()
        if not client and email:
            client = db.query(Client).filter(Client.email == email).first()

        service_location = _booking_address_to_location(booking.address)
        client_email = email or _placeholder_email_for_phone(phone or "unknown")

        comm_prefs = {
            "appointment_contact_primary": booking.contact_preference_primary,
            "appointment_contact_backup": booking.contact_preference_backup,
            "appointment_comms_consent_at": datetime.utcnow().isoformat() + "Z",
        }

        if not client:
            client = Client(
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                email=client_email,
                address=service_location or None,
                user_id=None,
                custom_fields=comm_prefs,
            )
            db.add(client)
            db.flush()
        else:
            client.first_name = first_name
            if last_name:
                client.last_name = last_name
            if phone:
                client.phone = phone
            if email and (not client.email or "@noreply.atomicrepair419.com" in client.email):
                client.email = email
            elif email:
                client.email = email
            if service_location and not client.address:
                client.address = service_location
            _merge_client_custom_fields(client, comm_prefs)

        prop = db.query(Property).filter(
            Property.client_id == client.id,
            Property.address == booking.address
        ).first()

        if not prop:
            prop = Property(
                client_id=client.id,
                address=booking.address,
                property_type="residential"
            )
            db.add(prop)
            db.flush()

        order_number = await WorkOrderService.get_next_work_order_number(db, prefix="OB")

        time_pref = (booking.time_preference or "").strip()
        priority_flag = bool(booking.priority_requested and time_pref.lower() == "today")
        wo_priority = "high" if priority_flag else "medium"

        time_display = time_pref
        if priority_flag:
            time_display = f"{time_pref} (priority service requested)"

        description_parts = [
            f"Online booking - {display_label} issue: {booking.issue}.",
            f"Service address: {booking.address}.",
            f"Customer preferred time: {time_display}.",
            f"Contact: primary {booking.contact_preference_primary}"
            + (f", backup {booking.contact_preference_backup}" if booking.contact_preference_backup else "")
            + ".",
        ]
        if priority_flag:
            description_parts.append(
                "Customer requested priority same-day diagnostic (portal-tier pricing on estimate)."
            )

        estimate_snapshot = build_booking_estimate(
            db,
            booking.appliance,
            address,
            equipment_subtype=(booking.equipment_subtype or "").strip().lower() or None,
        )
        if priority_flag:
            estimate_snapshot = _apply_public_booking_tier_pricing(
                db,
                estimate_snapshot,
                time_preference=time_pref,
                priority_requested=True,
            )

        work_order = WorkOrder(
            client_id=client.id,
            property_id=prop.id,
            order_number=order_number,
            equipment_type=equipment["equipment_type"],
            equipment_subtype=equipment["equipment_subtype"],
            symptoms=[booking.issue],
            description=" ".join(description_parts),
            priority=wo_priority,
            status="pending",
            service_location=service_location or None,
            portal_scheduling_meta={
                "type": "public_booking_request",
                "time_preference": time_pref,
                "priority_requested": priority_flag,
                "pricing_snapshot": estimate_snapshot,
            },
        )
        get_tax_service(db).apply_tax_rate_to_work_order(work_order, address=address)
        db.add(work_order)
        db.commit()
        db.refresh(work_order)

        background_tasks.add_task(_push_pending_work_order, str(work_order.id))

        customer_email_for_send = email or (
            client_email if "@noreply.atomicrepair419.com" not in client_email else None
        )

        background_tasks.add_task(
            send_booking_notification,
            booking.name,
            phone or "",
            email or "",
            booking.address,
            display_label,
            booking.issue,
            time_display,
            str(work_order.id),
            order_number,
            priority_requested=priority_flag,
            contact_primary=booking.contact_preference_primary,
            contact_backup=booking.contact_preference_backup or "",
        )

        if customer_email_for_send:
            background_tasks.add_task(
                send_booking_received_email,
                customer_email=customer_email_for_send,
                booking_name=booking.name,
                order_number=order_number,
                booking_appliance=display_label,
                booking_time=time_display,
                estimated_total=estimate_snapshot.get("estimated_total"),
            )

        if phone:
            background_tasks.add_task(
                _maybe_send_booking_sms,
                phone,
                order_number,
                booking.contact_preference_primary,
                booking.contact_preference_backup,
            )

        return {
            "success": True,
            "work_order_id": str(work_order.id),
            "order_number": order_number,
            "message": "Booking received! We'll contact you shortly to confirm your appointment."
        }

    except HTTPException:
        db.rollback()
        raise
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")
