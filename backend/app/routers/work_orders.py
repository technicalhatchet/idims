from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Path , Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timedelta
import logging

from app.db.database import get_db
from app.core.auth import get_auth_handler, User
from app.models.work_order import WorkOrder
from app.schemas.work_order import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse,
    WorkOrderStatusUpdate, WorkOrderAssign, WorkOrderListResponse
)
from app.services.work_order_service import WorkOrderService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException, BadRequestException

router = APIRouter()
logger = logging.getLogger(__name__)

# Create dependencies properly
auth_handler = get_auth_handler()

# Use proper async dependency function
get_current_user = auth_handler.get_current_user
verify_manager_or_admin = auth_handler.verify_manager_or_admin

# More reliable token extraction
async def get_work_orders_user(request: Request, db: Session = Depends(get_db)):
    """Extract token from the actual request object instead of using None"""
    request_id = str(uuid.uuid4())
    logger.info(f"[DEBUG-{request_id}] get_work_orders_user called with actual request object")
    
    try:
        # Use the FastAPI HTTPBearer class with the actual request object
        from fastapi.security import HTTPBearer
        security = HTTPBearer(auto_error=False)
        logger.info(f"[DEBUG-{request_id}] Created HTTPBearer(auto_error=False)")
        
        # Log request headers for debugging
        auth_header = request.headers.get("Authorization", "NONE")
        logger.info(f"[DEBUG-{request_id}] Auth header from request: {auth_header[:15] if len(auth_header) > 15 else auth_header}")
        
        # Extract credentials using the actual request
        try:
            logger.info(f"[DEBUG-{request_id}] Calling security(request) to extract credentials")
            credentials = await security(request)
            logger.info(f"[DEBUG-{request_id}] Credentials extracted: {credentials}")
        except Exception as e:
            logger.error(f"[DEBUG-{request_id}] Error extracting token from request: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed during token extraction: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        if not credentials:
            logger.warning(f"[DEBUG-{request_id}] No auth credentials found in request")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required: No credentials found",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        # We have credentials, extract and verify the token
        token = credentials.credentials
        logger.info(f"[DEBUG-{request_id}] Token extracted: {token[:10]}... (length: {len(token)})")
        
        # Verify the token
        logger.info(f"[DEBUG-{request_id}] About to verify token using auth_handler.verify_token")
        try:
            payload = await auth_handler.verify_token(token)
            logger.info(f"[DEBUG-{request_id}] Token verified successfully, payload: {payload}")
        except Exception as e:
            logger.error(f"[DEBUG-{request_id}] Token verification failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        if not payload or not payload.sub:
            logger.error(f"[DEBUG-{request_id}] Invalid token: missing or empty subject")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        # Get the user from the database
        logger.info(f"[DEBUG-{request_id}] Looking up user with auth_id: {payload.sub}")
        user = db.query(User).filter(User.auth_id == payload.sub).first()
        if not user:
            logger.error(f"[DEBUG-{request_id}] User not found for auth_id: {payload.sub}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        logger.info(f"[DEBUG-{request_id}] User found: {user.email} (role: {user.role})")
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DEBUG-{request_id}] Authentication error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

# Admin-specific work order user dependency
async def get_admin_work_orders_user(request: Request, db: Session = Depends(get_db)):
    """Extract token and verify admin/manager permissions"""
    user = await get_work_orders_user(request, db)
    
    # Check if user has admin or manager role
    if user.role not in ["admin", "manager"]:
        logger.warning(f"User {user.email} has insufficient permissions: {user.role}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin role required",
        )
    
    return user

@router.get("/work-orders", response_model=WorkOrderListResponse)
async def list_work_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    technician_id: Optional[str] = Query(None, description="Filter by technician ID"),
    start_date: Optional[str] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_work_orders_user)
):
    """
    List work orders with filtering options.
    
    Admins and managers can see all work orders.
    Technicians can only see their assigned work orders.
    Clients can only see their own work orders.
    """
    logger.info(f"Fetching work orders for user: {current_user.email} with role: {current_user.role}")
    
    # Convert string UUIDs to UUID objects
    client_uuid = None
    technician_uuid = None
    
    try:
        if client_id:
            client_uuid = uuid.UUID(client_id)
        if technician_id:
            technician_uuid = uuid.UUID(technician_id)
    except ValueError as e:
        logger.error(f"Invalid UUID: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid UUID: {str(e)}"
        )
    
    # Convert date strings to datetime objects
    start_datetime = None
    end_datetime = None
    try:
        if start_date:
            start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    except ValueError as e:
        logger.error(f"Invalid date format: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {str(e)}"
        )
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    logger.debug(f"Pagination: page={page}, limit={limit}, skip={skip}")
    
    # Log the filter parameters
    logger.debug(f"Filters: status={status}, client_id={client_uuid}, technician_id={technician_uuid}")
    logger.debug(f"Date filters: start_date={start_datetime}, end_date={end_datetime}")
    
    # Role-based filtering
    if current_user.role == "technician":
        # Technicians can only see their assigned work orders
        from app.models.technician import Technician
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician:
            logger.warning(f"Technician profile not found for user {current_user.id}")
            raise NotFoundException("Technician profile not found")
        technician_uuid = technician.id
        logger.debug(f"Filtering by technician_id: {technician_uuid}")
    elif current_user.role == "client":
        # Clients can only see their own work orders
        from app.models.client import Client
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            logger.warning(f"Client profile not found for user {current_user.id}")
            raise NotFoundException("Client profile not found")
        client_uuid = client.id
        logger.debug(f"Filtering by client_id: {client_uuid}")
    
    try:
        logger.info(f"Calling WorkOrderService.get_work_orders with skip={skip}, limit={limit}")
        result = await WorkOrderService.get_work_orders(
            db=db,
            skip=skip,
            limit=limit,
            status=status,
            client_id=client_uuid,
            technician_id=technician_uuid,
            start_date=start_datetime,
            end_date=end_datetime
        )
        
        logger.info(f"Successfully retrieved {len(result['items'])} work orders out of {result['total']}")
        return result
    except Exception as e:
        logger.error(f"Error retrieving work orders: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving work orders: {str(e)}"
        )

