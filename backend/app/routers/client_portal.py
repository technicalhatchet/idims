"""
Client Portal API Router
All endpoints are scoped to the authenticated client only.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, Tuple
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging
import os
import jwt
import requests
import uuid
from urllib.parse import quote

from app.db.database import get_db
from app.core.auth import get_auth_handler
from app.config import get_portal_invite_secret, settings
from app.models.client import Client
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.models.property import Property
from app.utils.portal_estimate import portal_estimate_meta

logger = logging.getLogger(__name__)

CLIENT_ROLE_ID = "rol_okGmH3pkFUu0YXWi"

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


def _estimate_fields(wo: WorkOrder, db: Session) -> dict:
    return portal_estimate_meta(wo, db)


def _require_portal_estimate(wo: WorkOrder, db: Session) -> None:
    meta = portal_estimate_meta(wo, db)
    if meta["estimate_available"]:
        return
    if meta["diagnostic_completed_at"] and meta["estimate_expires_at"]:
        raise HTTPException(
            status_code=403,
            detail="This estimate has expired. Estimates are valid for 30 days after your diagnostic visit.",
        )
    raise HTTPException(status_code=403, detail="Estimate is not available for this work order.")


class LinkAccountRequest(BaseModel):
    invite_token: Optional[str] = None
    email: Optional[str] = None


async def get_token_data(credentials: HTTPAuthorizationCredentials = Depends(security)):
    auth_handler = get_auth_handler()
    return await auth_handler.verify_token(credentials.credentials)


def _assign_client_role(auth0_user_id: str) -> Tuple[bool, Optional[str]]:
    """Assign Auth0 client role. Returns (success, error_detail)."""
    try:
        auth_handler = get_auth_handler()
        management_token = auth_handler.get_client_credentials_token()
        encoded_user_id = quote(auth0_user_id, safe="")
        roles_url = f"https://{auth_handler.domain}/api/v2/users/{encoded_user_id}/roles"
        headers = {
            "Authorization": f"Bearer {management_token}",
            "Content-Type": "application/json",
        }

        existing = requests.get(roles_url, headers=headers, timeout=15)
        if not existing.ok:
            detail = existing.text[:500]
            logger.error(f"[LinkAccount] GET roles failed {existing.status_code}: {detail}")
            return False, f"Auth0 GET roles {existing.status_code}: {detail}"

        for role in existing.json() or []:
            if role.get("id") == CLIENT_ROLE_ID or role.get("name") == "client":
                logger.info(f"[LinkAccount] User {auth0_user_id} already has client role")
                return True, None

        response = requests.post(
            roles_url,
            headers=headers,
            json={"roles": [CLIENT_ROLE_ID]},
            timeout=15,
        )
        if not response.ok:
            detail = response.text[:500]
            logger.error(f"[LinkAccount] POST roles failed {response.status_code}: {detail}")
            return False, f"Auth0 POST roles {response.status_code}: {detail}"

        logger.info(f"[LinkAccount] Assigned client role to {auth0_user_id}")
        return True, None
    except Exception as e:
        logger.exception(f"[LinkAccount] Client role assignment failed for {auth0_user_id}")
        return False, str(e)


def _client_summary(client: Client) -> dict:
    return {
        "id": str(client.id),
        "email": client.email,
        "name": f"{client.first_name} {client.last_name}",
        "auth0_user_id": client.auth0_user_id,
    }


def _link_account_response(
    *,
    client: Client,
    already_linked: bool,
    role_assigned: bool,
    role_error: Optional[str] = None,
    link_method: Optional[str] = None,
) -> dict:
    payload = {
        "success": True,
        "already_linked": already_linked,
        "role_assigned": role_assigned,
        "client_id": str(client.id),
        "client_name": f"{client.first_name} {client.last_name}",
    }
    if link_method:
        payload["link_method"] = link_method
    if role_error:
        payload["role_error"] = role_error
    if not role_assigned:
        payload["role_warning"] = (
            "Account linked but Auth0 client role could not be assigned. "
            "See role_error or call GET /api/portal/link-debug while logged in."
        )
    return payload


async def get_portal_client(
    token_data=Depends(get_token_data),
    db: Session = Depends(get_db),
    admin_client_id: Optional[str] = Query(None),
) -> Client:
    roles = getattr(token_data, 'roles', []) or []
    is_admin = 'admin' in roles
    is_client = 'client' in roles

    parsed_admin_client_id = None
    if admin_client_id:
        try:
            parsed_admin_client_id = uuid.UUID(admin_client_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid admin_client_id")

    # Admin impersonating a client
    if is_admin and parsed_admin_client_id:
        client = db.query(Client).filter(Client.id == parsed_admin_client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return client

    # Admin with no client selected — can't use portal endpoints directly
    if is_admin and not parsed_admin_client_id:
        raise HTTPException(
            status_code=400,
            detail="Admin must specify admin_client_id to preview portal"
        )

    # Regular client user
    if is_client:
        auth0_user_id = token_data.sub
        client = db.query(Client).filter(Client.auth0_user_id == auth0_user_id).first()
        if not client:
            email = (token_data.email or "").lower().strip()
            if email:
                client = db.query(Client).filter(Client.email == email).first()
                if client and not client.auth0_user_id:
                    client.auth0_user_id = auth0_user_id
                    db.commit()
                    db.refresh(client)
                    logger.info(f"[Portal] Auto-linked client {client.id} to {auth0_user_id} via email")
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


@router.get("/portal/link-debug")
async def link_account_debug(
    token_data=Depends(get_token_data),
    db: Session = Depends(get_db),
):
    """
    Diagnostic snapshot for invite / link-account issues.
    Call while logged into the client portal with the same Bearer token.
    """
    auth0_user_id = token_data.sub
    email = (token_data.email or "").lower().strip()
    roles = list(token_data.roles or [])

    client_by_auth0 = (
        db.query(Client).filter(Client.auth0_user_id == auth0_user_id).first()
        if auth0_user_id
        else None
    )
    client_by_email = (
        db.query(Client).filter(Client.email == email).first() if email else None
    )

    invite_secret_configured = bool(get_portal_invite_secret())
    mgmt_configured = bool(
        (settings.AUTH0_MGMT_CLIENT_ID or settings.AUTH0_CLIENT_ID)
        and (settings.AUTH0_MGMT_CLIENT_SECRET or settings.AUTH0_CLIENT_SECRET)
    )

    mgmt_token_ok = False
    mgmt_error = None
    auth0_roles = []

    try:
        auth_handler = get_auth_handler()
        mgmt_token = auth_handler.get_client_credentials_token()
        mgmt_token_ok = True
        encoded_user_id = quote(auth0_user_id, safe="")
        roles_resp = requests.get(
            f"https://{auth_handler.domain}/api/v2/users/{encoded_user_id}/roles",
            headers={"Authorization": f"Bearer {mgmt_token}"},
            timeout=15,
        )
        if roles_resp.ok:
            auth0_roles = [
                {"id": r.get("id"), "name": r.get("name")}
                for r in (roles_resp.json() or [])
            ]
        else:
            mgmt_error = f"GET roles {roles_resp.status_code}: {roles_resp.text[:300]}"
    except Exception as e:
        mgmt_error = str(e)

    return {
        "auth0_user_id": auth0_user_id,
        "token_email": email or None,
        "token_roles": roles,
        "invite_secret_configured": invite_secret_configured,
        "mgmt_credentials_configured": mgmt_configured,
        "mgmt_api_token_ok": mgmt_token_ok,
        "mgmt_error": mgmt_error,
        "auth0_assigned_roles": auth0_roles,
        "has_client_role_in_auth0": any(
            r.get("id") == CLIENT_ROLE_ID or r.get("name") == "client"
            for r in auth0_roles
        ),
        "client_linked_by_auth0_id": _client_summary(client_by_auth0) if client_by_auth0 else None,
        "client_linked_by_email": _client_summary(client_by_email) if client_by_email else None,
        "expected_client_role_id": CLIENT_ROLE_ID,
    }


@router.post("/portal/link-account")
async def link_portal_account(
    body: LinkAccountRequest,
    token_data=Depends(get_token_data),
    db: Session = Depends(get_db),
):
    auth0_user_id = token_data.sub
    if not auth0_user_id:
        raise HTTPException(status_code=400, detail="Invalid token — no sub claim")

    logger.info(
        "[LinkAccount] start sub=%s email=%s has_invite_token=%s has_email=%s invite_secret=%s",
        auth0_user_id,
        token_data.email,
        bool(body.invite_token),
        bool(body.email),
        bool(get_portal_invite_secret()),
    )

    existing = db.query(Client).filter(Client.auth0_user_id == auth0_user_id).first()
    if existing:
        role_assigned, role_error = _assign_client_role(auth0_user_id)
        return _link_account_response(
            client=existing,
            already_linked=True,
            role_assigned=role_assigned,
            role_error=role_error,
            link_method="existing_auth0_user_id",
        )

    client = None
    link_method = None
    invite_error = None

    if body.invite_token:
        secret = get_portal_invite_secret()
        if not secret:
            invite_error = "PORTAL_INVITE_SECRET not configured on API server"
            logger.error(f"[LinkAccount] {invite_error}")
        else:
            try:
                payload = jwt.decode(body.invite_token, secret, algorithms=["HS256"])
                client_id = payload.get("client_id")
                if client_id:
                    client = db.query(Client).filter(Client.id == client_id).first()
                    if client:
                        link_method = "invite_token"
                    else:
                        invite_error = f"client_id {client_id} not found in database"
                else:
                    invite_error = "invite JWT missing client_id claim"
            except jwt.ExpiredSignatureError:
                invite_error = "invite token expired"
                logger.warning("[LinkAccount] invite token expired")
            except jwt.InvalidTokenError as e:
                invite_error = f"invite token invalid: {e}"
                logger.warning(f"[LinkAccount] invite token invalid: {e}")

    if not client and body.email:
        client = db.query(Client).filter(
            Client.email == body.email.lower().strip()
        ).first()
        if client:
            link_method = link_method or "email"

    if not client:
        detail = "No client record found. Please contact Atomic Repair to get access."
        if invite_error:
            detail = f"{detail} (invite: {invite_error})"
        raise HTTPException(status_code=404, detail=detail)

    if client.auth0_user_id and client.auth0_user_id != auth0_user_id:
        raise HTTPException(
            status_code=409,
            detail="This client record is already linked to a different login.",
        )

    if client.auth0_user_id == auth0_user_id:
        role_assigned, role_error = _assign_client_role(auth0_user_id)
        return _link_account_response(
            client=client,
            already_linked=True,
            role_assigned=role_assigned,
            role_error=role_error,
            link_method=link_method or "already_linked_same_client",
        )

    client.auth0_user_id = auth0_user_id
    db.commit()
    db.refresh(client)
    logger.info("[LinkAccount] linked client %s to %s via %s", client.id, auth0_user_id, link_method)

    role_assigned, role_error = _assign_client_role(auth0_user_id)
    return _link_account_response(
        client=client,
        already_linked=False,
        role_assigned=role_assigned,
        role_error=role_error,
        link_method=link_method,
    )


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
            **_estimate_fields(wo, db),
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
        **_estimate_fields(wo, db),
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
            **_estimate_fields(wo, db),
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
    variant: str = Query("light", pattern="^(dark|light)$"),
):
    """Client invoice PDF (v2 layout, full billable lines — no staff document options)."""
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    from app.services.work_order_invoice_pdf_data import generate_work_order_invoice_pdf_v2

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    try:
        pdf_bytes = generate_work_order_invoice_pdf_v2(
            db,
            wo,
            variant=variant,
            show_payments=True,
            show_payment_message=True,
            show_technician=True,
            line_preset="full",
        )
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
    """Email the client a light PDF copy of their invoice (v2 layout, full billable lines)."""
    from app.services.email_service import EmailService
    from app.services.work_order_invoice_pdf_data import generate_work_order_invoice_pdf_v2

    if not client.email:
        raise HTTPException(status_code=400, detail="No email address on file for this account")

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id,
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    try:
        pdf_bytes = generate_work_order_invoice_pdf_v2(
            db,
            wo,
            variant="light",
            show_payments=True,
            show_payment_message=True,
            show_technician=True,
            line_preset="full",
        )
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


@router.get("/portal/work-orders/{work_order_id}/estimate.pdf")
async def get_portal_estimate_pdf(
    work_order_id: str,
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db),
    variant: str = Query("light", pattern="^(dark|light)$"),
):
    """Client estimate PDF (v2, valid 30 days after completed diagnostic)."""
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    from app.services.work_order_invoice_pdf_data import generate_work_order_estimate_pdf_v2

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id,
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    _require_portal_estimate(wo, db)

    try:
        pdf_bytes = generate_work_order_estimate_pdf_v2(
            db,
            wo,
            variant=variant,
            show_payments=True,
            show_payment_message=True,
            show_technician=True,
            line_preset="full",
        )
    except Exception as e:
        logger.error(f"[Portal estimate PDF] Error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="estimate-{wo.order_number}.pdf"'},
    )


@router.post("/portal/work-orders/{work_order_id}/email-estimate")
async def email_portal_estimate(
    work_order_id: str,
    client: Client = Depends(get_portal_client),
    db: Session = Depends(get_db),
):
    """Email the client a light PDF copy of their estimate (30-day window after diagnostic)."""
    from app.services.email_service import EmailService
    from app.services.work_order_invoice_pdf_data import generate_work_order_estimate_pdf_v2

    if not client.email:
        raise HTTPException(status_code=400, detail="No email address on file for this account")

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == work_order_id,
        WorkOrder.client_id == client.id,
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    _require_portal_estimate(wo, db)

    try:
        pdf_bytes = generate_work_order_estimate_pdf_v2(
            db,
            wo,
            variant="light",
            show_payments=True,
            show_payment_message=True,
            show_technician=True,
            line_preset="full",
        )
    except Exception as e:
        logger.error(f"[Portal email estimate] PDF error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate estimate PDF")

    sent = await EmailService.send_work_order_document_pdf_email(
        to_email=client.email,
        recipient_name=client.first_name or client.display_name,
        order_number=wo.order_number,
        pdf_bytes=pdf_bytes,
        doc_type="estimate",
    )
    if not sent:
        raise HTTPException(status_code=503, detail="Unable to send email right now. Please try again later.")

    return {"success": True, "message": f"Estimate emailed to {client.email}"}