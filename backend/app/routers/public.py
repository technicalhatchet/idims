from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

from app.db.database import get_db
from app.models.client import Client
from app.models.property import Property
from app.models.work_order import WorkOrder

router = APIRouter()

class BookingRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: str
    appliance: str
    issue: str
    time_preference: str

@router.post("/booking")
async def create_booking(booking: BookingRequest, db: Session = Depends(get_db)):
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
                user_id=None  # No auth link
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
                property_type="residential"  # default
            )
            db.add(prop)
            db.flush()
        
        # Create work order
        import uuid as uuid_lib
        work_order = WorkOrder(
            client_id=client.id,
            property_id=prop.id,
            order_number=f"OB-{str(uuid_lib.uuid4())[:6].upper()}",
            equipment_type=booking.appliance,
            symptoms=[booking.issue],
            description=f"Online booking - {booking.appliance} issue: {booking.issue}. Service address: {booking.address}. Customer preferred time: {booking.time_preference}.",
            priority="medium",
            status="pending",
            #created_by=client.id  # use client id as placeholder since no auth user
        )
        db.add(work_order)
        db.flush()
        

        # Set placeholder scheduled time based on preference
        tomorrow = datetime.utcnow().replace(hour=14, minute=0, second=0, microsecond=0) + timedelta(days=1)
        if booking.time_preference == 'today':
            placeholder_start = datetime.utcnow().replace(hour=14, minute=0, second=0, microsecond=0)
        elif booking.time_preference == 'tomorrow':
            placeholder_start = tomorrow
        else:
            # this-week or flexible — just set to 2 days out
            placeholder_start = datetime.utcnow().replace(hour=14, minute=0, second=0, microsecond=0) + timedelta(days=2)

        placeholder_end = placeholder_start + timedelta(hours=1)

        # Create appointment with placeholder time
 #       appointment = WorkOrderAppointment(
  #          work_order_id=work_order.id,
   #         appointment_type="diagnostic",
    #        notes=f"Customer requested: {booking.time_preference}. PLACEHOLDER TIME — needs to be confirmed.",
     #       status="scheduled",
     #       scheduled_start=placeholder_start,
     #       scheduled_end=placeholder_end,
     #   )
     #   db.add(appointment)
        
        db.commit()
        
        # Send notification email to Chester
        try:
            msg = MIMEMultipart()
            msg['From'] = settings.MAIL_FROM
            msg['To'] = settings.MAIL_FROM  # email yourself
            msg['Subject'] = f"🔧 New Booking: {booking.appliance} - {booking.name}"
            
            body = f"""
        New booking received from your website!

        Name: {booking.name}
        Phone: {booking.phone}
        Address: {booking.address}
        Appliance: {booking.appliance}
        Issue: {booking.issue}
        Preferred Time: {booking.time_preference}

        Work Order ID: {str(work_order.id)}

        Login to IDIMS to schedule the appointment:
        https://v0-idims.vercel.app/work_orders/{str(work_order.id)}
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            with smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.send_message(msg)
        except Exception as email_err:
            # Don't fail the booking if email fails
            logger.warning(f"Booking notification email failed: {email_err}")
        return {
            "success": True,
            "work_order_id": str(work_order.id),
            "message": "Booking received! We'll contact you shortly to confirm your appointment."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")