@router.post("/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    work_order: WorkOrderCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_work_orders_user)
):
    """Create a new work order"""
    try:
        return await WorkOrderService.create_work_order(db, work_order, current_user.id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating work order: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error creating work order")

@router.get("/work-orders/{work_order_id}", response_model=WorkOrderResponse)
async def get_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order to retrieve"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_work_orders_user)
):
    """
    Get a specific work order by ID.
    
    Performs role-based access control to ensure users only see work orders they're allowed to.
    """
    # Check permissions directly
    can_access = await auth_handler.can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this work order"
        )
    
    try:
        return await WorkOrderService.get_work_order(db, work_order_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving work order"
        )

@router.put("/work-orders/{work_order_id}", response_model=WorkOrderResponse)
async def update_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order to update"),
    work_order_update: WorkOrderUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_work_orders_user)
):
    """Update a work order"""
    try:
        # Add user ID to update data for tracking
        work_order_update_data = work_order_update.dict()
        work_order_update_data["updated_by"] = current_user.id
        
        return await WorkOrderService.update_work_order(
            db, 
            work_order_id, 
            WorkOrderUpdate(**work_order_update_data)
        )
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating work order"
        )

@router.delete("/work-orders/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order to delete"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_work_orders_user)
):
    """Delete a work order"""
    try:
        await WorkOrderService.delete_work_order(db, work_order_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting work order"
        )

