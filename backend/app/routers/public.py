from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import logging
import httpx

from app.config import settings
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

logger = logging.getLogger(__name__)

router = APIRouter()


class BookingRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: str
    appliance: str
    issue: str
    time_preference: str
    equipment_subtype: Optional[str] = None
    custom_appliance: Optional[str] = None


class BookingEstimateRequest(BaseModel):
    appliance: str = Field(..., description="Booking flow appliance id (e.g. washer, refrigerator)")
    address: str = Field(..., min_length=5)
    custom_appliance: Optional[str] = None
    equipment_subtype: Optional[str] = None


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


def _booking_address_to_location(address: str) -> dict:
    """Normalize a single-line booking address for JSONB service/client fields."""
    trimmed = (address or "").strip()
    return {"address": trimmed} if trimmed else {}


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
    booking_address: str,
    booking_appliance: str,
    booking_issue: str,
    booking_time: str,
    work_order_id: str,
    order_number: str
):
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
                    <img src="{settings.LOGO_URL}" alt="Atomic Repair 419" width="300" height="62" style="display:block;">
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
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{booking_name}</div>
                  </td>
                  <td width="50%" style="padding-bottom:20px;vertical-align:top;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Phone</div>
                    <div style="color:#f59e0b;font-size:15px;font-weight:600;">{booking_phone}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom:20px;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Service Address</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{booking_address}</div>
                  </td>
                </tr>
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
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{booking_appliance}</div>
                  </td>
                  <td width="50%" style="padding-bottom:20px;vertical-align:top;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Preferred Time</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:500;">{booking_time}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom:24px;">
                    <div style="color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Issue Reported</div>
                    <div style="background-color:#0f0f1a;border:1px solid #2d2d4e;border-radius:8px;padding:14px 16px;color:#e5e7eb;font-size:14px;line-height:1.5;">{booking_issue}</div>
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

        client = db.query(Client).filter(Client.phone == booking.phone).first()

        service_location = _booking_address_to_location(booking.address)

        if not client:
            client = Client(
                first_name=first_name,
                last_name=last_name,
                phone=booking.phone,
                email=booking.email if booking.email else None,
                address=service_location or None,
                user_id=None
            )
            db.add(client)
            db.flush()
        elif service_location and not client.address:
            client.address = service_location

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

        work_order = WorkOrder(
            client_id=client.id,
            property_id=prop.id,
            order_number=order_number,
            equipment_type=equipment["equipment_type"],
            equipment_subtype=equipment["equipment_subtype"],
            symptoms=[booking.issue],
            description=(
                f"Online booking - {display_label} issue: {booking.issue}. "
                f"Service address: {booking.address}. "
                f"Customer preferred time: {booking.time_preference}."
            ),
            priority="medium",
            status="pending",
            service_location=service_location or None,
        )
        get_tax_service(db).apply_tax_rate_to_work_order(work_order, address=address)
        db.add(work_order)
        db.commit()
        db.refresh(work_order)

        background_tasks.add_task(_push_pending_work_order, str(work_order.id))

        background_tasks.add_task(
            send_booking_notification,
            booking.name,
            booking.phone,
            booking.address,
            display_label,
            booking.issue,
            booking.time_preference,
            str(work_order.id),
            order_number
        )

        return {
            "success": True,
            "work_order_id": str(work_order.id),
            "message": "Booking received! We'll contact you shortly to confirm your appointment."
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")