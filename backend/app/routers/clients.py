from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, BackgroundTasks, Request, Body
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import logging
from pydantic import BaseModel
import os
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.auth import AuthUser, get_auth_handler
from app.models.client import Client
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientListResponse
)
from app.services.client_service import ClientService
from app.services.notification_service import NotificationService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException
from app.core.dependencies import get_admin_or_manager_user, get_staff_user
from app.config import settings
from app.schemas.client_appliance import ClientApplianceCreate, ClientApplianceUpdate, MergeAppliancesRequest
from app.services import client_appliance_service as appliance_svc
from app.services.portal_claim_service import (
    PURPOSE_PORTAL_INVITE,
    build_claim_register_url,
    create_portal_claim,
    send_portal_invite_email,
)
from app.models.user import User
from app.schemas.client_merge import ClientMergeRequest, ClientMergeExecuteResponse
from app.services.client_merge_service import (
    ClientMergeError,
    build_merge_preview,
    execute_client_merge,
)

router = APIRouter()
logger = logging.getLogger(__name__)

STAFF_ROLES = frozenset({"admin", "manager", "technician"})


def _normalize_roles(roles) -> List[str]:
    if not roles:
        return []
    if isinstance(roles, list):
        return [str(r) for r in roles]
    if isinstance(roles, str):
        try:
            import json
            parsed = json.loads(roles)
            if isinstance(parsed, list):
                return [str(r) for r in parsed]
        except (json.JSONDecodeError, TypeError):
            pass
        return [part.strip() for part in roles.split(",") if part.strip()]
    return [str(roles)]


def _serialize_client_for_list(client: Client) -> dict:
    status = client.status.value if hasattr(client.status, "value") else client.status
    return {
        "id": client.id,
        "company_name": client.company_name,
        "first_name": client.first_name,
        "last_name": client.last_name,
        "email": client.email or None,
        "phone": client.phone,
        "mobile": client.mobile,
        "address": client.address,
        "billing_address": client.billing_address,
        "shipping_address": client.shipping_address,
        "notes": client.notes,
        "status": status,
        "source": client.source,
        "tags": client.tags,
        "custom_fields": client.custom_fields,
        "tax_id": client.tax_id,
        "payment_terms": client.payment_terms,
        "credit_limit": client.credit_limit,
        "created_at": client.created_at,
        "updated_at": client.updated_at,
        "created_by": client.created_by,
        "updated_by": getattr(client, "updated_by", None),
        "self_scheduling_blocked": bool(getattr(client, "self_scheduling_blocked", False)),
        "portal_booking_payment_waived": bool(
            getattr(client, "portal_booking_payment_waived", False)
        ),
        "scheduling_zone_exempt": bool(getattr(client, "scheduling_zone_exempt", False)),
        "appliances_import_completed": bool(getattr(client, "appliances_import_completed", False)),
    }


def _is_staff_user(roles) -> bool:
    normalized = _normalize_roles(roles)
    return bool(normalized and any(r in STAFF_ROLES for r in normalized))

# New schema for registration email
class RegistrationEmailData(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    custom_message: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "name": "John Doe",
                "company": "ACME Inc.",
                "custom_message": "We're looking forward to working with you!"
            }
        }

