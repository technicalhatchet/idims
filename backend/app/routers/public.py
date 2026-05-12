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
    work_order_id: str
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
                "text": f"""New booking received from your website!

Name: {booking_name}
Phone: {booking_phone}
Address: {booking_address}
Appliance: {booking_appliance}
Issue: {booking_issue}
Preferred Time: {booking_time}

Work Order: https://v0-idims.vercel.app/work_orders/{work_order_id}
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

        # Create work order with sequential number matching existing work orders
        order_number = await WorkOrderService.get_next_work_order_number(db)
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
            str(work_order.id)
        )

        return {
            "success": True,
            "work_order_id": str(work_order.id),
            "message": "Booking received! We'll contact you shortly to confirm your appointment."
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")