@router.put("/work-orders/{work_order_id}/status", response_model=WorkOrderResponse)
async def update_work_order_status(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    status_update: WorkOrderStatusUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_work_orders_user)
):
    """Update a work order's status"""
    # Check permissions directly
    can_access = await auth_handler.can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this work order"
        )
    
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    
    # Additional permissions check based on role and status change
    if current_user.role == "technician":
        # Technicians can only change status to certain states
        allowed_status_changes = {
            "scheduled": ["in_progress"],
            "in_progress": ["on_hold", "completed"],
            "on_hold": ["in_progress"],
        }
        
        if (
            work_order.status not in allowed_status_changes or
            status_update.status not in allowed_status_changes.get(work_order.status, [])
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Technicians cannot change status from {work_order.status} to {status_update.status}"
            )
    elif current_user.role == "client":
        # Clients cannot update work order status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients cannot update work order status"
        )
    
    try:
        # Create update data with status and user ID
        update_data = WorkOrderUpdate(
            status=status_update.status,
            status_notes=status_update.notes,
            updated_by=current_user.id
        )
        
        return await WorkOrderService.update_work_order(db, work_order_id, update_data)
    except Exception as e:
        logger.error(f"Error updating work order status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating work order status"
        )

@router.post("/work-orders/{work_order_id}/assign", response_model=WorkOrderResponse)
async def assign_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    assignment: WorkOrderAssign = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_work_orders_user)
):
    """Assign a work order to a technician"""
    try:
        # Get work order
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Verify technician exists
        from app.models.technician import Technician
        technician = db.query(Technician).filter(Technician.id == assignment.technician_id).first()
        
        if not technician:
            raise ValidationException(f"Technician with ID {assignment.technician_id} not found")
        
        # Update work order with new technician
        update_data = WorkOrderUpdate(
            assigned_technician_id=technician.id,
            updated_by=current_user.id
        )
        
        # If status is pending, update to scheduled
        if work_order.status == "pending":
            update_data.status = "scheduled"
            update_data.status_notes = f"Assigned to technician {technician.id}"
        
        updated_work_order = await WorkOrderService.update_work_order(db, work_order_id, update_data)
        
        # Create notification for technician
        from app.schemas.notification import NotificationCreate
        from app.services.notification_service import NotificationService
        
        notification_data = NotificationCreate(
            user_id=technician.user_id,
            title="New Job Assignment",
            content=f"You have been assigned to work order #{work_order.order_number}",
            type="in_app",
            related_id=work_order.id,
            related_type="work_order"
        )
        
        await NotificationService.create_notification(db, notification_data, send_immediately=True)
        
        return updated_work_order
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error assigning work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error assigning work order"
        )

@router.get("/work-orders/{work_order_id}/timeline", response_model=List[Dict[str, Any]])
async def get_work_order_timeline(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_work_orders_user)
):
    """Get the timeline of events for a work order"""
    # Check permissions directly
    can_access = await auth_handler.can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this work order's timeline"
        )
    
    try:
        return await WorkOrderService.get_work_order_timeline(db, work_order_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving work order timeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving work order timeline"
        )

@router.get("/work-orders-demo", response_model=WorkOrderListResponse)
async def list_work_orders_demo(
    status: Optional[str] = Query(None, description="Filter by status"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    technician_id: Optional[str] = Query(None, description="Filter by technician ID"),
    start_date: Optional[str] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    List work orders with no authentication for demo purposes.
    """
    logger.info("Fetching work orders for demo (no authentication)")
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    logger.debug(f"Pagination: page={page}, limit={limit}, skip={skip}")
    
    try:
        logger.info(f"Calling WorkOrderService.get_work_orders for demo with skip={skip}, limit={limit}")
        result = await WorkOrderService.get_work_orders(
            db=db,
            skip=skip,
            limit=limit,
            status=status,
            client_id=None,
            technician_id=None,
            start_date=None,
            end_date=None
        )
        
        logger.info(f"Successfully retrieved {len(result['items'])} work orders out of {result['total']} for demo")
        return result
    except Exception as e:
        logger.error(f"Error retrieving work orders for demo: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving work orders: {str(e)}"
        )