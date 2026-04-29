from fastapi.responses import StreamingResponse
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Path, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timedelta, date as py_date
import logging
from pydantic import BaseModel, UUID4, Field
from sqlalchemy import cast, Date

from app.db.database import get_db
from app.core.auth import get_auth_handler
from app.models.work_order import WorkOrder as WorkOrderModel
from app.models.work_order import WorkOrderAppointment
from app.models.work_order import WorkOrderPart
from app.models.user import User as UserModel
from app.models.client import Client
from app.models.technician import Technician
from app.schemas.work_order import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse,
    WorkOrderStatusUpdate, WorkOrderAssign, WorkOrderListResponse,
    WorkOrderAppointmentCreate, WorkOrderAppointmentUpdate, WorkOrderAppointmentResponse,
    WorkOrderNoteCreate, WorkOrderNoteResponse,
    WorkOrderPartCreate, WorkOrderPartUpdate, WorkOrderPartResponse,
    BillingStatusUpdate, WorkOrderBillingSummary, AdminBillingOverride,
    WorkOrderWithInitialAppointmentCreate, WorkOrderWithInitialAppointmentResponse,
)
from app.schemas.service import ServiceResponse
from app.services.work_order_service import WorkOrderService
from app.core.dependencies import get_current_user, get_admin_or_manager_user
from app.core.exceptions import NotFoundException, ConflictException, ValidationException, BadRequestException
from app.services.user_service import UserService
from app.dependencies import require_role
from app import schemas
from app.utils.work_order_display import (
    primary_appointments_by_work_order_ids,
    technician_display_name_from_appointment,
)

# Setup logger properly
logger = logging.getLogger(__name__)

# Initialize auth handler
auth_handler = get_auth_handler()

router = APIRouter()

# Helper function for checking work order access
async def can_access_work_order(work_order_id: uuid.UUID, current_user: UserModel, db: Session) -> bool:
    """
    Check if the current user can access a specific work order.
    
    Args:
        work_order_id: The ID of the work order
        current_user: The current user
        db: Database session
        
    Returns:
        bool: True if the user can access the work order, False otherwise
    """
    try:
        # Admins and managers can access all work orders
        if any(role in ["admin", "manager"] for role in current_user.roles):
            return True
            
        # Get the work order
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Calculate totals before returning the work order
        work_order.calculate_totals()
        logging.info(f"DEBUG: Work order {work_order_id} fetched - services: {len(work_order.services)}")
        logging.info(f"DEBUG: Services billing status: {[(s.name, s.billing_status) for s in work_order.services]}")
        
        
        # Clients can only access their own work orders
        if "client" in current_user.roles:
            client = UserService.get_client_by_user_id(db, current_user.id)
            if not client:
                logger.warning(f"Client record not found for user {current_user.id}")
                return False
                
            return work_order.client_id == client.id
            
        # Technicians can only access work orders assigned to them
        elif "technician" in current_user.roles:
            technician = UserService.get_technician_by_user_id(db, current_user.id)
            if not technician:
                logger.warning(f"Technician record not found for user {current_user.id}")
                return False
                
            return work_order.assigned_technician_id == technician.id
            
        # By default, deny access
        return False
        
    except Exception as e:
        logger.error(f"Error checking work order access: {str(e)}")
        return False

