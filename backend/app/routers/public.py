from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging
import httpx

from app.config import settings
from app.db.database import get_db
from app.models.client import Client
from app.models.property import Property
from app.models.work_order import WorkOrder

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
                    <img src="https://v0-idims.vercel.app/arpano.png" alt="Atomic Repair 419" width="300" height="62" style="display:block;">
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
              <a href="https://v0-idims.vercel.app/work_orders/{work_order_id}" style="display:block;background-color:#f59e0b;color:#0f0f1a;text-decoration:none;text-align:center;padding:15px 24px;border-radius:8px;font-weight:700;font-size:15px;">View and Schedule in IDIMS</a>
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


@router.post("/booking")
async def create_booking(
    booking: BookingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Public endpoint for booking service - no auth required"""

    try:
        name_parts = booking.name.strip().split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        client = db.query(Client).filter(Client.phone == booking.phone).first()

        if not client:
            client = Client(
                first_name=first_name,
                last_name=last_name,
                phone=booking.phone,
                email=booking.email if booking.email else None,
                user_id=None
            )
            db.add(client)
            db.flush()

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

        # Generate sequential OB- number checking ALL prefixes to avoid conflicts
        latest = db.query(WorkOrder).filter(
            WorkOrder.order_number.op('~')(r'^(CT|OB)-[0-9]+$')
        ).order_by(WorkOrder.created_at.desc()).first()

        if latest:
            try:
                next_num = int(latest.order_number.split('-')[1]) + 1
            except (ValueError, IndexError):
                next_num = 1002
        else:
            next_num = 1002

        order_number = f"OB-{next_num:06d}"
        while db.query(WorkOrder).filter(WorkOrder.order_number == order_number).first():
            next_num += 1
            order_number = f"OB-{next_num:06d}"

        work_order = WorkOrder(
            client_id=client.id,
            property_id=prop.id,
            order_number=order_number,
            equipment_type=booking.appliance,
            symptoms=[booking.issue],
            description=f"Online booking - {booking.appliance} issue: {booking.issue}. Service address: {booking.address}. Customer preferred time: {booking.time_preference}.",
            priority="medium",
            status="pending"
        )
        db.add(work_order)
        db.commit()
        db.refresh(work_order)

        background_tasks.add_task(
            send_booking_notification,
            booking.name,
            booking.phone,
            booking.address,
            booking.appliance,
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

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")