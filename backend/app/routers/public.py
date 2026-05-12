from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid as uuid_lib
import logging
import httpx

from app.config import settings
from app.db.database import get_db
from app.models.client import Client
from app.models.property import Property
from app.models.work_order import WorkOrder
from app.services.work_order_service import WorkOrderService

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
                "subject": f"🔧 New Booking: {booking_appliance} - {booking_name}",
                "html": f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }}
    .container {{ max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
    .header {{ background: #1a1a2e; padding: 24px 32px; }}
    .header h1 {{ color: #ffffff; margin: 0; font-size: 22px; }}
    .header p {{ color: #a0a0b0; margin: 4px 0 0; font-size: 14px; }}
    .badge {{ display: inline-block; background: #f59e0b; color: #1a1a2e; font-weight: bold; font-size: 12px; padding: 4px 10px; border-radius: 4px; margin-top: 8px; }}
    .body {{ padding: 32px; }}
    .field {{ margin-bottom: 20px; }}
    .label {{ font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }}
    .value {{ font-size: 16px; color: #1a1a2e; font-weight: 500; }}
    .divider {{ border: none; border-top: 1px solid #eee; margin: 24px 0; }}
    .cta {{ display: block; background: #f59e0b; color: #1a1a2e; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-top: 24px; }}
    .footer {{ background: #f4f4f4; padding: 16px 32px; text-align: center; font-size: 12px; color: #999; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ New Online Booking</h1>
      <p>A customer just submitted a service request</p>
      <span class="badge">Work Order {order_number}</span>
    </div>
    <div class="body">
      <div class="field">
        <div class="label">Customer</div>
        <div class="value">{booking_name}</div>
      </div>
      <div class="field">
        <div class="label">Phone</div>
        <div class="value">{booking_phone}</div>
      </div>
      <div class="field">
        <div class="label">Service Address</div>
        <div class="value">{booking_address}</div>
      </div>
      <hr class="divider">
      <div class="field">
        <div class="label">Appliance</div>
        <div class="value">{booking_appliance}</div>
      </div>
      <div class="field">
        <div class="label">Issue Reported</div>
        <div class="value">{booking_issue}</div>
      </div>
      <div class="field">
        <div class="label">Preferred Time</div>
        <div class="value">{booking_time}</div>
      </div>
      <a href="https://v0-idims.vercel.app/work_orders/{work_order_id}" class="cta">View Work Order in IDIMS →</a>
    </div>
    <div class="footer">Atomic Repair 419 · Toledo, OH · atomicrepair419.com</div>
  </div>
</body>
</html>
"""
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
    """Public endpoint for booking service — no auth required"""

    try:
        # Split name into first/last
        name_parts = booking.name.strip().split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Find or create client by phone
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

        # Find or create property at this address for this client
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

        # Create work order with sequential number, OB- prefix for online bookings
        order_number = await WorkOrderService.get_next_work_order_number(db)
        order_number = order_number.replace("CT-", "OB-")
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

        # Fire notification email in background — won't block the response
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