@router.get("/work-orders", response_model=WorkOrderListResponse)
async def list_work_orders(
    request: Request,
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    technician_id: Optional[str] = Query(None, description="Filter by technician ID"),
    start_date: Optional[str] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    List work orders with filtering options.
    
    Admins and managers can see all work orders.
    Technicians can only see their assigned work orders.
    Clients can only see their own work orders.
    """
    request_id = str(uuid.uuid4())
    logger.info(f"[REQUEST-{request_id}] Fetching work orders for user: {current_user.email} with roles: {current_user.roles}")
    
    # Convert string UUIDs to UUID objects if provided
    client_uuid = None
    technician_uuid = None
    
    try:
        if client_id:
            client_uuid = uuid.UUID(client_id)
        if technician_id:
            technician_uuid = uuid.UUID(technician_id)
    except ValueError as e:
        logger.error(f"[REQUEST-{request_id}] Invalid UUID: {str(e)}")
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
        logger.error(f"[REQUEST-{request_id}] Invalid date format: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {str(e)}"
        )
    
    # Apply role-based filtering
    if "client" in current_user.roles:
        # Clients can only see their own work orders
        logger.info(f"[REQUEST-{request_id}] Filtering work orders for client: {current_user.id}")
        client = UserService.get_client_by_user_id(db, current_user.id)
        if not client:
            logger.warning(f"[REQUEST-{request_id}] Client record not found for user {current_user.id}")
            return {
                "total": 0,
                "page": page,
                "pages": 0,
                "items": []
            }
        client_uuid = client.id
        
    elif "technician" in current_user.roles:
        # Technicians can only see work orders assigned to them
        logger.info(f"[REQUEST-{request_id}] Filtering work orders for technician: {current_user.id}")
        technician = UserService.get_technician_by_user_id(db, current_user.id)
        if not technician:
            logger.warning(f"[REQUEST-{request_id}] Technician record not found for user {current_user.id}")
            return {
                "total": 0,
                "page": page,
                "pages": 0,
                "items": []
            }
        technician_uuid = technician.id
        
    else:
        # Admins and managers can see all work orders
        logger.info(f"[REQUEST-{request_id}] User has roles {current_user.roles} - showing all work orders")
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    
    try:
        # Use the WorkOrderService to get the data from database
        result = await WorkOrderService.get_work_orders(
            db=db,
            skip=skip,
            limit=limit,
            status=status_filter,
            client_id=client_uuid,
            technician_id=technician_uuid,
            start_date=start_datetime,
            end_date=end_datetime
        )
        
        wo_items = result["items"]
        primary_appt_by_wo = primary_appointments_by_work_order_ids(db, [w.id for w in wo_items])

        processed_items = []
        for work_order_model in wo_items: # work_order_model is an SQLAlchemy instance
            # Start with a dictionary from the SQLAlchemy model attributes
            # FastAPI's jsonable_encoder is good for converting SQLAlchemy models to dicts
            # that Pydantic can then validate and use, especially for Decimal and datetime.
            # However, we also have custom enrichment logic.
            
            # Let Pydantic handle the direct model-to-schema conversion first
            # This ensures Decimal fields are handled as per schema (e.g., to float)
            # and relationships like service_items are processed according to WorkOrderServiceResponse
            
            # The enrichment for client_name, etc., should ideally be part of the data
            # Pydantic serializes. We can add them to the WorkOrderResponse instance later
            # or ensure the ORM model has these via properties/hybrid_attributes if possible.

            # For now, let's try constructing the Pydantic object and then adding enriched fields
            # if they are not directly mapped by from_attributes.
            # A cleaner way is to make WorkOrderResponse handle this if data exists on model.
            
            # Create the base Pydantic response object from the ORM model
            # This should handle invoice_subtotal, invoice_tax, invoice_total, and service_items conversion
            wo_response_item = WorkOrderResponse.model_validate(work_order_model)

            # Apply enrichment. These fields are already in WorkOrderResponse schema.
            if work_order_model.client: # Assuming client relationship is loaded
                wo_response_item.client_name = work_order_model.client.display_name
                if work_order_model.client.user: # Assuming user relationship on client is loaded
                     wo_response_item.client_user = {
                         "id": str(work_order_model.client.user.id),
                         "full_name": work_order_model.client.user.full_name,
                         "email": work_order_model.client.user.email
                     }
            
            if work_order_model.technician: # Assuming technician relationship is loaded (from assigned_technician_id)
                if work_order_model.technician.user: # Assuming user relationship on technician is loaded
                    wo_response_item.technician_name = work_order_model.technician.user.full_name

            appt = primary_appt_by_wo.get(work_order_model.id)
            if appt:
                if wo_response_item.scheduled_start is None and appt.scheduled_start is not None:
                    wo_response_item.scheduled_start = appt.scheduled_start
                if wo_response_item.scheduled_end is None and appt.scheduled_end is not None:
                    wo_response_item.scheduled_end = appt.scheduled_end
                if wo_response_item.assigned_technician_id is None and appt.assigned_technician_id:
                    wo_response_item.assigned_technician_id = appt.assigned_technician_id
                if wo_response_item.technician_name is None:
                    tname = technician_display_name_from_appointment(appt)
                    if tname:
                        wo_response_item.technician_name = tname
                if wo_response_item.status == "pending":
                    wo_response_item.status = "scheduled"

            processed_items.append(wo_response_item)
        
        return WorkOrderListResponse(
            total=result["total"],
            page=page,
            pages=result["pages"],
            items=processed_items
        )
        
    except Exception as e:
        logger.error(f"[REQUEST-{request_id}] Error retrieving work orders: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving work orders: {str(e)}"
        )

@router.post("/work-orders", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    work_order: WorkOrderCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """Create a new work order (admin/manager only)"""
    logger.info(f"Creating new work order by user: {current_user.email}")
    
    try:
        # Prepare work order data
        work_order_data = work_order.dict()
        work_order_data["created_by"] = current_user.id
        
        # Create work order using the service
        created_work_order = await WorkOrderService.create_work_order(db, work_order_data)
        
        # Log the created work order details
        logger.info(f"Created new work order with ID: {created_work_order.id}")
        
        # Return the created work order directly
        return created_work_order
        
    except ValidationException as e:
        logger.warning(f"Validation error creating work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating work order: {str(e)}"
        )


@router.post(
    "/with-initial-appointment",
    response_model=WorkOrderWithInitialAppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_work_order_with_initial_appointment(
    payload: WorkOrderWithInitialAppointmentCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user),
):
    """
    Atomically create a work order and its first appointment (single DB transaction).
    """
    logger.info(f"Creating work order with initial appointment by user: {current_user.email}")
    try:
        work_order_data = (
            payload.model_dump(exclude={"initial_appointment"})
            if hasattr(payload, "model_dump")
            else payload.dict(exclude={"initial_appointment"})
        )
        work_order_data["created_by"] = current_user.id
        work_order, appointment = await WorkOrderService.create_work_order_with_initial_appointment(
            db,
            work_order_data,
            payload.initial_appointment,
            current_user.id,
        )
        return WorkOrderWithInitialAppointmentResponse(
            work_order=WorkOrderResponse.model_validate(work_order),
            appointment=WorkOrderAppointmentResponse.model_validate(appointment),
        )
    except ValidationException as e:
        logger.warning(f"Validation error creating work order with appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error creating work order with appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating work order with appointment: {str(e)}",
        )


@router.get("/work-orders/{work_order_id}", response_model=Dict[str, Any])
async def get_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order to retrieve"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get a specific work order by ID, including all its details and appointments.
    """
    try:
        # Check if user can access this work order
        can_access = await can_access_work_order(work_order_id, current_user, db)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this work order"
            )
                
        # Get the work order details using the service
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Calculate totals before returning the work order
        work_order.calculate_totals()
        
        # Convert to dict to easily manipulate
        response_dict = work_order.__dict__.copy()
        
        # Remove SQLAlchemy internal state
        if "_sa_instance_state" in response_dict:
            response_dict.pop("_sa_instance_state")
        
        # Add client name
        if work_order.client_id:
            client = db.query(Client).filter(Client.id == work_order.client_id).first()
            if client:
                response_dict["client_name"] = client.display_name
                
                # Also include the related User data if available
                if client.user_id:
                    user = db.query(UserModel).filter(UserModel.id == client.user_id).first()
                    if user:
                        response_dict["client_user"] = {
                            "id": str(user.id),
                            "email": user.email,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "phone": user.phone
                        }
        
        # Add technician name
        if work_order.assigned_technician_id:
            technician = db.query(Technician).filter(Technician.id == work_order.assigned_technician_id).first()
            if technician and technician.user_id:
                user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                if user:
                    response_dict["technician_name"] = f"{user.first_name} {user.last_name}"
                    response_dict["technician_user"] = {
                        "id": str(user.id),
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "phone": user.phone
                    }
        
        # Get the work order services, items, and parts
        from app.models.work_order import WorkOrderService as WorkOrderServiceModel, WorkOrderItem, WorkOrderPart
        services = db.query(WorkOrderServiceModel).filter(WorkOrderServiceModel.work_order_id == work_order_id).all()
        items = db.query(WorkOrderItem).filter(WorkOrderItem.work_order_id == work_order_id).all()
        parts = db.query(WorkOrderPart).filter(WorkOrderPart.work_order_id == work_order_id).all()
        
        # Add services, items, and parts to response
        response_dict["services"] = [
            {
                "id": str(service.id),
                "service_id": str(service.service_id),
                "appointment_id": str(service.appointment_id) if service.appointment_id else None,
                "name": service.name,
                "quantity": service.quantity,
                "unit_price": service.unit_price,
                "price": service.price,
                "notes": service.notes,
                "billing_status": service.billing_status,
                "service_definition": ServiceResponse.model_validate(service.service).model_dump() if service.service else None
            }
            for service in services
        ]
        
        response_dict["items"] = [
            {
                "id": str(item.id),
                "work_order_id": str(item.work_order_id),
                "description": item.description,
                "quantity": item.quantity,
                "price": item.price,
                "notes": item.notes,
                "total": item.total,
                "created_at": item.created_at.isoformat() if hasattr(item, "created_at") else None
            }
            for item in items
        ]
        
        response_dict["parts"] = [
            {
                "id": str(part.id),
                "work_order_id": str(part.work_order_id),
                "number": part.number,
                "description": part.description,
                "cost": part.cost,
                "price": part.price,
                "vendor": part.vendor,
                "status": part.status,
                "tracking_number": part.tracking_number,
                "notes": part.notes,
                "markup_percentage": part.markup_percentage,
                "amount_upfront_collected": float(part.amount_upfront_collected or 0),
                "tax_collected": float(part.tax_collected or 0),
                "created_at": part.created_at.isoformat() if hasattr(part, "created_at") else None,
                "updated_at": part.updated_at.isoformat() if hasattr(part, "updated_at") else None
            }
            for part in parts
        ]
        
        # Get and add appointments to response
        from app.models.work_order import WorkOrderAppointment
        appointments = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.work_order_id == work_order_id).all()
        
        appointment_list = []
        for appointment in appointments:
            # Convert appointment to dict
            appointment_dict = appointment.__dict__.copy()
            
            # Remove SQLAlchemy internal state
            if "_sa_instance_state" in appointment_dict:
                appointment_dict.pop("_sa_instance_state")
            
            # Add technician name if assigned
            if appointment.assigned_technician_id:
                technician = db.query(Technician).filter(Technician.id == appointment.assigned_technician_id).first()
                if technician and technician.user_id:
                    user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                    if user:
                        appointment_dict["technician_name"] = f"{user.first_name} {user.last_name}"
            
            # Add services from the eagerly loaded relationship
            appointment_dict["services"] = [
                {
                    "id": str(svc.id),
                    "name": svc.name,
                    "sku_code": svc.sku_code,
                    "duration_minutes": svc.duration_minutes,
                    "base_price": float(svc.base_price) if svc.base_price else None,
                }
                for svc in (appointment.services or [])
            ]
            
            # Convert UUID and datetime for JSON serialization
            for key, value in appointment_dict.items():
                if isinstance(value, uuid.UUID):
                    appointment_dict[key] = str(value)
                elif isinstance(value, datetime):
                    appointment_dict[key] = value.isoformat()
            
            # Convert UUID objects to strings for JSON serialization
            for key, value in appointment_dict.items():
                if isinstance(value, uuid.UUID):
                    appointment_dict[key] = str(value)
                elif isinstance(value, datetime):
                    appointment_dict[key] = value.isoformat()
            
            appointment_list.append(appointment_dict)
        
        response_dict["appointments"] = appointment_list

        # Effective status when DB still has pending but non-canceled appointment(s) exist
        if appointments:
            non_canceled = [
                a for a in appointments
                if (a.status.value if hasattr(a.status, "value") else str(a.status)) != "canceled"
            ]
            if non_canceled:
                wo_st = (
                    work_order.status.value
                    if hasattr(work_order.status, "value")
                    else str(work_order.status)
                )
                if wo_st == "pending":
                    response_dict["status"] = "scheduled"
        
        # Get and add notes to response
        from app.models.work_order import WorkOrderNote
        notes = db.query(WorkOrderNote).filter(WorkOrderNote.work_order_id == work_order_id).all()
        
        notes_list = []
        for note in notes:
            # Convert note to dict
            note_dict = note.__dict__.copy()
            
            # Remove SQLAlchemy internal state
            if "_sa_instance_state" in note_dict:
                note_dict.pop("_sa_instance_state")
            
            # Add user name
            if note.user_id:
                user = db.query(UserModel).filter(UserModel.id == note.user_id).first()
                if user:
                    note_dict["user_name"] = f"{user.first_name} {user.last_name}"
            
            # Convert UUID objects to strings for JSON serialization
            for key, value in note_dict.items():
                if isinstance(value, uuid.UUID):
                    note_dict[key] = str(value)
                elif isinstance(value, datetime):
                    note_dict[key] = value.isoformat()
            
            notes_list.append(note_dict)
        
        response_dict["notes"] = notes_list
        
        # Convert any remaining UUID objects to strings for JSON serialization
        for key, value in response_dict.items():
            if isinstance(value, uuid.UUID):
                response_dict[key] = str(value)
            elif isinstance(value, datetime):
                response_dict[key] = value.isoformat()
        
        return response_dict
        
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error retrieving work order: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving work order: {str(e)}"
        )

