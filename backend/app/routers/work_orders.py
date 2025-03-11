from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Path
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.work_order import WorkOrder
from app.schemas.work_order import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse,
    WorkOrderStatusUpdate, WorkOrderAssign, WorkOrderListResponse
)
from app.services.work_order_service import WorkOrderService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException, BadRequestException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/work-orders", response_model=WorkOrderListResponse)
async def list_work_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    technician_id: Optional[uuid.UUID] = Query(None, description="Filter by technician ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List work orders with filtering options.
    
    Admins and managers can see all work orders.
    Technicians can only see their assigned work orders.
    Clients can only see their own work orders.
    """
    skip = (page - 1) * limit
    
    # Role-based filtering
    if current_user.role == "technician":
        # Technicians can only see their assigned work orders
        from app.models.technician import Technician
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician:
            raise NotFoundException("Technician profile not found")
        technician_id = technician.id
    elif current_user.role == "client":
        # Clients can only see their own work orders
        from app.models.client import Client
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        client_id = client.id
    
    try:
        result = await WorkOrderService.get_work_orders(
            db=db,
            skip=skip,
            limit=limit,
            status=status,
            client_id=client_id,
            technician_id=technician_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return result
    except Exception as e:
        logger.error(f"Error retrieving work orders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving work orders"
        )

@router.post("/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    work_order: WorkOrderCreate = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
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
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific work order by ID.
    
    Performs role-based access control to ensure users only see work orders they're allowed to.
    """
    # Check permissions
    if not await auth_handler.can_access_work_order(work_order_id, current_user, db):
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
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
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
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
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
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """Update a work order's status"""
    # Check permissions
    if not await auth_handler.can_access_work_order(work_order_id, current_user, db):
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
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
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
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """Get the timeline of events for a work order"""
    # Check permissions
    if not await auth_handler.can_access_work_order(work_order_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this work order"
        )
    
    try:
        # Get work order
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Get status history
        from app.models.work_order import WorkOrderStatusHistory
        status_history = db.query(WorkOrderStatusHistory).filter(
            WorkOrderStatusHistory.work_order_id == work_order_id
        ).order_by(WorkOrderStatusHistory.created_at).all()
        
        # Get notes history (excluding private notes for clients)
        from app.models.work_order import WorkOrderNote
        notes_query = db.query(WorkOrderNote).filter(
            WorkOrderNote.work_order_id == work_order_id
        )
        
        if current_user.role == "client":
            notes_query = notes_query.filter(WorkOrderNote.is_private == False)
        
        notes = notes_query.order_by(WorkOrderNote.created_at).all()
        
        # Combine and sort timeline items
        timeline = []
        
        # Add creation event
        timeline.append({
            "type": "creation",
            "timestamp": work_order.created_at,
            "data": {
                "created_by": work_order.created_by
            }
        })
        
        # Add scheduling event if scheduled
        if work_order.scheduled_start:
            timeline.append({
                "type": "scheduled",
                "timestamp": work_order.scheduled_start,
                "data": {
                    "scheduled_start": work_order.scheduled_start,
                    "scheduled_end": work_order.scheduled_end
                }
            })
        
        # Add status changes
        for history in status_history:
            timeline.append({
                "type": "status_change",
                "timestamp": history.created_at,
                "data": {
                    "from_status": history.previous_status,
                    "to_status": history.new_status,
                    "changed_by": history.changed_by,
                    "notes": history.notes
                }
            })
        
        # Add notes
        for note in notes:
            timeline.append({
                "type": "note",
                "timestamp": note.created_at,
                "data": {
                    "note": note.note,
                    "user_id": note.user_id,
                    "is_private": note.is_private
                }
            })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x["timestamp"])
        
        return timeline
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting work order timeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting work order timeline"
        )