async def get_current_user_dependency(request: Request = None):
    """Lazy-loaded dependency for current user"""
    try:
        auth_handler = get_auth_handler()
        # Extract token from Authorization header
        token = None
        if request and "Authorization" in request.headers:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth.replace("Bearer ", "")
                logger.info(f"Token extracted from Authorization header, length: {len(token)}")
        
        user = await auth_handler.get_current_user(token)
        if not user:
            logger.warning("Authentication failed: No user returned from auth handler")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    except Exception as e:
        logger.error(f"Authentication error in clients router: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_manager_or_admin_dependency(request: Request = None):
    """Lazy-loaded dependency for manager or admin"""
    auth_handler = get_auth_handler()
    
    token = None
    if request and "Authorization" in request.headers:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.replace("Bearer ", "")
            logger.info(f"Token extracted from Authorization header, length: {len(token)}")
    
    return await auth_handler.verify_manager_or_admin(token)

async def get_admin_dependency(request: Request = None):
    """Lazy-loaded dependency for admin"""
    auth_handler = get_auth_handler()
    
    token = None
    if request and "Authorization" in request.headers:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.replace("Bearer ", "")
            logger.info(f"Token extracted from Authorization header, length: {len(token)}")
    
    return await auth_handler.verify_admin(token)

@router.get("", response_model=ClientListResponse)
@router.get("/", response_model=ClientListResponse, include_in_schema=False)
async def list_clients(
    search: Optional[str] = Query(None, description="Search term for client name or email"),
    status: Optional[str] = Query(None, description="Filter by status"),
    portal_signup_incomplete: bool = Query(
        False,
        description="Self-signup clients with default New/Customer names and unfinished profile",
    ),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: AuthUser = Depends(get_staff_user),
    db: Session = Depends(get_db)
):
    """
    List clients with filtering and pagination.
    Permissions: Staff only (portal customers use /api/portal/*).
    """
    skip = (page - 1) * limit
    try:
        result = await ClientService.get_clients(
            db,
            search=search,
            status=status,
            portal_signup_incomplete=portal_signup_incomplete,
            skip=skip,
            limit=limit,
        )
        return {
            "total": result["total"],
            "items": [_serialize_client_for_list(c) for c in result["items"]],
            "page": result["page"],
            "pages": result["pages"],
        }
    except Exception as e:
        logger.exception("list_clients failed")
        raise HTTPException(status_code=500, detail=f"Failed to load clients: {e}")


@router.get("/merge/preview")
async def preview_client_merge(
    keep_id: uuid.UUID = Query(..., description="Survivor client id"),
    merge_id: uuid.UUID = Query(..., description="Duplicate client id to absorb"),
    current_user: User = Depends(get_admin_dependency),
    db: Session = Depends(get_db),
):
    """Side-by-side merge preview with row counts, warnings, and blockers. Admin only."""
    try:
        return build_merge_preview(db, keep_client_id=keep_id, merge_client_id=merge_id)
    except ClientMergeError as e:
        raise HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message})


@router.post("/merge", response_model=ClientMergeExecuteResponse)
async def merge_clients(
    body: ClientMergeRequest,
    current_user: User = Depends(get_admin_dependency),
    db: Session = Depends(get_db),
):
    """Merge duplicate clients into one survivor. Admin only."""
    admin_name = f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email
    try:
        keep, audit, warnings = execute_client_merge(
            db,
            keep_client_id=body.keep_client_id,
            merge_client_id=body.merge_client_id,
            field_choices=body.field_choices.model_dump(),
            merged_by_user_id=current_user.id,
            admin_display_name=admin_name,
        )
        db.commit()
        return ClientMergeExecuteResponse(
            keep_client_id=keep.id,
            merge_client_id=body.merge_client_id,
            audit_id=audit.id,
            warnings=warnings,
        )
    except ClientMergeError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message})
    except Exception:
        db.rollback()
        logger.exception("merge_clients failed")
        raise HTTPException(status_code=500, detail="Client merge failed")


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client: ClientCreate,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new client.
    Permissions: Only managers and admins can create clients.
    """
    try:
        return await ClientService.create_client(db, client, current_user.id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID = Path(..., description="The ID of the client to retrieve"),
    current_user: AuthUser = Depends(get_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific client by ID.
    Permissions: Staff only.
    """
    try:
        return await ClientService.get_client(db, client_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    client_update: ClientUpdate,
    current_user: AuthUser = Depends(get_staff_user),
    db: Session = Depends(get_db)
):
    """
    Update a client.
    Permissions: Staff only.
    """
    try:
        return await ClientService.update_client(db, client_id, client_update)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID,
    current_user: AuthUser = Depends(get_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a client.
    Permissions: Only admins can delete clients.
    """
    if "client" in current_user.roles:
        # Clients can only delete their own data
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this client"
            )
    
    try:
        await ClientService.delete_client(db, client_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.get("/{client_id}/service-history", response_model=List)
async def get_client_service_history(
    client_id: uuid.UUID,
    current_user: AuthUser = Depends(get_staff_user),
    db: Session = Depends(get_db)
):
    """
    Get service history for a client.
    Permissions: Staff only.
    """
    try:
        return await ClientService.get_client_service_history(db, client_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/{client_id}/send-registration", response_model=Dict[str, Any])
async def send_registration_email(
    client_id: uuid.UUID,
    email_data: RegistrationEmailData = Body(...),
    background_tasks: BackgroundTasks = None,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Send a registration email to a client.
    Permissions: Only managers and admins can send registration emails.
    """
    try:
        # First, get the client to verify they exist and have an email
        client = await ClientService.get_client(db, client_id)
        
        if not client.email:
            raise ValidationException("Client does not have an email address")
        
        # Prepare email data
        email_context = {
            "name": email_data.name or f"{client.first_name} {client.last_name}",
            "company": email_data.company or client.company_name or "",
            "custom_message": email_data.custom_message or "",
            "sent_by": f"{current_user.first_name} {current_user.last_name} ({current_user.email})"
        }
        
        # Send the email in the background
        if background_tasks:
            background_tasks.add_task(
                NotificationService.send_client_registration_email,
                db=db,
                client_id=client_id,
                client_email=client.email,
                data=email_context
            )
        else:
            # For testing or if background tasks not available
            await NotificationService.send_client_registration_email(
                db=db,
                client_id=client_id,
                client_email=client.email,
                data=email_context
            )
        
        # Also create a notification for the client if they already have a user account
        if client.user_id:
            notification_data = {
                "user_id": client.user_id,
                "title": "Account Registration",
                "message": "You've been invited to create an account on our service platform.",
                "type": "in_app",
                "link": f"/register?client_id={client_id}",
                "is_read": False
            }
            await NotificationService.create_notification(db, notification_data)
        
        return {
            "success": True,
            "message": f"Registration email sent to {client.email}",
            "client_id": str(client_id)
        }
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending registration email: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sending registration email: {str(e)}"
        )