@router.put("/{work_order_id}", response_model=WorkOrderResponse)
async def update_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order to update"),
    work_order_update: WorkOrderUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Update a work order.
    Only admins and managers can update work orders.
    """
    # Get the work order
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    
    # Update the work order
    updated_work_order = await WorkOrderService.update_work_order(
        db, 
        work_order_id, 
        work_order_update
    )
    
    # Convert to response model
    return WorkOrderResponse.model_validate(updated_work_order)

@router.delete("/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order to delete"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
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

@router.put("/{work_order_id}/status", response_model=WorkOrderResponse)
async def update_work_order_status(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    status_update: WorkOrderStatusUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update a work order's status"""
    # Debug logging
    logger.info(f"DEBUG: update_work_order_status called with work_order_id={work_order_id}")
    logger.info(f"DEBUG: status_update={status_update}")
    logger.info(f"DEBUG: current_user={current_user.email}")
    
    # Check permissions directly
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this work order"
        )
    
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    
    # Additional permissions check based on role and status change
    if "technician" in current_user.roles:
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
    elif "client" in current_user.roles:
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

@router.post("/{work_order_id}/assign", response_model=WorkOrderResponse)
async def assign_work_order(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    assignment: WorkOrderAssign = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
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

@router.get("/{work_order_id}/timeline", response_model=List[Dict[str, Any]])
async def get_work_order_timeline(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get the timeline of events for a work order"""
    # Check permissions directly
    can_access = await can_access_work_order(work_order_id, current_user, db)
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
    status_filter: Optional[str] = Query(None, description="Filter by status"),
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
            status=status_filter,
            client_id=None,
            technician_id=None,
            start_date=None,
            end_date=None
        )
        
        # Format the response to match the expected schema
        response = {
            "total": result["total"],
            "page": page,
            "pages": result.get("pages", (result["total"] + limit - 1) // limit if limit > 0 else 0),
            "items": result["items"]
        }
        
        logger.info(f"Successfully retrieved {len(result['items'])} work orders out of {result['total']} for demo")
        return response
    except Exception as e:
        logger.error(f"Error retrieving work orders for demo: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving work orders: {str(e)}"
        )

@router.get("/work-orders-headers-debug")
async def debug_work_orders_headers(request: Request):
    """Debug endpoint to see all request headers"""
    headers = dict(request.headers)
    auth_header = headers.get("authorization", "Not found")
    
    # Log the full headers for debugging
    logger.info(f"DEBUG Headers received: {headers}")
    logger.info(f"DEBUG Authorization header: {auth_header}")
    
    return {
        "headers": headers,
        "authorization": auth_header,
        "has_auth_header": "authorization" in headers,
        "method": request.method,
        "path": request.url.path,
        "query_params": dict(request.query_params)
    }

@router.get("/work-orders-token-debug")
async def debug_token_verification(request: Request, db: Session = Depends(get_db)):
    """Debug endpoint to verify token directly and log detailed information"""
    request_id = str(uuid.uuid4())
    logger.info(f"Request ID: {request_id} - Token debug endpoint called")
    
    # Log all headers for debugging
    headers = dict(request.headers)
    logger.info(f"Request ID: {request_id} - All headers: {headers}")
    
    # Get Authorization header (try different forms)
    auth_header = headers.get("Authorization") or headers.get("authorization")
    
    if not auth_header:
        # Try the raw request headers as a last resort
        raw_headers = request.scope.get('headers', [])
        logger.info(f"Request ID: {request_id} - Raw headers: {raw_headers}")
        
        for key, value in raw_headers:
            try:
                key_str = key.decode('utf-8').lower()
                if key_str == 'authorization':
                    value_str = value.decode('utf-8')
                    auth_header = value_str
                    logger.info(f"Request ID: {request_id} - Found Authorization in raw headers: {auth_header[:15]}...")
                    break
            except Exception as e:
                logger.error(f"Request ID: {request_id} - Error decoding header: {str(e)}")
                continue
    
    if not auth_header:
        return {
            "status": "error",
            "message": "No authorization header found",
            "headers_received": headers
        }
    
    # Log the full Authorization header for debugging
    logger.info(f"Request ID: {request_id} - Full Authorization header: {auth_header}")
    
    # Check for duplicated tokens (e.g., comma separated)
    has_multiple_tokens = "," in auth_header and "Bearer" in auth_header and auth_header.count("Bearer") > 1
    
    # Handle complex token formats
    token = None
    try:
        if has_multiple_tokens:
            logger.warning(f"Request ID: {request_id} - Found multiple Bearer tokens in header")
            # Split and try each part
            parts = auth_header.split(",")
            potential_tokens = []
            
            for part in parts:
                part = part.strip()
                if part.startswith("Bearer "):
                    scheme, extracted_token = part.split(None, 1)
                    potential_tokens.append(extracted_token)
                    logger.info(f"Request ID: {request_id} - Found potential token: {extracted_token[:10]}...")
            
            if potential_tokens:
                # Try to verify each token
                for i, potential_token in enumerate(potential_tokens):
                    try:
                        logger.info(f"Request ID: {request_id} - Attempting to verify token {i+1}/{len(potential_tokens)}")
                        token_data = await auth_handler.verify_token(potential_token)
                        logger.info(f"Request ID: {request_id} - Successfully verified token {i+1}: {token_data.sub}")
                        token = potential_token
                        break
                    except Exception as e:
                        logger.warning(f"Request ID: {request_id} - Failed to verify token {i+1}: {str(e)}")
            else:
                logger.warning(f"Request ID: {request_id} - No valid tokens found in multiple-token header")
        else:
            # Standard token extraction
            if auth_header.startswith("Bearer "):
                scheme, token = auth_header.split(None, 1)
                logger.info(f"Request ID: {request_id} - Extracted token with Bearer prefix")
            else:
                # Raw token without Bearer
                token = auth_header
                logger.info(f"Request ID: {request_id} - Using raw token (no Bearer prefix)")
        
        if not token:
            return {
                "status": "error",
                "message": "Could not extract token from authorization header",
                "auth_header": auth_header[:15] + "...",
                "has_multiple_tokens": has_multiple_tokens
            }
        
        # Log token info
        logger.info(f"Request ID: {request_id} - Extracted token: {token[:10]}...")
        logger.info(f"Request ID: {request_id} - Token length: {len(token)}")
        
        # Attempt to verify the token
        try:
            token_data = await auth_handler.verify_token(token)
            
            # If we get here, token is valid
            logger.info(f"Request ID: {request_id} - Token verified successfully: {token_data.sub}")
            
            # Look up user
            user = db.query(UserModel).filter(UserModel.auth_id == token_data.sub).first()
            
            if user:
                logger.info(f"Request ID: {request_id} - Found user: {user.id}, roles: {user.roles}")
                return {
                    "status": "success",
                    "message": "Token verified successfully",
                    "token_sub": token_data.sub,
                    "token_length": len(token),
                    "user_found": True,
                    "user_id": str(user.id),
                    "user_roles": user.roles,
                    "has_multiple_tokens": has_multiple_tokens
                }
            else:
                logger.warning(f"Request ID: {request_id} - Token verified but user not found for sub: {token_data.sub}")
                return {
                    "status": "error",
                    "message": "Token valid but user not found in database",
                    "token_sub": token_data.sub,
                    "user_found": False,
                    "has_multiple_tokens": has_multiple_tokens
                }
        except Exception as e:
            logger.error(f"Request ID: {request_id} - Token verification failed: {str(e)}")
            return {
                "status": "error",
                "message": f"Token verification failed: {str(e)}",
                "token_length": len(token),
                "token_prefix": token[:10] + "..." if token else None,
                "has_multiple_tokens": has_multiple_tokens
            }
    except Exception as e:
        logger.error(f"Request ID: {request_id} - Error processing token: {str(e)}")
        return {
            "status": "error",
            "message": f"Error processing token: {str(e)}",
            "auth_header_sample": auth_header[:30] + "..." if len(auth_header) > 30 else auth_header,
            "has_multiple_tokens": has_multiple_tokens
        }

@router.get("/{work_order_id}/appointments", response_model=Dict[str, Any])
async def list_work_order_appointments(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    status_filter: Optional[str] = Query(None, description="Filter by appointment status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    List appointments for a specific work order with optional status filtering.
    """
    # Check if user can access this work order
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this work order"
        )
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    
    try:
        # Get appointments from the service
        result = await WorkOrderService.get_work_order_appointments(
            db=db,
            work_order_id=work_order_id,
            skip=skip,
            limit=limit,
            status=status_filter
        )
        
        # Enrich appointments - build clean dicts to avoid SQLAlchemy relationship serialization issues
        enriched_items = []
        for appointment in result["items"]:
            appointment_dict = {
                "id": str(appointment.id),
                "work_order_id": str(appointment.work_order_id),
                "appointment_type": appointment.appointment_type,
                "status": appointment.status.value if hasattr(appointment.status, 'value') else appointment.status,
                "scheduled_start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
                "scheduled_end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
                "actual_start": appointment.actual_start.isoformat() if appointment.actual_start else None,
                "actual_end": appointment.actual_end.isoformat() if appointment.actual_end else None,
                "assigned_technician_id": str(appointment.assigned_technician_id) if appointment.assigned_technician_id else None,
                "notes": appointment.notes,
                "travel_time_before": appointment.travel_time_before,
                "travel_time_after": appointment.travel_time_after,
                "travel_distance_before": appointment.travel_distance_before,
                "travel_distance_after": appointment.travel_distance_after,
                "is_forced_schedule": appointment.is_forced_schedule,
                "time_window": appointment.time_window,
                "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
                "updated_at": appointment.updated_at.isoformat() if appointment.updated_at else None,
                "created_by": str(appointment.created_by) if appointment.created_by else None,
                "updated_by": str(appointment.updated_by) if appointment.updated_by else None,
                "service_ids": [str(svc.id) for svc in (appointment.services or [])],
                "services": [
                    {
                        "id": str(svc.id),
                        "name": svc.name,
                        "sku_code": svc.sku_code,
                        "duration_minutes": svc.duration_minutes,
                        "base_price": float(svc.base_price) if svc.base_price else None,
                    }
                    for svc in (appointment.services or [])
                ],
            }
            if appointment.assigned_technician_id:
                technician = db.query(Technician).filter(Technician.id == appointment.assigned_technician_id).first()
                if technician and technician.user_id:
                    user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                    if user:
                        appointment_dict["technician_name"] = f"{user.first_name} {user.last_name}"
            enriched_items.append(appointment_dict)
        
        result["items"] = enriched_items
        
        return result
    
    except Exception as e:
        logger.error(f"Error listing work order appointments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving appointments: {str(e)}"
        )

@router.post("/{work_order_id}/appointments", response_model=WorkOrderAppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order_appointment(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    appointment: WorkOrderAppointmentCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Create a new appointment for a work order.
    Only administrators and managers can create appointments.
    """
    # Ensure the work_order_id in the path matches the one in the request body
    if appointment.work_order_id != work_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Work order ID in the path must match the one in the request body"
        )
    
    try:
        # Create an instance of WorkOrderService and create the appointment
        work_order_service = WorkOrderService(db)
        result = await work_order_service.create_work_order_appointment(
            appointment_data=appointment,
            user_id=current_user.id
        )
        
        # Convert to dict to easily manipulate
        appointment_dict = result.__dict__.copy()
        
        # Remove SQLAlchemy internal state
        if "_sa_instance_state" in appointment_dict:
            appointment_dict.pop("_sa_instance_state")
        
        # Add technician name if assigned
        if result.assigned_technician_id:
            technician = db.query(Technician).filter(Technician.id == result.assigned_technician_id).first()
            if technician and technician.user_id:
                user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                if user:
                    appointment_dict["technician_name"] = f"{user.first_name} {user.last_name}"
        
        return appointment_dict
    
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating work order appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating appointment: {str(e)}"
        )

@router.get(
    "/appointments/schedule",
    response_model=List[WorkOrderAppointmentResponse],
    summary="Get Technician Schedule for a Date",
    tags=["appointments", "technicians", "schedule"]
)
def get_technician_schedule(
    technician_id: UUID4 = Query(..., description="ID of the technician whose schedule is being requested"),
    schedule_date: py_date = Query(..., description="The specific date for the schedule (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Get all appointments for a technician on a specific date across all work orders.
    This is used for schedule planning and conflict checking.
    """
    logger.info(f"Fetching schedule for technician {technician_id} on date {schedule_date} by user {current_user.email}")
    
    try:
        # Validate technician_id
        technician = db.get(Technician, technician_id)
        if not technician:
            logger.warning(f"Technician with ID {technician_id} not found.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Technician with ID {technician_id} not found."
            )

        logger.info(f"Attempting to fetch appointments for technician {technician_id} on {schedule_date}")
        
        start_of_day = datetime.combine(schedule_date, datetime.min.time())
        end_of_day = datetime.combine(schedule_date, datetime.max.time())

        stmt = (
            select(WorkOrderAppointment)
            .where(WorkOrderAppointment.assigned_technician_id == technician_id)
            .where(WorkOrderAppointment.scheduled_start >= start_of_day)
            .where(WorkOrderAppointment.scheduled_start <= end_of_day)
            .order_by(WorkOrderAppointment.scheduled_start)
        )
        result = db.execute(stmt)
        appointments = result.scalars().all()

        logger.info(f"Found {len(appointments)} appointments for technician {technician_id} on {schedule_date}.")
        
        response_appointments = []
        for appt in appointments:
            response_appointments.append(WorkOrderAppointmentResponse.model_validate(appt))
            
        return response_appointments
        
    except HTTPException: 
        raise
    except ValueError as e: 
        logger.error(f"ValueError during schedule fetch: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameter format: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching schedule for technician {technician_id} on {schedule_date}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while fetching the schedule: {str(e)}"
        )

@router.get("/appointments/{appointment_id}", response_model=WorkOrderAppointmentResponse)
async def get_work_order_appointment(
    appointment_id: uuid.UUID = Path(..., description="The ID of the appointment"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get a specific appointment by ID.
    """
    try:
        # Get the appointment from the service
        appointment = await WorkOrderService.get_work_order_appointment(db, appointment_id)
        
        # Check if user can access the related work order
        can_access = await can_access_work_order(appointment.work_order_id, current_user, db)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this appointment"
            )
        
        # Convert to dict to easily manipulate
        appointment_dict = appointment.__dict__.copy()
        
        # Remove SQLAlchemy internal state
        if "_sa_instance_state" in appointment_dict:
            appointment_dict.pop("_sa_instance_state")
        
        # Add technician name if assigned
        if appointment.assigned_technician_id:
            technician = db.query(Technician).filter(Technician.id == appointment.assigned_technician_id).first()
            if technician and technician.user_id:
                user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                if user:
                    appointment_dict["technician_name"] = f"{user.first_name} {user.last_name}"
        
        return appointment_dict
    
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error retrieving work order appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving appointment: {str(e)}"
        )

@router.put("/appointments/{appointment_id}", response_model=WorkOrderAppointmentResponse)
async def update_work_order_appointment(
    appointment_id: uuid.UUID = Path(..., description="The ID of the appointment"),
    appointment_update: WorkOrderAppointmentUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Update an existing appointment.
    Administrators and managers can update all appointment fields.
    Technicians can only update status to completed for their own appointments.
    """
    try:
        # Check permissions based on user role
        if "technician" in current_user.roles:
            # Technicians can only update status to completed, and only for their own appointments
            appointment = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.id == appointment_id).first()
            if not appointment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Appointment with ID {appointment_id} not found"
                )
            
            # Get technician record for current user
            technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
            if not technician:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Technician profile not found"
                )
            
            # Check if this is the technician's appointment
            if appointment.assigned_technician_id != technician.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Technicians can only update their own appointments"
                )
            
            # Check if technician is only updating status to completed
            update_data = appointment_update.model_dump(exclude_unset=True)
            if len(update_data) > 1 or ('status' in update_data and update_data['status'] != 'completed'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Technicians can only update appointment status to completed"
                )
        
        elif not any(role in ["admin", "manager"] for role in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin, manager, or technician role required"
            )
        # Create an instance of the WorkOrderService and update the appointment
        logger.info(f"DEBUG update_appointment: raw update data = {appointment_update.model_dump(exclude_unset=True)}")
        work_order_service = WorkOrderService(db)
        result = await work_order_service.update_work_order_appointment(
            appointment_id=appointment_id,
            appointment_data=appointment_update,
            user_id=current_user.id
        )
        
        # Handle sophisticated billing status changes based on appointment status
        if hasattr(appointment_update, 'status') and appointment_update.status:
            new_status = appointment_update.status
            logging.info(f"DEBUG: Appointment status being updated to: {new_status}")
            
            from app.models.work_order import WorkOrderService as WorkOrderServiceModel
            
            # Get the appointment to find the work order
            appointment = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.id == appointment_id).first()
            if appointment:
                work_order_id = appointment.work_order_id
                logging.info(f"DEBUG: Found appointment for work order {work_order_id}")
                
                # Get services specifically linked to this appointment via the many-to-many association
                from app.models.work_order import appointment_services_association
                from app.models.service import Service
                
                # Get service IDs linked to this appointment
                linked_service_ids = db.execute(
                    appointment_services_association.select().where(
                        appointment_services_association.c.appointment_id == appointment_id
                    )
                ).fetchall()
                linked_service_ids = [row.service_id for row in linked_service_ids]
                
                # Get WorkOrderService records for only those services on this work order
                services = []
                if linked_service_ids:
                    services = db.query(WorkOrderServiceModel).filter(
                        WorkOrderServiceModel.work_order_id == work_order_id,
                        WorkOrderServiceModel.service_id.in_(linked_service_ids)
                    ).all()
                
                logging.info(f"DEBUG: Found {len(services)} services linked to appointment {appointment_id}")
                
                # Get the work order
                work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == work_order_id).first()
                
                if new_status == 'phone_payment':
                    # Phone Payment → Billable: Make services billable
                    logging.info(f"DEBUG: Status changed to phone_payment, making services billable")
                    for service in services:
                        if service.billing_status == 'not_billable':
                            logging.info(f"DEBUG: Updating service {service.id} from {service.billing_status} to billable")
                            service.billing_status = 'billable'
                
                elif new_status == 'completed':
                    # Completed → Billable: Make services billable (same as phone_payment)
                    logging.info(f"DEBUG: Status changed to completed, making services billable")
                    for service in services:
                        if service.billing_status == 'not_billable':
                            logging.info(f"DEBUG: Updating service {service.id} from {service.billing_status} to billable")
                            service.billing_status = 'billable'
                
                elif new_status == 'refund':
                    # Refund → Revert: Revert paid services back to billable, billable services to not_billable
                    logging.info(f"DEBUG: Status changed to refund, reverting billing statuses")
                    
                    for service in services:
                        if service.billing_status == 'paid':
                            logging.info(f"DEBUG: Reverting paid service {service.id} back to billable")
                            service.billing_status = 'billable'
                        elif service.billing_status == 'billable':
                            logging.info(f"DEBUG: Reverting billable service {service.id} back to not_billable")
                            service.billing_status = 'not_billable'
                
                else:
                    # Any other status change → Revert: Revert billable services to not_billable (not paid ones)
                    logging.info(f"DEBUG: Status changed to {new_status}, reverting billable services")
                    
                    for service in services:
                        if service.billing_status == 'billable':
                            logging.info(f"DEBUG: Reverting billable service {service.id} back to not_billable")
                            service.billing_status = 'not_billable'
                        # Leave paid services and not_billable services unchanged
                
                # Recalculate work order totals after any billing status changes
                if work_order:
                    logging.info(f"DEBUG: Recalculating totals for work order {work_order.id}")
                    work_order.calculate_totals()
                
                db.commit()
                logging.info(f"DEBUG: Successfully updated billing statuses and committed changes")
            else:
                logging.info(f"DEBUG: No appointment found with ID {appointment_id}")
        else:
            logging.info(f"DEBUG: No status update provided")
        
        # Add technician name if assigned
        if result.assigned_technician_id:
            technician = db.query(Technician).filter(Technician.id == result.assigned_technician_id).first()
            if technician and technician.user_id:
                user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                if user:
                    # Add technician name as a dynamic attribute
                    result.technician_name = f"{user.first_name} {user.last_name}"
        
        return result
    
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating work order appointment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating appointment: {str(e)}"
        )

