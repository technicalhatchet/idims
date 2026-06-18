"""
Client Portal API Router
All endpoints are scoped to the authenticated client only.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging
import os
import jwt

from app.db.database import get_db
from app.core.auth import get_auth_handler
from app.models.client import Client
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.models.property import Property

logger = logging.getLogger(__name__)

security = HTTPBearer()

router = APIRouter(tags=["client-portal"])

WARRANTY_DAYS = 90
WARRANTY_ELIGIBLE_STATUSES = frozenset({
    "completed",
    "closed",
    "completed_pending_payment",
})


def _enum_value(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def _as_utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def _work_order_status(wo: WorkOrder) -> str:
    return _enum_value(wo.status)


def _warranty_service_date(wo: WorkOrder, db: Session) -> Optional[datetime]:
    """Best-effort service completion date for labor warranty."""
    if wo.actual_end:
        return _as_utc_naive(wo.actual_end)
    closed_at = getattr(wo, "closed_at", None)
    if closed_at:
        return _as_utc_naive(closed_at)
    latest_completed = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == wo.id,
            WorkOrderAppointment.status == "completed",
        )
        .order_by(desc(WorkOrderAppointment.scheduled_start))
        .first()
    )
    if latest_completed and latest_completed.scheduled_start:
        return _as_utc_naive(latest_completed.scheduled_start)
    if _work_order_status(wo) in WARRANTY_ELIGIBLE_STATUSES and wo.created_at:
        return _as_utc_naive(wo.created_at)
    return None


def _warranty_expires_at(wo: WorkOrder, db: Session) -> Optional[datetime]:
    if _work_order_status(wo) not in WARRANTY_ELIGIBLE_STATUSES:
        return None
    service_date = _warranty_service_date(wo, db)
    if not service_date:
        return None
    return service_date + timedelta(days=WARRANTY_DAYS)


def _warranty_is_active(wo: WorkOrder, db: Session, now: Optional[datetime] = None) -> bool:
    expiry = _warranty_expires_at(wo, db)
    if not expiry:
        return False
    now = _as_utc_naive(now or datetime.utcnow())
    return expiry > now


class LinkAccountRequest(BaseModel):
    invite_token: Optional[str] = None
    email: Optional[str] = None


async def get_token_data(credentials: HTTPAuthorizationCredentials = Depends(security)):
    auth_handler = get_auth_handler()
    return await auth_handler.verify_token(credentials.credentials)


async def get_portal_client(
    token_data=Depends(get_token_data),
    db: Session = Depends(get_db),
    admin_client_id: Optional[str] = Query(None),
) -> Client:
    roles = getattr(token_data, 'roles', []) or []
    is_admin = 'admin' in roles
    is_client = 'client' in roles

    # Admin impersonating a client
    if is_admin and admin_client_id:
        client = db.query(Client).filter(Client.id == admin_client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return client

    # Admin with no client selected — can't use portal endpoints directly
    if is_admin and not admin_client_id:
        raise HTTPException(
            status_code=400,
            detail="Admin must specify admin_client_id to preview portal"
        )

    # Regular client user
    if is_client:
        auth0_user_id = token_data.sub
        client = db.query(Client).filter(Client.auth0_user_id == auth0_user_id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No client record found for this account. Please contact support."
            )
        return client

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Client portal access required"
    )


@router.post("/portal/link-account")
async def link_portal_account(
    body: LinkAccountRequest,
    token_data=Depends(get_token_data),
    db: Session = Depends(get_db),
):
    auth0_user_id = token_data.sub
    if not auth0_user_id:
        raise HTTPException(status_code=400, detail="Invalid token — no sub claim")

    existing = db.query(Client).filter(Client.auth0_user_id == auth0_user_id).first()
    if existing:
        return {
            "success": True,
            "already_linked": True,
            "client_id": str(existing.id),
            "client_name": f"{existing.first_name} {existing.last_name}",
        }

    client = None

    if body.invite_token:
        secret = os.getenv("PORTAL_INVITE_SECRET")
        try:
            payload = jwt.decode(body.invite_token, secret, algorithms=["HS256"])
            client_id = payload.get("client_id")
            if client_id:
                client = db.query(Client).filter(Client.id == client_id).first()
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            logger.warning(f"[LinkAccount] Token error: {e}")

    if not client and body.email:
        client = db.query(Client).filter(
            Client.email == body.email.lower().strip()
        ).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="No client record found. Please contact Atomic Repair to get access."
        )

    client.auth0_user_id = auth0_user_id
    db.commit()
    db.refresh(client)

    return {
        "success": True,
        "already_linked": False,
        "client_id": str(client.id),
        "client_name": f"{client.first_name} {client.last_name}",
    }


@router.get("/portal/me")
async def get_portal_profile(
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()

    work_orders_list = db.query(WorkOrder).filter(
        WorkOrder.client_id == client.id
    ).all()

    active = [w for w in work_orders_list if _work_order_status(w) not in ("completed", "cancelled", "closed")]
    warranty_active_count = sum(1 for w in work_orders_list if _warranty_is_active(w, db, now))

    upcoming_appts = db.query(WorkOrderAppointment).join(
        WorkOrder, WorkOrderAppointment.work_order_id == WorkOrder.id
    ).filter(
        WorkOrder.client_id == client.id,
        WorkOrderAppointment.scheduled_start > now,
        WorkOrderAppointment.status.notin_(["canceled", "reschedule"])
    ).order_by(WorkOrderAppointment.scheduled_start).all()

    properties_list = db.query(Property).filter(
        Property.client_id == client.id
    ).all()

    return {
        "id": str(client.id),
        "first_name": client.first_name,
        "last_name": client.last_name,
        "company_name": client.company_name,
        "phone": client.phone,
        "email": client.email,
        "stats": {
            "upcoming_appointments": len(upcoming_appts),
            "next_appointment": upcoming_appts[0].scheduled_start.isoformat() if upcoming_appts else None,
            "active_repairs": len(active),
            "total_work_orders": len(work_orders_list),
            "warranty_active": warranty_active_count,
            "property_count": len(properties_list),
        }
    }


@router.get("/portal/appointments")
async def get_portal_appointments(
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db),
    upcoming_only: bool = False
):
    now = datetime.utcnow()

    query = db.query(WorkOrderAppointment).join(
        WorkOrder, WorkOrderAppointment.work_order_id == WorkOrder.id
    ).filter(
        WorkOrder.client_id == client.id
    )

    if upcoming_only:
        query = query.filter(WorkOrderAppointment.scheduled_start > now)

    appointments = query.order_by(desc(WorkOrderAppointment.scheduled_start)).all()

    result = []
    for appt in appointments:
        wo = appt.work_order
        prop = db.query(Property).filter(Property.id == wo.property_id).first() if wo.property_id else None
        result.append({
            "id": str(appt.id),
            "status": appt.status,
            "scheduled_start": appt.scheduled_start.isoformat() if appt.scheduled_start else None,
            "scheduled_end": appt.scheduled_end.isoformat() if appt.scheduled_end else None,
            "work_order": {
                "id": str(wo.id),
                "order_number": wo.order_number,
                "equipment_type": wo.equipment_type,
                "equipment_subtype": wo.equipment_subtype,
                "equipment_make": wo.equipment_make,
                "equipment_model": wo.equipment_model,
                "description": wo.description,
                "status": _work_order_status(wo),
            },
            "property": {
                "address": prop.address if prop else (wo.service_location or {}).get("address"),
                "unit_number": prop.unit_number if prop else None,
                "tenant_name": prop.tenant_name if prop else None,
            } if (prop or wo.service_location) else None,
        })
    return result


@router.get("/portal/work-orders")
async def get_portal_work_orders(
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    property_id: Optional[str] = None
):
    query = db.query(WorkOrder).filter(WorkOrder.client_id == client.id)
    if status:
        query = query.filter(WorkOrder.status == status)
    if property_id:
        query = query.filter(WorkOrder.property_id == property_id)

    work_orders_list = query.order_by(desc(WorkOrder.created_at)).all()

    result = []
    for wo in work_orders_list:
        prop = db.query(Property).filter(Property.id == wo.property_id).first() if wo.property_id else None
        latest_appt = db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.work_order_id == wo.id
        ).order_by(desc(WorkOrderAppointment.scheduled_start)).first()

        warranty_expires = _warranty_expires_at(wo, db)
        warranty_expires_iso = warranty_expires.isoformat() if warranty_expires else None

        result.append({
            "id": str(wo.id),
            "order_number": wo.order_number,
            "status": _work_order_status(wo),
            "created_at": wo.created_at.isoformat() if wo.created_at else None,
            "equipment_type": wo.equipment_type,
            "equipment_subtype": wo.equipment_subtype,
            "equipment_make": wo.equipment_make,
            "equipment_model": wo.equipment_model,
            "equipment_serial": wo.equipment_serial,
            "description": wo.description,
            "symptoms": wo.symptoms or [],
            "invoice_total": float(wo.invoice_total) if wo.invoice_total else None,
            "warranty_expires": warranty_expires_iso,
            "warranty_active": _warranty_is_active(wo, db),
            "property": {
                "id": str(prop.id),
                "address": prop.address,
                "unit_number": prop.unit_number,
            } if prop else {
                "address": (wo.service_location or {}).get("address"),
                "unit_number": None,
            } if wo.service_location else None,
            "next_appointment": {
                "scheduled_start": latest_appt.scheduled_start.isoformat() if latest_appt.scheduled_start else None,
                "status": latest_appt.status,
            } if latest_appt else None,
            "parts": [
                {
                    "name": p.description,
                    "part_number": p.number,
                    "status": p.status,
                }
                for p in (wo.parts or [])
            ],
        })
    return result


@router.get("/portal/work-orders/{work_order_id}")
async def get_portal_work_order_detail(
    work_order_id: str,
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db)
):
    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id
    ).first()

    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    prop = db.query(Property).filter(Property.id == wo.property_id).first() if wo.property_id else None
    appointments = db.query(WorkOrderAppointment).filter(
        WorkOrderAppointment.work_order_id == wo.id
    ).order_by(WorkOrderAppointment.scheduled_start).all()

    warranty_expires = _warranty_expires_at(wo, db)
    warranty_expires_iso = warranty_expires.isoformat() if warranty_expires else None
    warranty_active_flag = _warranty_is_active(wo, db)

    return {
        "id": str(wo.id),
        "order_number": wo.order_number,
        "status": wo.status,
        "created_at": wo.created_at.isoformat() if wo.created_at else None,
        "equipment_type": wo.equipment_type,
        "equipment_subtype": wo.equipment_subtype,
        "equipment_make": wo.equipment_make,
        "equipment_model": wo.equipment_model,
        "equipment_serial": wo.equipment_serial,
        "equipment_version": wo.equipment_version,
        "description": wo.description,
        "symptoms": wo.symptoms or [],
        "notes": [
            {
                "content": n.note,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in (wo.notes or [])
            if not getattr(n, 'is_private', False)
        ],
        "parts": [
            {
                "name": p.description,
                "part_number": p.number,
                "status": p.status,
                "quantity": 1,
            }
            for p in (wo.parts or [])
        ],
        "invoice_subtotal": float(wo.invoice_subtotal) if wo.invoice_subtotal else None,
        "invoice_tax": float(wo.invoice_tax) if wo.invoice_tax else None,
        "invoice_total": float(wo.invoice_total) if wo.invoice_total else None,
        "warranty_expires": warranty_expires_iso,
        "warranty_active": warranty_active_flag,
        "property": {
            "address": prop.address,
            "unit_number": prop.unit_number,
            "gate_code": prop.gate_code,
        } if prop else None,
        "appointments": [
            {
                "id": str(a.id),
                "status": a.status,
                "scheduled_start": a.scheduled_start.isoformat() if a.scheduled_start else None,
                "scheduled_end": a.scheduled_end.isoformat() if a.scheduled_end else None,
            }
            for a in appointments
        ],
    }


@router.get("/portal/properties")
async def get_portal_properties(
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db)
):
    properties_list = db.query(Property).filter(
        Property.client_id == client.id
    ).all()

    now = datetime.utcnow()

    result = []
    for prop in properties_list:
        work_orders_list = db.query(WorkOrder).filter(
            WorkOrder.property_id == prop.id
        ).order_by(desc(WorkOrder.created_at)).all()

        active_wo = [w for w in work_orders_list if w.status not in ("completed", "cancelled", "closed")]
        warranty_active = any(_warranty_is_active(w, db, now) for w in work_orders_list)

        result.append({
            "id": str(prop.id),
            "address": prop.address,
            "unit_number": prop.unit_number,
            "property_type": prop.property_type,
            "tenant_name": prop.tenant_name,
            "tenant_phone": prop.tenant_phone,
            "tenant_email": prop.tenant_email,
            "stats": {
                "active_repairs": len(active_wo),
                "total_repairs": len(work_orders_list),
                "warranty_active": warranty_active,
            },
            "recent_work_orders": [
                {
                    "id": str(w.id),
                    "order_number": w.order_number,
                    "status": w.status,
                    "equipment_make": w.equipment_make,
                    "equipment_model": w.equipment_model,
                    "equipment_subtype": w.equipment_subtype,
                    "created_at": w.created_at.isoformat() if w.created_at else None,
                    "invoice_total": float(w.invoice_total) if w.invoice_total else None,
                }
                for w in work_orders_list[:5]
            ]
        })
    return result


@router.get("/portal/invoices")
async def get_portal_invoices(
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db)
):
    work_orders_list = db.query(WorkOrder).filter(
        WorkOrder.client_id == client.id
    ).order_by(desc(WorkOrder.created_at)).all()

    result = []
    for wo in work_orders_list:
        paid = float(wo.amount_previously_paid or 0)
        gross = float(wo.invoice_total or 0)
        discount = float(wo.diagnostic_discount_amount or 0) if getattr(wo, 'diagnostic_discount_applied', False) else 0
        tax = float(wo.tax_collected or 0)
        total = round(gross - discount + tax, 2)
        if total <= 0:
            total = gross
        if paid >= total and total > 0:
            payment_status = "paid"
        elif paid > 0:
            payment_status = "partial"
        else:
            payment_status = "unpaid"

        result.append({
            "id": str(wo.id),
            "order_number": wo.order_number,
            "created_at": wo.created_at.isoformat() if wo.created_at else None,
            "equipment_subtype": wo.equipment_subtype,
            "equipment_make": wo.equipment_make,
            "subtotal": float(wo.invoice_subtotal) if wo.invoice_subtotal else None,
            "tax": float(wo.invoice_tax) if wo.invoice_tax else None,
            "total": total,
            "amount_paid": paid,
            "payment_status": payment_status,
            "work_order_status": wo.status,
        })
    return result

def _device_key(wo: WorkOrder) -> Optional[str]:
    """
    Stable identity key for grouping a client's work orders into one physical appliance.
    Returns the serial number (lowercased) if present, otherwise None.
    We only track appliances that have a serial number on file.
    """
    serial = (wo.equipment_serial or "").strip().lower()
    return serial if serial else None


@router.get("/portal/appliances")
async def get_portal_appliances(
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db)
):
    """
    Group the client's work orders into distinct appliances.
    Only includes appliances that have a serial number on file.
    """
    work_orders_list = db.query(WorkOrder).filter(
        WorkOrder.client_id == client.id
    ).order_by(desc(WorkOrder.created_at)).all()

    now = datetime.utcnow()
    groups: dict = {}
    for wo in work_orders_list:
        key = _device_key(wo)
        if key:  # Only include work orders with a serial number
            groups.setdefault(key, []).append(wo)

    result = []
    for serial, wos in groups.items():
        wos_sorted = sorted(wos, key=lambda w: w.created_at or datetime.min, reverse=True)
        latest = wos_sorted[0]
        prop = db.query(Property).filter(Property.id == latest.property_id).first() if latest.property_id else None
        warranty_active = any(_warranty_is_active(w, db, now) for w in wos_sorted)
        active_repair = any(_work_order_status(w) not in ("completed", "cancelled", "closed") for w in wos_sorted)

        result.append({
            "serial": latest.equipment_serial,  # Original casing
            "make": latest.equipment_make,
            "model": latest.equipment_model,
            "subtype": latest.equipment_subtype,
            "type": latest.equipment_type,
            "property": {
                "address": prop.address if prop else (latest.service_location or {}).get("address"),
                "unit_number": prop.unit_number if prop else None,
            } if (prop or latest.service_location) else None,
            "service_count": len(wos_sorted),
            "last_service_date": latest.created_at.isoformat() if latest.created_at else None,
            "last_status": _work_order_status(latest),
            "warranty_active": warranty_active,
            "active_repair": active_repair,
        })

    result.sort(key=lambda d: d["last_service_date"] or "", reverse=True)
    return result


@router.get("/portal/appliances/{serial}")
async def get_portal_appliance_detail(
    serial: str,
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db)
):
    """Full repair history for one appliance, identified by its serial number."""
    serial_lower = serial.strip().lower()
    work_orders_list = db.query(WorkOrder).filter(
        WorkOrder.client_id == client.id
    ).order_by(desc(WorkOrder.created_at)).all()

    matching = [w for w in work_orders_list if _device_key(w) == serial_lower]
    if not matching:
        raise HTTPException(status_code=404, detail="Appliance not found")

    now = datetime.utcnow()
    latest = matching[0]
    prop = db.query(Property).filter(Property.id == latest.property_id).first() if latest.property_id else None

    history = []
    for wo in matching:
        warranty_expires = _warranty_expires_at(wo, db)
        history.append({
            "id": str(wo.id),
            "order_number": wo.order_number,
            "status": _work_order_status(wo),
            "created_at": wo.created_at.isoformat() if wo.created_at else None,
            "description": wo.description,
            "symptoms": wo.symptoms or [],
            "invoice_total": float(wo.invoice_total) if wo.invoice_total else None,
            "warranty_expires": warranty_expires.isoformat() if warranty_expires else None,
            "warranty_active": _warranty_is_active(wo, db, now),
            "parts": [
                {"name": p.description, "part_number": p.number, "status": p.status}
                for p in (wo.parts or [])
            ],
        })

    return {
        "serial": latest.equipment_serial,
        "make": latest.equipment_make,
        "model": latest.equipment_model,
        "subtype": latest.equipment_subtype,
        "type": latest.equipment_type,
        "version": latest.equipment_version,
        "property": {
            "address": prop.address if prop else (latest.service_location or {}).get("address"),
            "unit_number": prop.unit_number if prop else None,
        } if (prop or latest.service_location) else None,
        "service_count": len(matching),
        "warranty_active": any(_warranty_is_active(w, db, now) for w in matching),
        "history": history,
    }


@router.get("/portal/work-orders/{work_order_id}/invoice.pdf")
async def get_portal_invoice_pdf(
    work_order_id: str,
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db),
    variant: str = "light"
):
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    from app.services.work_order_invoice_pdf_data import generate_work_order_invoice_pdf

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    try:
        pdf_bytes = generate_work_order_invoice_pdf(db, wo, variant=variant)
    except Exception as e:
        logger.error(f"[Portal PDF] Error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="invoice-{wo.order_number}.pdf"'}
    )


@router.post("/portal/work-orders/{work_order_id}/email-invoice")
async def email_portal_invoice(
    work_order_id: str,
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db),
):
    """Email the client a light PDF copy of their invoice from service@atomicrepair419.com."""
    from app.services.email_service import EmailService
    from app.services.work_order_invoice_pdf_data import generate_work_order_invoice_pdf

    if not client.email:
        raise HTTPException(status_code=400, detail="No email address on file for this account")

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id,
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    try:
        pdf_bytes = generate_work_order_invoice_pdf(db, wo, variant="light")
    except Exception as e:
        logger.error(f"[Portal email invoice] PDF error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate invoice PDF")

    sent = await EmailService.send_invoice_pdf_email(
        to_email=client.email,
        recipient_name=client.first_name or client.display_name,
        order_number=wo.order_number,
        pdf_bytes=pdf_bytes,
    )
    if not sent:
        raise HTTPException(status_code=503, detail="Unable to send email right now. Please try again later.")

    return {"success": True, "message": f"Invoice emailed to {client.email}"}