@router.post("/{client_id}/send-registration-email", response_model=Dict[str, Any])
async def send_registration_email_alias(
    client_id: uuid.UUID,
    email_data: RegistrationEmailData = Body(...),
    background_tasks: BackgroundTasks = None,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Alias for send_registration_email - provides compatibility with frontend.
    Send a registration email to a client.
    Permissions: Only managers and admins can send registration emails.
    """
    return await send_registration_email(
        client_id=client_id,
        email_data=email_data,
        background_tasks=background_tasks,
        current_user=current_user,
        db=db
    )
    
class PortalClaimCreateBody(BaseModel):
    purpose: str = PURPOSE_PORTAL_INVITE
    send_email: bool = False
    ttl_days: int = 7


@router.post("/{client_id}/portal-claims")
async def create_client_portal_claim(
    client_id: uuid.UUID,
    body: PortalClaimCreateBody = Body(default_factory=PortalClaimCreateBody),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    """Create a single-use portal claim link (optionally email the client)."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if body.purpose != PURPOSE_PORTAL_INVITE:
        raise HTTPException(
            status_code=400,
            detail="Only portal_invite purpose is supported",
        )

    if body.send_email and not client.email:
        raise HTTPException(status_code=400, detail="Client has no email address on file")

    claim, raw_token = create_portal_claim(
        db,
        client_id,
        purpose=PURPOSE_PORTAL_INVITE,
        created_by_auth0_sub=current_user.auth_id,
        ttl_days=body.ttl_days,
    )
    invite_url = build_claim_register_url(raw_token)
    db.commit()

    if body.send_email:
        send_portal_invite_email(client, invite_url)
    return {
        "claim_id": str(claim.id),
        "url": invite_url,
        "expires_at": claim.expires_at.isoformat() + "Z" if claim.expires_at else None,
        "email_sent": body.send_email,
    }


@router.post("/{client_id}/invite")
async def send_portal_invite(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_admin_dependency),
):
    """Create a DB-backed claim link and send registration email (legacy route)."""

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not client.email:
        raise HTTPException(status_code=400, detail="Client has no email address on file")

    claim, raw_token = create_portal_claim(
        db,
        client.id,
        purpose=PURPOSE_PORTAL_INVITE,
        created_by_auth0_sub=current_user.auth_id,
    )
    invite_url = build_claim_register_url(raw_token)
    db.commit()
    send_portal_invite_email(client, invite_url)

    return {"success": True, "message": f"Invite sent to {client.email}", "claim_id": str(claim.id)}