@router.delete("/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order_appointment(
    appointment_id: uuid.UUID = Path(..., description="The ID of the appointment"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """Delete a work order appointment"""
    logger.info(f"Attempting to delete appointment ID: {appointment_id} by user: {current_user.email}")
    try:
        # Ensure the user has permission to manage appointments
        if not any(role in ["admin", "manager"] for role in current_user.roles):
            logger.warning(f"User {current_user.email} does not have permission to delete appointment {appointment_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="User does not have permission to delete appointments"
            )

        # Instantiate the service
        work_order_service = WorkOrderService(db)
        
        # Use the instance method to delete the appointment
        deleted = await work_order_service.delete_work_order_appointment(appointment_id=appointment_id)
        
        if not deleted:
            # This case should ideally be handled by NotFoundException within the service method
            logger.error(f"Service reported appointment {appointment_id} not found or deletion failed.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment with ID {appointment_id} not found or could not be deleted."
            )
        
        logger.info(f"Successfully deleted appointment ID: {appointment_id}")

    except NotFoundException as e:
        logger.error(f"NotFoundException while deleting appointment {appointment_id}: {e}")

@router.get("/{work_order_id}/notes", response_model=List[WorkOrderNoteResponse])
async def list_work_order_notes_v2(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    include_private: bool = Query(True, description="Whether to include private notes"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    List notes for a specific work order.
    Private notes are only visible to staff (admins, managers, and technicians).
    """
    # Check if user can access this work order
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this work order"
        )
    
    # Clients cannot see private notes
    if "client" in current_user.roles:
        include_private = False
    
    try:
        # Get notes from the service
        notes = await WorkOrderService.get_work_order_notes(
            db=db,
            work_order_id=work_order_id,
            include_private=include_private
        )
        
        # Enrich notes with user names
        enriched_notes = []
        for note in notes:
            # Convert to dict to easily manipulate
            note_dict = note.__dict__.copy()
            
            # Remove SQLAlchemy internal state
            if "_sa_instance_state" in note_dict:
                note_dict.pop("_sa_instance_state")
            
            # Add user name
            if note.user_id:
                user = db.query(UserModel).filter(UserModel.id == note.user_id).first()
                if user:
                    note_dict["user_name"] = f"{user.first_name} {user.last_name}"
            
            # Convert UUID and datetime objects for JSON serialization
            for key, value in note_dict.items():
                if isinstance(value, uuid.UUID):
                    note_dict[key] = str(value)
                elif isinstance(value, datetime):
                    note_dict[key] = value.isoformat()
            
            enriched_notes.append(note_dict)
        
        return enriched_notes
    
    except Exception as e:
        logger.error(f"Error listing work order notes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving notes: {str(e)}"
        )

@router.post("/{work_order_id}/notes", response_model=WorkOrderNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order_note_v2(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    note: WorkOrderNoteCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Create a new note for a work order.
    Private notes can only be created by staff (admins, managers, and technicians).
    """
    # Check if user can access this work order
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this work order"
        )
    
    # Clients cannot create private notes
    if "client" in current_user.roles and note.is_private:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients cannot create private notes"
        )
    
    try:
        # Create the note using the service
        result = await WorkOrderService.create_work_order_note(
            db=db,
            work_order_id=work_order_id,
            user_id=current_user.id,
            note_text=note.note,
            is_private=note.is_private
        )
        
        # Convert to dict to easily manipulate
        note_dict = result.__dict__.copy()
        
        # Remove SQLAlchemy internal state
        if "_sa_instance_state" in note_dict:
            note_dict.pop("_sa_instance_state")
        
        # Add user name
        if result.user_id:
            user = db.query(UserModel).filter(UserModel.id == result.user_id).first()
            if user:
                note_dict["user_name"] = f"{user.first_name} {user.last_name}"
        
        # Convert UUID and datetime objects for JSON serialization
        for key, value in note_dict.items():
            if isinstance(value, uuid.UUID):
                note_dict[key] = str(value)
            elif isinstance(value, datetime):
                note_dict[key] = value.isoformat()
        
        return note_dict
    
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating work order note: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating note: {str(e)}"
        )

@router.post("/admin/migrate-work-order-schedules", status_code=status.HTTP_200_OK)
async def migrate_work_order_schedules(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)  # Only admins can access
):
    """
    Migrate all work orders with scheduled_start/end times to have corresponding appointments.
    This is an admin-only endpoint that helps transition the system from using the work order
    scheduled times to using the appointments table.
    """
    logger.info(f"Starting migration of work order schedules by user: {current_user.email}")
    
    try:
        # Get all work orders with scheduled times but no appointments
        work_orders_with_schedule = db.query(WorkOrderModel).filter(
            WorkOrderModel.scheduled_start.isnot(None)
        ).all()
        
        logger.info(f"Found {len(work_orders_with_schedule)} work orders with scheduled times")
        
        migrated_count = 0
        
        for work_order in work_orders_with_schedule:
            # Check if this work order already has appointments
            existing_appointments = db.query(WorkOrderAppointment).filter(
                WorkOrderAppointment.work_order_id == work_order.id
            ).count()
            
            if existing_appointments > 0:
                logger.info(f"Work order {work_order.id} already has {existing_appointments} appointments, skipping")
                continue
                
            if not work_order.scheduled_start:
                logger.info(f"Work order {work_order.id} has no scheduled_start, skipping")
                continue
                
            # If work order has schedule but no appointments, create one
            appointment_data = WorkOrderAppointmentCreate(
                work_order_id=work_order.id,
                appointment_type="diagnostic",  # Default type
                status="scheduled",  # Using the status field defined in the schema
                scheduled_start=work_order.scheduled_start,
                scheduled_end=work_order.scheduled_end or work_order.scheduled_start + timedelta(hours=1),
                assigned_technician_id=work_order.assigned_technician_id,
                notes="Auto-created from work order schedule during migration"
            )
            
            logger.info(f"Creating appointment for work order {work_order.id}")
            
            # Create the appointment
            _wo_svc = WorkOrderService(db)
            appointment = await _wo_svc.create_work_order_appointment(
                appointment_data=appointment_data,
                user_id=current_user.id
            )
            
            if appointment:
                migrated_count += 1
                logger.info(f"Successfully created appointment {appointment.id} for work order {work_order.id}")
            
        return {
            "message": f"Migration completed. Created {migrated_count} appointments from work order schedules.",
            "migrated": migrated_count
        }
        
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during migration: {str(e)}"
        )

