from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, BackgroundTasks, Request, Body
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import logging
from pydantic import BaseModel
import jwt
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
from app.core.dependencies import get_admin_or_manager_user
from app.config import settings, get_portal_invite_secret

router = APIRouter()
logger = logging.getLogger(__name__)

STAFF_ROLES = frozenset({"admin", "manager", "technician"})


def _is_staff_user(roles: Optional[List[str]]) -> bool:
    return bool(roles and any(r in STAFF_ROLES for r in roles))

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
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    List clients with filtering and pagination.
    Permissions: All authenticated users can access, but regular clients only see themselves.
    """
    user_roles = current_user.roles or []
    if "client" in user_roles and not _is_staff_user(user_roles):
        # Clients can only view their own data
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        
        # Return only this client's data
        return {
            "total": 1,
            "items": [client],
            "page": 1,
            "pages": 1
        }
    
    # For staff, get all clients with filters
    skip = (page - 1) * limit
    return await ClientService.get_clients(db, search=search, status=status, skip=skip, limit=limit)

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
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific client by ID.
    Permissions: Staff can access any client, clients can only access themselves.
    """
    user_roles = current_user.roles or []
    if "client" in user_roles and not _is_staff_user(user_roles):
        # Clients can only view their own data
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this client"
            )
    
    try:
        return await ClientService.get_client(db, client_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    client_update: ClientUpdate,
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a client.
    Permissions: Staff can update any client, clients can only update themselves.
    """
    if "client" in current_user.roles:
        # Clients can only update their own data
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this client"
            )
    
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
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get service history for a client.
    Permissions: Staff can access any client history, clients can only access their own.
    """
    if "client" in current_user.roles:
        # Clients can only view their own data
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this client's service history"
            )
    
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
    
@router.post("/{client_id}/invite")
async def send_portal_invite(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_admin_dependency),
):
    """Generate a signed invite token and send registration email to client."""

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if not client.email:
        raise HTTPException(status_code=400, detail="Client has no email address on file")

    # Generate signed JWT invite token — expires in 7 days
    secret = get_portal_invite_secret()
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="Portal invite signing is not configured. Set PORTAL_INVITE_SECRET (or SECRET_KEY) on the server.",
        )
    payload = {
        "client_id": str(client.id),
        "first_name": client.first_name,
        "last_name": client.last_name,
        "company_name": client.company_name,
        "email": client.email,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    invite_url = f"{settings.FRONTEND_URL.rstrip('/')}/cxdashboard/register?token={token}"

    # Send email via Resend
    import httpx

    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;padding:2rem;border-radius:12px;">
      <img src="https://v0-idims.vercel.app/arpano.png" alt="Atomic Repair" style="height:40px;margin-bottom:1.5rem;" />
      <h2 style="color:#fff;">You&apos;re invited to the Atomic Repair Client Portal</h2>
      <p style="color:#9ca3af;">Hi {client.first_name},</p>
      <p style="color:#9ca3af;">You can now access your service history, upcoming appointments, and invoices online.</p>
      <a href="{invite_url}" style="display:inline-block;background:#00D4FF;color:#0A0F1E;padding:0.875rem 2rem;border-radius:8px;font-weight:700;text-decoration:none;margin:1.5rem 0;">
        Create My Account
      </a>
      <p style="color:#6b7280;font-size:0.75rem;">This link expires in 7 days. If you didn&apos;t expect this email, you can ignore it.</p>
    </div>
    """

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "from": "Atomic Repair <service@atomicrepair419.com>",
            "to": client.email,
            "subject": "Your Atomic Repair Client Portal Invite",
            "html": html,
        }
    )

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to send invite email")

    return {"success": True, "message": f"Invite sent to {client.email}"}