from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.client import Client
from app.schemas.client import (
    ClientCreate, ClientUpdate, ClientResponse, ClientListResponse
)
from app.services.client_service import ClientService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/clients", response_model=ClientListResponse)
async def list_clients(
    search: Optional[str] = Query(None, description="Search term for client name or email"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List clients with filtering and pagination.
    Permissions: All authenticated users can access, but regular clients only see themselves.
    """
    # Check if user is a client (only allowed to see their own info)
    if current_user.role == "client":
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

@router.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client: ClientCreate,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
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

@router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID = Path(..., description="The ID of the client to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific client by ID.
    Permissions: Staff can access any client, clients can only access themselves.
    """
    # Check permissions for clients
    if current_user.role == "client":
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

@router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    client_update: ClientUpdate,
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a client.
    Permissions: Staff can update any client, clients can only update themselves.
    """
    # Check permissions for clients
    if current_user.role == "client":
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

@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID,
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a client.
    Permissions: Only admins can delete clients.
    """
    try:
        await ClientService.delete_client(db, client_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.get("/clients/{client_id}/service-history", response_model=List)
async def get_client_service_history(
    client_id: uuid.UUID,
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get service history for a client.
    Permissions: Staff can access any client history, clients can only access their own.
    """
    # Check permissions for clients
    if current_user.role == "client":
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