@router.post("/work-orders/{work_order_id}/create-appointment-from-schedule", status_code=status.HTTP_201_CREATED)
async def create_appointment_from_schedule(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Create an appointment entry from a work order's scheduled_start/end times.
    This helps transition from using work order schedule to using the appointments system.
    """
    logger.info(f"Creating appointment from schedule for work order {work_order_id}")
    
    # Check if user can access this work order
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this work order"
        )
    
    try:
        # Get the work order
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        if not work_order.scheduled_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Work order has no scheduled start time"
            )
        
        # Check if this work order already has appointments
        existing_appointments = db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.work_order_id == work_order_id
        ).count()
        
        if existing_appointments > 0:
            logger.info(f"Work order {work_order_id} already has {existing_appointments} appointments")
            return {
                "message": f"Work order already has {existing_appointments} appointments. No new appointment created.",
                "existing_count": existing_appointments
            }
        
        # Create appointment data from the work order schedule
        appointment_data = WorkOrderAppointmentCreate(
            work_order_id=work_order_id,
            appointment_type="diagnostic",  # Default type
            status="scheduled",  # Using the status field defined in the schema
            scheduled_start=work_order.scheduled_start,
            scheduled_end=work_order.scheduled_end or work_order.scheduled_start + timedelta(hours=1),
            assigned_technician_id=work_order.assigned_technician_id,
            notes="Created from work order schedule"
        )
        
        # Create the appointment
        _wo_svc = WorkOrderService(db)
        appointment = await _wo_svc.create_work_order_appointment(
            appointment_data=appointment_data,
            user_id=current_user.id
        )
        
        logger.info(f"Created appointment {appointment.id} for work order {work_order_id}")
        
        return {
            "message": "Appointment created successfully from work order schedule",
            "appointment_id": str(appointment.id)
        }
        
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating appointment from schedule: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating appointment: {str(e)}"
        )

# Parts management endpoints
@router.get("/{work_order_id}/parts", response_model=List[WorkOrderPartResponse])
async def get_work_order_parts(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all parts for a work order"""
    # Check if work order exists
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    
    # Get parts
    parts = db.query(WorkOrderPart).filter(WorkOrderPart.work_order_id == work_order_id).all()
    
    return parts


@router.post("/{work_order_id}/parts", response_model=WorkOrderPartResponse)
async def create_work_order_part(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    part: WorkOrderPartCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new part for a work order"""
    # Check if work order exists
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    
    # Create part
    new_part = WorkOrderPart(
        work_order_id=work_order_id,
        number=part.number,
        description=part.description,
        cost=part.cost,
        price=part.price,
        vendor=part.vendor,
        status=part.status,
        tracking_number=part.tracking_number,
        notes=part.notes,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_part)
    db.commit()
    db.refresh(new_part)
    
    return new_part


@router.put("/parts/{part_id}", response_model=WorkOrderPartResponse)
async def update_work_order_part(
    part_id: uuid.UUID = Path(..., description="The ID of the part"),
    part_update: WorkOrderPartUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update a part for a work order"""
    part = db.query(WorkOrderPart).filter(WorkOrderPart.id == part_id).first()
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Part with ID {part_id} not found"
        )
    
    update_data = part_update.dict(exclude_unset=True)
    new_status = update_data.get('status', part.status)
    price = float(update_data.get('price', part.price or 0))
    
    # Get work order for tax rate
    work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == part.work_order_id).first()
    tax_rate = float(work_order.tax_rate) if work_order and work_order.tax_rate else 0.0775
    
    # Payment-triggering statuses — calculate and record tax
    PAYMENT_STATUSES = ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed']
    
    if new_status in PAYMENT_STATUSES and new_status != part.status:
        if new_status == 'phone_payment':
            # Full price + tax collected upfront (committing to order)
            tax_amt = round(price * tax_rate, 2)
            update_data['tax_collected'] = tax_amt
            update_data['amount_upfront_collected'] = price
        elif new_status == 'paid_not_installed':
            # Money actually in hand — add price + tax to work order amount_previously_paid
            tax_amt = round(price * tax_rate, 2)
            update_data['tax_collected'] = tax_amt
            update_data['amount_upfront_collected'] = price
            if work_order:
                work_order.amount_previously_paid = float(work_order.amount_previously_paid or 0) + price + tax_amt
                work_order.tax_collected = float(work_order.tax_collected or 0) + tax_amt
        elif new_status == 'upfront_50':
            half = round(price * 0.5, 2)
            tax_amt = round(half * tax_rate, 2)
            update_data['tax_collected'] = tax_amt
            update_data['amount_upfront_collected'] = half
        elif new_status == 'installed':
            # Remaining balance due including remaining tax
            already_collected = float(part.amount_upfront_collected or 0)
            already_taxed = float(part.tax_collected or 0)
            remaining = price - already_collected
            remaining_tax = round(remaining * tax_rate, 2)
            new_tax_total = already_taxed + remaining_tax
            update_data['tax_collected'] = new_tax_total
    elif new_status in ['needed', 'ordered', 'received', 'not_installed']:
        # Reset on non-payment statuses
        update_data['amount_upfront_collected'] = 0
        update_data['tax_collected'] = 0
    
    for key, value in update_data.items():
        setattr(part, key, value)
    
    part.updated_by = current_user.id
    part.updated_at = datetime.utcnow()
    
    db.add(part)
    db.commit()
    db.refresh(part)
    
    return part