@router.get("/{client_id}/appliances")
async def list_client_appliances_staff(
    client_id: uuid.UUID,
    current_user: AuthUser = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return appliance_svc.list_client_appliances(db, client_id, active_only=False)


@router.post("/{client_id}/appliances")
async def create_client_appliance_staff(
    client_id: uuid.UUID,
    payload: ClientApplianceCreate,
    current_user: AuthUser = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    try:
        appliance = appliance_svc.create_client_appliance(
            db,
            client_id,
            payload,
            source="staff",
            verified_by_user_id=current_user.id,
        )
        db.commit()
        db.refresh(appliance)
        return appliance_svc.serialize_appliance(appliance, db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{client_id}/appliances/{appliance_id}")
async def update_client_appliance_staff(
    client_id: uuid.UUID,
    appliance_id: uuid.UUID,
    payload: ClientApplianceUpdate,
    current_user: AuthUser = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    try:
        appliance = appliance_svc.update_client_appliance(db, client_id, appliance_id, payload)
        db.commit()
        db.refresh(appliance)
        return appliance_svc.serialize_appliance(appliance, db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{client_id}/appliances/{appliance_id}")
async def delete_client_appliance_staff(
    client_id: uuid.UUID,
    appliance_id: uuid.UUID,
    current_user: AuthUser = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    try:
        appliance_svc.soft_delete_client_appliance(db, client_id, appliance_id)
        db.commit()
        return {"success": True}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{client_id}/appliances/{appliance_id}/verify")
async def verify_client_appliance_staff(
    client_id: uuid.UUID,
    appliance_id: uuid.UUID,
    current_user: AuthUser = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    try:
        appliance = appliance_svc.verify_appliance_by_staff(
            db, client_id, appliance_id, current_user.id
        )
        db.commit()
        db.refresh(appliance)
        return appliance_svc.serialize_appliance(appliance, db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{client_id}/appliances/merge")
async def merge_client_appliances_staff(
    client_id: uuid.UUID,
    payload: MergeAppliancesRequest,
    current_user: AuthUser = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    try:
        keep = appliance_svc.merge_appliances(db, client_id, payload.keep_id, payload.merge_ids)
        db.commit()
        db.refresh(keep)
        return appliance_svc.serialize_appliance(keep, db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class PortalPersonInviteBody(BaseModel):
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    send_email: bool = False
    ttl_days: int = 7


def _serialize_portal_login_row(db: Session, login) -> Dict[str, Any]:
    from app.models.client_login import ClientLogin
    from app.models.user import User as DBUser

    assert isinstance(login, ClientLogin)
    user = db.query(DBUser).filter(DBUser.id == login.user_id).first() if login.user_id else None
    contact = login.invited_email or login.invited_phone
    if not contact and user:
        contact = user.email
    last_login = user.last_login if user else None
    return {
        "id": str(login.id),
        "display_name": login.display_name,
        "contact": contact,
        "added_via": login.added_via,
        "created_at": login.created_at.isoformat() if login.created_at else None,
        "revoked_at": login.revoked_at.isoformat() if login.revoked_at else None,
        "last_login": last_login.isoformat() if last_login else None,
    }


def _serialize_pending_claim(claim) -> Dict[str, Any]:
    return {
        "id": str(claim.id),
        "display_name": claim.display_name,
        "invited_email": claim.invited_email,
        "invited_phone": claim.invited_phone,
        "expires_at": claim.expires_at.isoformat() if claim.expires_at else None,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
    }


@router.get("/{client_id}/portal-access")
async def get_client_portal_access(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    from app.models.client_login import ClientLogin
    from app.models.client_portal_claim import ClientPortalClaim
    from app.utils.datetime_utils import utcnow_naive

    logins = (
        db.query(ClientLogin)
        .filter(ClientLogin.client_id == client_id)
        .order_by(ClientLogin.created_at.asc())
        .all()
    )
    now = utcnow_naive()
    pending = (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.client_id == client_id,
            ClientPortalClaim.purpose == PURPOSE_PORTAL_INVITE,
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
            ClientPortalClaim.expires_at > now,
        )
        .order_by(ClientPortalClaim.created_at.desc())
        .all()
    )
    return {
        "logins": [_serialize_portal_login_row(db, row) for row in logins],
        "pending_invites": [_serialize_pending_claim(c) for c in pending],
    }


@router.post("/{client_id}/portal-access/invites")
async def invite_portal_person(
    client_id: uuid.UUID,
    body: PortalPersonInviteBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    if not (body.email or "").strip() and not (body.phone or "").strip():
        raise HTTPException(status_code=400, detail="Email or phone is required")

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    claim, raw_token = create_portal_claim(
        db,
        client_id,
        purpose=PURPOSE_PORTAL_INVITE,
        created_by_auth0_sub=current_user.auth_id,
        ttl_days=body.ttl_days,
        invited_email=body.email,
        invited_phone=body.phone,
        display_name=body.display_name,
    )
    invite_url = build_claim_register_url(raw_token)
    db.commit()

    email_sent = False
    if body.send_email and body.email:
        send_portal_invite_email(
            client,
            invite_url,
            to_email=body.email,
            invitee_name=body.display_name,
        )
        email_sent = True

    return {
        "claim_id": str(claim.id),
        "url": invite_url,
        "expires_at": claim.expires_at.isoformat() if claim.expires_at else None,
        "email_sent": email_sent,
    }


@router.post("/{client_id}/portal-access/invites/{claim_id}/resend")
async def resend_portal_person_invite(
    client_id: uuid.UUID,
    claim_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    from app.models.client_portal_claim import ClientPortalClaim
    from app.utils.datetime_utils import utcnow_naive

    claim = (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.id == claim_id,
            ClientPortalClaim.client_id == client_id,
        )
        .first()
    )
    if not claim or claim.used_at or claim.revoked_at:
        raise HTTPException(status_code=404, detail="Invite not found")
    now = utcnow_naive()
    if claim.expires_at and claim.expires_at < now:
        raise HTTPException(status_code=400, detail="Invite expired; create a new one")

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    _, raw_token = create_portal_claim(
        db,
        client_id,
        purpose=PURPOSE_PORTAL_INVITE,
        created_by_auth0_sub=current_user.auth_id,
        invited_email=claim.invited_email,
        invited_phone=claim.invited_phone,
        display_name=claim.display_name,
    )
    claim.revoked_at = now
    invite_url = build_claim_register_url(raw_token)
    db.commit()

    if claim.invited_email:
        send_portal_invite_email(
            client,
            invite_url,
            to_email=claim.invited_email,
            invitee_name=claim.display_name,
        )
    return {"url": invite_url, "email_sent": bool(claim.invited_email)}


@router.post("/{client_id}/portal-access/invites/{claim_id}/cancel")
async def cancel_portal_person_invite(
    client_id: uuid.UUID,
    claim_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    from app.models.client_portal_claim import ClientPortalClaim
    from app.utils.datetime_utils import utcnow_naive

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    claim = (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.id == claim_id,
            ClientPortalClaim.client_id == client_id,
            ClientPortalClaim.purpose == PURPOSE_PORTAL_INVITE,
        )
        .first()
    )
    if not claim or claim.used_at:
        raise HTTPException(status_code=404, detail="Invite not found")

    if not claim.revoked_at:
        claim.revoked_at = utcnow_naive()
    db.commit()
    return {"success": True}


@router.post("/{client_id}/portal-access/logins/{login_id}/revoke")
async def revoke_client_portal_login_route(
    client_id: uuid.UUID,
    login_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    from app.models.client_login import ClientLogin
    from app.services.portal_login_service import (
        remove_auth0_client_role_if_orphaned,
        revoke_client_login,
    )

    login = (
        db.query(ClientLogin)
        .filter(ClientLogin.id == login_id, ClientLogin.client_id == client_id)
        .first()
    )
    if not login:
        raise HTTPException(status_code=404, detail="Portal login not found")

    auth0_sub = login.auth0_user_id
    revoke_client_login(db, login_id)
    # Commit before Auth0 role removal (orphan check uses a fresh DB session).
    db.commit()
    role_error = remove_auth0_client_role_if_orphaned(auth0_sub)
    return {"success": True, "role_removal_error": role_error}