@router.delete("/parts/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order_part(
    part_id: uuid.UUID = Path(..., description="The ID of the part"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a part for a work order"""
    # Check if part exists
    part = db.query(WorkOrderPart).filter(WorkOrderPart.id == part_id).first()
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Part with ID {part_id} not found"
        )
    
    # Delete part
    db.delete(part)
    db.commit()
    
    return None

# Equipment details endpoint
@router.put("/{work_order_id}/equipment", response_model=WorkOrderResponse)
async def update_work_order_equipment(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    equipment_update: dict = Body(..., 
        example={
            "equipment_make": "Samsung",
            "equipment_model": "UN55TU7000",
            "equipment_serial": "XYZ123456",
            "equipment_version": "A",
            "equipment_type": "tv",
            "equipment_subtype": "under_50",
            "is_wall_mounted": True,
            "equipment_notes": "55-inch TV, wall mounted in living room"
        }
    ),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update equipment details for a work order"""
    # Check if work order exists
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    
    # Validate user has access to this work order
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this work order"
        )
    
    # Update equipment fields
    allowed_fields = [
        "equipment_make", "equipment_model", "equipment_serial", "equipment_version",
        "equipment_type", "equipment_subtype", "is_wall_mounted", "equipment_notes"
    ]
    
    for field in allowed_fields:
        if field in equipment_update:
            setattr(work_order, field, equipment_update[field])
    
    # Update audit fields
    work_order.updated_by = current_user.id
    work_order.updated_at = datetime.utcnow()
    
    db.add(work_order)
    db.commit()
    db.refresh(work_order)
    
    # Format the response
    response = WorkOrderResponse.from_orm(work_order)
    
    # Add client name if available
    if work_order.client_id:
        client = db.query(Client).filter(Client.id == work_order.client_id).first()
        if client:
            response.client_name = client.display_name
    
    # Add technician name if available
    if work_order.assigned_technician_id:
        technician = db.query(Technician).filter(Technician.id == work_order.assigned_technician_id).first()
        if technician and technician.user_id:
            tech_user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
            if tech_user:
                response.technician_name = tech_user.full_name
    
    return response

# New billing system endpoints

@router.get("/{work_order_id}/billing-summary", response_model=WorkOrderBillingSummary)
async def get_work_order_billing_summary(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get billing summary for a work order including due today calculation.
    """
    try:
        # Check if user can access this work order
        if not await can_access_work_order(work_order_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this work order"
            )
        
        # Get work order with all related data
        work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == work_order_id).first()
        if not work_order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Work order with ID {work_order_id} not found"
            )
        
        # Calculate totals and get billing summary
        work_order.calculate_totals()
        summary = work_order.get_billing_status_summary()
        
        return WorkOrderBillingSummary(
            total_work_order=float(summary['total_work_order']),
            amount_previously_paid=float(summary['amount_previously_paid']),
            due_today=float(summary['due_today']),
            diagnostic_discount=float(summary['diagnostic_discount'])
        )
        
    except Exception as e:
        logger.error(f"Error getting billing summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting billing summary: {str(e)}"
        )

@router.put("/{work_order_id}/tax-rate")
async def update_work_order_tax_rate(
    work_order_id: uuid.UUID = Path(...),
    body: dict = Body(..., example={"tax_rate": 0.0775}),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """Update the tax rate for a work order. Admin/Manager only."""
    work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == work_order_id).first()
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    work_order.tax_rate = body.get('tax_rate', 0.0775)
    work_order.updated_by = current_user.id
    work_order.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Tax rate updated", "tax_rate": float(work_order.tax_rate)}


@router.get("/{work_order_id}/estimate.pdf")
async def get_work_order_estimate_pdf(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate and stream an estimate PDF."""
    from app.services.pdf_service import PDFService
    from app.models.work_order import WorkOrderService as WOSvcModel, WorkOrderPart as WOPart
    if not await can_access_work_order(work_order_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    work_order.calculate_totals()
    rd = {k: v for k, v in work_order.__dict__.items() if k != '_sa_instance_state'}
    if work_order.client_id:
        c = db.query(Client).filter(Client.id == work_order.client_id).first()
        if c:
            rd['client_name'] = c.display_name
            if c.user_id:
                u = db.query(UserModel).filter(UserModel.id == c.user_id).first()
                if u: rd['client_user'] = {'first_name': u.first_name, 'last_name': u.last_name, 'email': u.email, 'phone': u.phone}
    if work_order.assigned_technician_id:
        t = db.query(Technician).filter(Technician.id == work_order.assigned_technician_id).first()
        if t and t.user_id:
            tu = db.query(UserModel).filter(UserModel.id == t.user_id).first()
            if tu: rd['technician_name'] = f'{tu.first_name} {tu.last_name}'
    svcs = db.query(WOSvcModel).filter(WOSvcModel.work_order_id == work_order_id).all()
    rd['services'] = [{'id': str(s.id), 'name': s.name, 'quantity': s.quantity, 'unit_price': float(s.unit_price or 0), 'price': float(s.price or 0), 'billing_status': s.billing_status} for s in svcs]
    parts = db.query(WOPart).filter(WOPart.work_order_id == work_order_id).all()
    rd['parts'] = [{'number': p.number, 'description': p.description, 'price': float(p.price or 0), 'status': p.status, 'amount_upfront_collected': float(p.amount_upfront_collected or 0), 'tax_collected': float(p.tax_collected or 0)} for p in parts]
    rd['tax_rate'] = float(work_order.tax_rate or 0.0775)
    rd['diagnostic_discount_amount'] = float(work_order.diagnostic_discount_amount or 0)
    rd['amount_previously_paid'] = float(work_order.amount_previously_paid or 0)
    rd['service_location'] = work_order.service_location
    for k in list(rd.keys()):
        if isinstance(rd[k], uuid.UUID): rd[k] = str(rd[k])
        elif isinstance(rd[k], datetime): rd[k] = rd[k].isoformat()
    try:
        pdf_bytes = PDFService.generate_work_order_estimate(rd)
    except Exception as e:
        logger.error(f'Estimate PDF error: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    return StreamingResponse(BytesIO(pdf_bytes), media_type='application/pdf',
        headers={'Content-Disposition': f'inline; filename="estimate-{work_order.order_number}.pdf"'})


@router.get("/{work_order_id}/invoice.pdf")
async def get_work_order_invoice_pdf(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate and stream an invoice PDF."""
    from app.services.pdf_service import PDFService
    from app.models.work_order import WorkOrderService as WOSvcModel, WorkOrderPart as WOPart, WorkOrderNote
    if not await can_access_work_order(work_order_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    work_order = await WorkOrderService.get_work_order(db, work_order_id)
    work_order.calculate_totals()
    rd = {k: v for k, v in work_order.__dict__.items() if k != '_sa_instance_state'}
    if work_order.client_id:
        c = db.query(Client).filter(Client.id == work_order.client_id).first()
        if c:
            rd['client_name'] = c.display_name
            if c.user_id:
                u = db.query(UserModel).filter(UserModel.id == c.user_id).first()
                if u: rd['client_user'] = {'first_name': u.first_name, 'last_name': u.last_name, 'email': u.email, 'phone': u.phone}
    if work_order.assigned_technician_id:
        t = db.query(Technician).filter(Technician.id == work_order.assigned_technician_id).first()
        if t and t.user_id:
            tu = db.query(UserModel).filter(UserModel.id == t.user_id).first()
            if tu: rd['technician_name'] = f'{tu.first_name} {tu.last_name}'
    svcs = db.query(WOSvcModel).filter(WOSvcModel.work_order_id == work_order_id).all()
    rd['services'] = [{'id': str(s.id), 'name': s.name, 'quantity': s.quantity, 'unit_price': float(s.unit_price or 0), 'price': float(s.price or 0), 'billing_status': s.billing_status} for s in svcs]
    parts = db.query(WOPart).filter(WOPart.work_order_id == work_order_id).all()
    rd['parts'] = [{'number': p.number, 'description': p.description, 'price': float(p.price or 0), 'status': p.status, 'amount_upfront_collected': float(p.amount_upfront_collected or 0), 'tax_collected': float(p.tax_collected or 0)} for p in parts]
    rd['tax_rate'] = float(work_order.tax_rate or 0.0775)
    rd['diagnostic_discount_amount'] = float(work_order.diagnostic_discount_amount or 0)
    rd['amount_previously_paid'] = float(work_order.amount_previously_paid or 0)
    rd['service_location'] = work_order.service_location
    appts = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.work_order_id == work_order_id).all()
    rd['appointments'] = [{'appointment_type': a.appointment_type, 'status': a.status.value if hasattr(a.status, 'value') else a.status, 'scheduled_start': a.scheduled_start.isoformat() if a.scheduled_start else None} for a in appts]
    for k in list(rd.keys()):
        if isinstance(rd[k], uuid.UUID): rd[k] = str(rd[k])
        elif isinstance(rd[k], datetime): rd[k] = rd[k].isoformat()
    notes = db.query(WorkOrderNote).filter(WorkOrderNote.work_order_id == work_order_id, WorkOrderNote.is_private == False).order_by(WorkOrderNote.created_at.asc()).all()
    note_texts = [n.note for n in notes]
    try:
        pdf_bytes = PDFService.generate_work_order_invoice(rd, notes=note_texts)
    except Exception as e:
        logger.error(f'Invoice PDF error: {e}')
        raise HTTPException(status_code=500, detail=str(e))
    return StreamingResponse(BytesIO(pdf_bytes), media_type='application/pdf',
        headers={'Content-Disposition': f'inline; filename="invoice-{work_order.order_number}.pdf"'})


@router.put("/services/{service_id}/price")
async def update_service_price(
    service_id: uuid.UUID = Path(..., description="The ID of the work order service"),
    price_update: dict = Body(..., example={"unit_price": 100.00, "price": 100.00, "name": "Custom Service Name"}),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Admin override to update price of a WorkOrderService line item. Admin/Manager only.
    """
    from app.models.work_order import WorkOrderService as WorkOrderServiceModel
    service = db.query(WorkOrderServiceModel).filter(WorkOrderServiceModel.id == service_id).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service {service_id} not found")
    
    if "unit_price" in price_update:
        service.unit_price = price_update["unit_price"]
    if "price" in price_update:
        service.price = price_update["price"]
    if "name" in price_update:
        service.name = price_update["name"]
    
    # Recalculate work order totals
    work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == service.work_order_id).first()
    if work_order:
        work_order.calculate_totals()
    
    db.commit()
    return {"message": "Service price updated", "service_id": str(service_id), "new_price": service.price}


@router.put("/parts/{part_id}/price")
async def update_part_price(
    part_id: uuid.UUID = Path(..., description="The ID of the part"),
    price_update: dict = Body(..., example={"price": 150.00, "cost": 100.00}),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Admin override to update price of a part. Admin/Manager only.
    """
    part = db.query(WorkOrderPart).filter(WorkOrderPart.id == part_id).first()
    if not part:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Part {part_id} not found")
    
    if "price" in price_update:
        part.price = price_update["price"]
    if "cost" in price_update:
        part.cost = price_update["cost"]
    
    part.updated_by = current_user.id
    part.updated_at = datetime.utcnow()
    
    db.commit()
    return {"message": "Part price updated", "part_id": str(part_id), "new_price": part.price}


@router.put("/services/{service_id}/billing-status")
async def update_service_billing_status(
    service_id: uuid.UUID = Path(..., description="The ID of the service"),
    billing_update: BillingStatusUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Update billing status of a service. Admin/Manager only.
    """
    try:
        # Get the service
        from app.models.work_order import WorkOrderService
        service = db.query(WorkOrderService).filter(WorkOrderService.id == service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Service with ID {service_id} not found"
            )
        
        # Update billing status
        service.billing_status = billing_update.billing_status
        
        # Recalculate work order totals
        work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == service.work_order_id).first()
        if work_order:
            work_order.calculate_totals()
            db.commit()
        
        return {"message": "Billing status updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating service billing status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating billing status: {str(e)}"
        )

@router.post("/{work_order_id}/admin-override")
async def admin_billing_override(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    override: AdminBillingOverride = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user)
):
    """
    Admin override for billing operations. Admin/Manager only.
    """
    try:
        # Check if user can access this work order
        if not await can_access_work_order(work_order_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this work order"
            )
        
        work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == work_order_id).first()
        if not work_order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Work order with ID {work_order_id} not found"
            )
        
        if override.action == "waive_diagnostic":
            # Waive diagnostic fee
            for service in work_order.service_items:
                if hasattr(service, 'service') and service.service and service.service.service_type == 'diagnostic':
                    service.billing_status = 'waived'
        
        elif override.action == "change_billing_status" and override.service_id:
            # Change billing status of specific service
            from app.models.work_order import WorkOrderService
            service = db.query(WorkOrderService).filter(WorkOrderService.id == override.service_id).first()
            if service:
                service.billing_status = override.new_billing_status
        
        elif override.action == "apply_payment" and override.payment_amount:
            # Apply payment to work order and move billable services to paid
            work_order.amount_previously_paid = (work_order.amount_previously_paid or 0) + override.payment_amount
            
            # Move all billable services to paid status
            from app.models.work_order import WorkOrderService as WorkOrderServiceModel
            billable_services = db.query(WorkOrderServiceModel).filter(
                WorkOrderServiceModel.work_order_id == work_order_id,
                WorkOrderServiceModel.billing_status == 'billable'
            ).all()
            
            for service in billable_services:
                logging.info(f"DEBUG: Moving billable service {service.id} to paid status")
                service.billing_status = 'paid'
        
        # Recalculate totals
        work_order.calculate_totals()
        db.commit()
        
        return {"message": "Admin override applied successfully"}
        
    except Exception as e:
        logger.error(f"Error applying admin override: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error applying override: {str(e)}"
        )