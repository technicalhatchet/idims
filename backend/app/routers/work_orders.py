from fastapi.responses import StreamingResponse, Response
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body, Path, Request, Header, File, Form, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timedelta, date as py_date
import logging
from pydantic import BaseModel, UUID4, Field
from sqlalchemy import cast, Date

from app.core.exceptions import ServiceBusinessException
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
    WorkOrderPhotoListResponse, WorkOrderPhotoResponse,
    WorkOrderPartCreate, WorkOrderPartUpdate, WorkOrderPartResponse,
    BillingStatusUpdate, WorkOrderBillingSummary, AdminBillingOverride,
    WorkOrderWithInitialAppointmentCreate, WorkOrderWithInitialAppointmentResponse,
    WorkOrderCloseReadinessResponse, RedoWorkOrderCreateRequest,
)
from app.schemas.work_order_payment import (
    RecordWorkOrderPaymentRequest,
    WorkOrderPaymentResponse,
    WorkOrderPaymentListResponse,
)
from app.services.work_order_payment_service import record_work_order_payment, list_work_order_payments
from app.services import work_order_photos_service as photos_svc
from app.schemas.service import ServiceResponse
from app.services.work_order_service import WorkOrderService
from app.core.dependencies import get_current_user, get_admin_or_manager_user, get_admin_user
from app.core.exceptions import NotFoundException, ConflictException, ValidationException, BadRequestException
from app.services.user_service import UserService
from app import schemas
from app.utils.work_order_display import (
    primary_appointments_by_work_order_ids,
    technician_display_name_from_appointment,
)

# Setup logger properly
logger = logging.getLogger(__name__)


def _user_role_set(user: UserModel) -> set:
    return {str(r).lower() for r in (user.roles or [])}


def _validate_forced_schedule_permission(
    current_user: UserModel,
    is_forced_schedule: Optional[bool],
) -> None:
    """Managers may force-schedule; only admins may clear the flag."""
    if is_forced_schedule is None:
        return
    roles = _user_role_set(current_user)
    if is_forced_schedule is False and not roles.intersection({"admin", "manager"}):
        # Technicians submit is_forced_schedule=false from the form default — not an admin clear.
        return
    if not roles.intersection({"admin", "manager"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and admins can use force schedule",
        )
    if is_forced_schedule is False and "admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can clear the force schedule flag",
        )


TECH_APPOINTMENT_STATUS_ONLY_UPDATES = frozenset({
    "scheduled",
    "en_route",
    "in_progress",
    "reschedule",
    "completed_pending_payment",
    "unreachable",
    "failed",
})

CLOSED_WO_APPOINTMENT_STATUS_ONLY = frozenset({
    "redo",
    "refund",
    "completed",
})

# Field technicians may set any WO status manually except these (completed via visit/payment; recall = office).
TECHNICIAN_MANUAL_WO_STATUS_FORBIDDEN = frozenset({
    "completed",
    "completed_pending_payment",
    "recall",
    "closed",
    "refunded",
})


def _technician_record_for_user(db: Session, current_user: UserModel) -> Technician:
    technician = UserService.get_technician_by_user_id(db, current_user.id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician profile not found",
        )
    return technician


def _assert_technician_owns_appointment(appointment: WorkOrderAppointment, technician: Technician) -> None:
    if appointment.assigned_technician_id != technician.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Technicians can only update their own appointments",
        )

# Initialize auth handler
auth_handler = get_auth_handler()

router = APIRouter()

async def can_view_work_order(work_order_id: uuid.UUID, current_user: UserModel, db: Session) -> bool:
    """Any technician may view any work order; clients only their own."""
    try:
        roles = current_user.roles or []
        if any(role in ["admin", "manager", "technician"] for role in roles):
            return True

        work_order = await WorkOrderService.get_work_order(db, work_order_id)

        if "client" in roles:
            client = UserService.get_client_by_user_id(db, current_user.id)
            if not client:
                logger.warning(f"Client record not found for user {current_user.id}")
                return False
            return work_order.client_id == client.id

        return False
    except Exception as e:
        logger.error(f"Error checking work order view access: {str(e)}")
        return False


async def can_access_work_order(work_order_id: uuid.UUID, current_user: UserModel, db: Session) -> bool:
    """
    Mutation access for work-order-level actions (status, notes, photos, payments, etc.).

    Technicians may mutate when they are the header assignee OR assigned to any
    non-canceled appointment on the work order (typical field-tech case).
    """
    try:
        if any(role in ["admin", "manager"] for role in (current_user.roles or [])):
            return True

        work_order = await WorkOrderService.get_work_order(db, work_order_id)

        if "client" in (current_user.roles or []):
            client = UserService.get_client_by_user_id(db, current_user.id)
            if not client:
                logger.warning(f"Client record not found for user {current_user.id}")
                return False
            return work_order.client_id == client.id

        if "technician" in (current_user.roles or []):
            technician = UserService.get_technician_by_user_id(db, current_user.id)
            if not technician:
                logger.warning(f"Technician record not found for user {current_user.id}")
                return False
            if work_order.assigned_technician_id == technician.id:
                return True
            has_visit = (
                db.query(WorkOrderAppointment.id)
                .filter(
                    WorkOrderAppointment.work_order_id == work_order_id,
                    WorkOrderAppointment.assigned_technician_id == technician.id,
                    WorkOrderAppointment.status != "canceled",
                )
                .first()
            )
            return has_visit is not None

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
    
    Admins, managers, and technicians can see all work orders.
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
        logger.info(
            f"[REQUEST-{request_id}] Technician {current_user.id} — listing all work orders "
            f"(optional technician_id query filter: {technician_uuid})"
        )

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
        can_access = await can_view_work_order(work_order_id, current_user, db)
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this work order"
            )
                
        # Get the work order details using the service (eager-loaded for detail view)
        work_order = WorkOrderService.get_work_order_detail(db, work_order_id)
        
        # Calculate totals before returning the work order
        work_order.calculate_totals()
        
        # Convert to dict to easily manipulate
        response_dict = work_order.__dict__.copy()
        
        # Remove SQLAlchemy internal state
        if "_sa_instance_state" in response_dict:
            response_dict.pop("_sa_instance_state")
        
        # Add client name
        client = work_order.client
        if client:
            response_dict["client_name"] = client.display_name
            response_dict["client"] = {
                "first_name": client.first_name,
                "last_name": client.last_name,
                "company_name": client.company_name,
                "phone": client.phone,
                "mobile": client.mobile,
                "email": client.email,
            }
            
            properties = client.properties or []
            response_dict["client_properties"] = [
                {
                    "id": str(p.id),
                    "address": p.address,
                    "unit_number": p.unit_number,
                    "property_type": p.property_type,
                    "gate_code": p.gate_code,
                    "access_instructions": p.access_instructions,
                    "tenant_name": p.tenant_name,
                    "tenant_phone": p.tenant_phone,
                    "tenant_email": p.tenant_email,
                }
                for p in properties
            ]

            if work_order.property_id:
                matched = next((p for p in properties if p.id == work_order.property_id), None)
                if matched:
                    response_dict["property"] = {
                        "id": str(matched.id),
                        "address": matched.address,
                        "unit_number": matched.unit_number,
                        "property_type": matched.property_type,
                        "gate_code": matched.gate_code,
                        "access_instructions": matched.access_instructions,
                        "tenant_name": matched.tenant_name,
                        "tenant_phone": matched.tenant_phone,
                        "tenant_email": matched.tenant_email,
                    }
                    existing_loc = response_dict.get("service_location") or {}
                    if not (isinstance(existing_loc, dict) and existing_loc.get("address")):
                        addr_parts = [matched.address]
                        if matched.unit_number:
                            addr_parts.append(f"Unit {matched.unit_number}")
                        formatted = ", ".join(p for p in addr_parts if p)
                        if formatted:
                            response_dict["service_location"] = {
                                **(existing_loc if isinstance(existing_loc, dict) else {}),
                                "address": formatted,
                            }
            
            if client.user_id and client.user:
                user = client.user
                response_dict["client_user"] = {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone": user.phone
                }
        
        # Add technician name
        technician = work_order.technician
        if technician and technician.user:
            user = technician.user
            response_dict["technician_name"] = f"{user.first_name} {user.last_name}"
            response_dict["technician_user"] = {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone
            }
        
        from app.models.work_order import WorkOrderService as WorkOrderServiceModel, WorkOrderItem, WorkOrderPart
        services = work_order.service_items or []
        items = work_order.items or []
        parts = work_order.parts or []
        
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
        
        # Appointments (already eager-loaded on work_order)
        appointments = work_order.appointments or []
        
        appointment_list = []
        for appointment in appointments:
            # Convert appointment to dict
            appointment_dict = appointment.__dict__.copy()
            
            # Remove SQLAlchemy internal state
            if "_sa_instance_state" in appointment_dict:
                appointment_dict.pop("_sa_instance_state")
            
            # Add technician name if assigned
            appt_technician = appointment.technician
            if appt_technician and appt_technician.user:
                user = appt_technician.user
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
            
            appointment_list.append(appointment_dict)
        
        response_dict["appointments"] = appointment_list

        response_dict["is_closed"] = bool(getattr(work_order, "is_closed", False))
        response_dict["is_redo"] = bool(getattr(work_order, "is_redo", False))
        response_dict["parent_work_order_id"] = (
            str(work_order.parent_work_order_id) if work_order.parent_work_order_id else None
        )
        if work_order.parent_work_order_id:
            parent_wo = (
                db.query(WorkOrderModel)
                .filter(WorkOrderModel.id == work_order.parent_work_order_id)
                .first()
            )
            response_dict["parent_order_number"] = parent_wo.order_number if parent_wo else None
        else:
            response_dict["parent_order_number"] = None
        response_dict["has_redo_appointments"] = any(
            (a.status.value if hasattr(a.status, "value") else str(a.status)) == "redo"
            for a in appointments
        )
        child_redos = (
            db.query(WorkOrderModel)
            .filter(WorkOrderModel.parent_work_order_id == work_order_id)
            .all()
        )
        response_dict["child_redo_work_orders"] = [
            {
                "id": str(c.id),
                "order_number": c.order_number,
                "redo_source_appointment_id": (
                    str(c.redo_source_appointment_id) if c.redo_source_appointment_id else None
                ),
            }
            for c in child_redos
        ]

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
        
        # Notes (already eager-loaded on work_order)
        notes = work_order.notes or []
        
        notes_list = []
        for note in notes:
            # Convert note to dict
            note_dict = note.__dict__.copy()
            
            # Remove SQLAlchemy internal state
            if "_sa_instance_state" in note_dict:
                note_dict.pop("_sa_instance_state")
            
            # Add user name
            if note.user_id and note.user:
                user = note.user
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
    
    # Technicians: any status except system-only values (completed, recall, etc.)
    roles = current_user.roles or []
    is_field_technician = "technician" in roles and not any(r in ("admin", "manager") for r in roles)
    if is_field_technician:
        if status_update.status in TECHNICIAN_MANUAL_WO_STATUS_FORBIDDEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Technicians cannot set this status manually. Completed statuses are applied "
                    "when a visit is finished or payment is recorded. Recall is office-only."
                ),
            )
    elif "client" in roles:
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
    except HTTPException:
        raise
    except ServiceBusinessException:
        raise
    except Exception as e:
        logger.error(f"Error updating work order status: {str(e)}", exc_info=True)
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
    can_access = await can_view_work_order(work_order_id, current_user, db)
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

@router.get("/{work_order_id}/performance", response_model=Dict[str, Any])
async def get_work_order_performance(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """On-site time and other stored performance metrics for a work order."""
    can_access = await can_view_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this work order"
        )
    try:
        await WorkOrderService.get_work_order(db, work_order_id)
        from app.services.work_order_performance_service import get_work_order_performance as fetch_performance
        return fetch_performance(db, work_order_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving work order performance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving work order performance"
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
    limit: int = Query(100, ge=1, le=500, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    List appointments for a specific work order with optional status filtering.
    """
    # Check if user can access this work order
    can_access = await can_view_work_order(work_order_id, current_user, db)
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
    current_user: UserModel = Depends(get_current_user)
):
    """
    Create a new appointment for a work order.
    Managers and admins can create for any technician.
    Technicians can create appointments assigned to themselves (typical on-site scheduling).
    """
    # Ensure the work_order_id in the path matches the one in the request body
    if appointment.work_order_id != work_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Work order ID in the path must match the one in the request body"
        )

    roles = current_user.roles or []
    is_staff_tech = "technician" in roles and not any(r in roles for r in ("admin", "manager"))

    if is_staff_tech:
        if not await can_view_work_order(work_order_id, current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to schedule on this work order",
            )

        if appointment.is_forced_schedule:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only managers and admins can use force schedule",
            )

        technician = _technician_record_for_user(db, current_user)
        if (
            appointment.assigned_technician_id is not None
            and appointment.assigned_technician_id != technician.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technicians can only create appointments assigned to themselves",
            )

        appointment = appointment.model_copy(update={"assigned_technician_id": technician.id})
    elif not any(role in ["admin", "manager"] for role in roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin, manager, or technician role required",
        )

    if appointment.is_forced_schedule:
        _validate_forced_schedule_permission(current_user, True)
    
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
    
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
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
    response_model=List[Dict[str, Any]],
    summary="Get Technician Schedule for a Date",
    tags=["appointments", "technicians", "schedule"]
)
def get_technician_schedule(
    technician_id: UUID4 = Query(..., description="ID of the technician whose schedule is being requested"),
    schedule_date: py_date = Query(..., description="The specific date for the schedule (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Get all appointments for a technician on a specific date across all work orders.
    This is used for schedule planning and conflict checking.
    """
    logger.info(f"Fetching schedule for technician {technician_id} on date {schedule_date} by user {current_user.email}")

    roles = current_user.roles or []
    if "technician" in roles and not any(r in roles for r in ("admin", "manager")):
        own_technician = _technician_record_for_user(db, current_user)
        if own_technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technicians can only view their own schedule",
            )
    
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
        
        from app.services.scheduling_constraints_service import (
            calendar_block_to_schedule_item,
            get_busy_calendar_blocks,
            schedule_item_sort_key,
        )

        start_of_day = datetime.combine(schedule_date, datetime.min.time())
        end_of_day = datetime.combine(schedule_date, datetime.max.time())

        stmt = (
            select(WorkOrderAppointment)
            .options(
                joinedload(WorkOrderAppointment.work_order).joinedload(WorkOrderModel.property_ref)
            )
            .where(WorkOrderAppointment.assigned_technician_id == technician_id)
            .where(WorkOrderAppointment.scheduled_start < end_of_day)
            .where(WorkOrderAppointment.scheduled_end > start_of_day)
            .where(WorkOrderAppointment.status != "canceled")
            .order_by(WorkOrderAppointment.scheduled_start)
        )
        result = db.execute(stmt)
        appointments = result.scalars().all()
        blocks = get_busy_calendar_blocks(db, technician_id, start_of_day, end_of_day)

        logger.info(
            "Found %s appointments and %s calendar blocks for technician %s on %s",
            len(appointments),
            len(blocks),
            technician_id,
            schedule_date,
        )

        response_items: List[Dict[str, Any]] = []
        for appt in appointments:
            appt_response = WorkOrderAppointmentResponse.model_validate(appt)
            payload = (
                appt_response.model_dump()
                if hasattr(appt_response, "model_dump")
                else appt_response.dict()
            )
            payload["source"] = "appointment"
            if appt.work_order:
                wo = appt.work_order
                loc = wo.service_location
                address = None
                if isinstance(loc, dict) and loc.get("address"):
                    address = loc["address"]
                elif wo.property_ref and wo.property_ref.address:
                    parts = [wo.property_ref.address]
                    if wo.property_ref.unit_number:
                        parts.append(f"Unit {wo.property_ref.unit_number}")
                    address = ", ".join(parts)
                if address:
                    payload["location"] = address
            response_items.append(payload)

        for block in blocks:
            response_items.append(calendar_block_to_schedule_item(block))

        response_items.sort(key=schedule_item_sort_key)
        return response_items
        
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
        can_access = await can_view_work_order(appointment.work_order_id, current_user, db)
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
    Technicians may update appointments assigned to them (scheduling, notes, status, etc.)
    but cannot reassign or force-schedule.
    """
    try:
        roles = current_user.roles or []
        is_staff_tech = "technician" in roles and not any(r in roles for r in ("admin", "manager"))

        if is_staff_tech:
            appointment = db.query(WorkOrderAppointment).filter(
                WorkOrderAppointment.id == appointment_id
            ).first()
            if not appointment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Appointment with ID {appointment_id} not found",
                )

            technician = _technician_record_for_user(db, current_user)
            _assert_technician_owns_appointment(appointment, technician)

            update_data = appointment_update.model_dump(exclude_unset=True)

            if update_data.get("is_forced_schedule") is True:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only managers and admins can use force schedule",
                )

            new_tech_id = update_data.get("assigned_technician_id")
            if new_tech_id is not None and new_tech_id != technician.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Technicians cannot reassign appointments",
                )

            # Quick field-day status button: status-only updates use a narrower allow-list.
            if set(update_data.keys()) == {"status"}:
                parent_wo = db.query(WorkOrderModel).filter(
                    WorkOrderModel.id == appointment.work_order_id
                ).first()
                if parent_wo and getattr(parent_wo, "is_closed", False):
                    if update_data["status"] not in CLOSED_WO_APPOINTMENT_STATUS_ONLY:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=(
                                "Closed work orders only allow appointment status changes to "
                                "redo, refund, or completed"
                            ),
                        )
                elif update_data["status"] not in TECH_APPOINTMENT_STATUS_ONLY_UPDATES:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=(
                            "Technicians can only set appointment status to: scheduled, en_route, "
                            "in_progress, reschedule, completed_pending_payment (visit done), "
                            "unreachable, or APR (failed)"
                        ),
                    )

        elif not any(role in ["admin", "manager"] for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin, manager, or technician role required"
            )

        appt_for_guard = db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.id == appointment_id
        ).first()
        if appt_for_guard:
            wo_for_guard = db.query(WorkOrderModel).filter(
                WorkOrderModel.id == appt_for_guard.work_order_id
            ).first()
            if wo_for_guard:
                from app.services.work_order_lifecycle_service import assert_appointment_update_allowed

                update_keys = set(appointment_update.model_dump(exclude_unset=True).keys())
                assert_appointment_update_allowed(
                    wo_for_guard,
                    update_keys,
                    appointment_update.status,
                )

        if appointment_update.is_forced_schedule is not None:
            _validate_forced_schedule_permission(current_user, appointment_update.is_forced_schedule)

        # Create an instance of the WorkOrderService and update the appointment
        logger.info(f"DEBUG update_appointment: raw update data = {appointment_update.model_dump(exclude_unset=True)}")
        work_order_service = WorkOrderService(db)
        result = await work_order_service.update_work_order_appointment(
            appointment_id=appointment_id,
            appointment_data=appointment_update,
            user_id=current_user.id
        )

        # Billing + post-payment WO sync run inside WorkOrderService.update_work_order_appointment

        # Add technician name if assigned
        if result.assigned_technician_id:
            technician = db.query(Technician).filter(Technician.id == result.assigned_technician_id).first()
            if technician and technician.user_id:
                user = db.query(UserModel).filter(UserModel.id == technician.user_id).first()
                if user:
                    # Add technician name as a dynamic attribute
                    result.technician_name = f"{user.first_name} {user.last_name}"
        
        return result
    
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating work order appointment: {str(e)}", exc_info=True)
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
        deleted = await work_order_service.delete_work_order_appointment(
            appointment_id=appointment_id,
            user_id=current_user.id,
        )
        
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
    can_access = await can_view_work_order(work_order_id, current_user, db)
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

@router.put("/{work_order_id}/notes/{note_id}", response_model=WorkOrderNoteResponse)
async def update_work_order_note(
    work_order_id: uuid.UUID = Path(...),
    note_id: uuid.UUID = Path(...),
    body: dict = Body(..., example={"note": "Updated note content"}),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update a note. Only the author can edit their own note."""
    from app.models.work_order import WorkOrderNote
    note = db.query(WorkOrderNote).filter(
        WorkOrderNote.id == note_id,
        WorkOrderNote.work_order_id == work_order_id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    # Only the author or admin/manager can edit
    is_admin = any(role in ['admin', 'manager'] for role in current_user.roles)
    if not is_admin and note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own notes")
    note.note = body.get('note', note.note)
    note.updated_at = datetime.utcnow()
    db.flush()

    from app.services.dma_service import upsert_repair_outcome_from_note
    upsert_repair_outcome_from_note(
        db,
        work_order_id=work_order_id,
        user_id=current_user.id,
        note_id=note.id,
        note_text=note.note,
    )

    db.commit()
    db.refresh(note)
    note_dict = note.__dict__.copy()
    note_dict.pop('_sa_instance_state', None)
    if note.user_id:
        user = db.query(UserModel).filter(UserModel.id == note.user_id).first()
        if user:
            note_dict['user_name'] = f'{user.first_name} {user.last_name}'
    for k, v in note_dict.items():
        if isinstance(v, uuid.UUID): note_dict[k] = str(v)
        elif isinstance(v, datetime): note_dict[k] = v.isoformat()
    return note_dict


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


@router.get("/{work_order_id}/photos", response_model=WorkOrderPhotoListResponse)
async def list_work_order_photos(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    can_access = await can_view_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to access this work order")

    rows = photos_svc.list_photos(db, work_order_id)
    items = [WorkOrderPhotoResponse(**photos_svc.photo_to_dict(r)) for r in rows]
    return WorkOrderPhotoListResponse(items=items)


@router.post(
    "/{work_order_id}/photos",
    response_model=WorkOrderPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_work_order_photo(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    is_model_sn_tag: str = Form("false"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    can_access = await can_access_work_order(work_order_id, current_user, db)
    if not can_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to access this work order")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Empty file")

    mime = file.content_type or "application/octet-stream"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=422, detail="Only image files are allowed")

    tag_flag = is_model_sn_tag.lower() in ("true", "1", "yes", "on")

    try:
        row = photos_svc.save_photo(
            db,
            work_order_id=work_order_id,
            user_id=current_user.id,
            file_bytes=content,
            original_filename=file.filename or "photo.jpg",
            mime_type=mime,
            description=description,
            is_model_sn_tag=tag_flag,
        )
        return WorkOrderPhotoResponse(**photos_svc.photo_to_dict(row))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/photos/{photo_id}/download")
async def download_work_order_photo(
    photo_id: uuid.UUID = Path(..., description="The ID of the photo"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    try:
        row = photos_svc.get_photo(db, photo_id)
        can_access = await can_view_work_order(row.work_order_id, current_user, db)
        if not can_access:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to access this work order")
        content, mime = photos_svc.read_photo_bytes(row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    headers = {"Content-Disposition": f'inline; filename="{row.filename}"'}
    return Response(content=content, media_type=mime, headers=headers)


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
    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this work order",
        )

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


@router.get("/{work_order_id}/estimate.pdf")
async def get_work_order_estimate_pdf(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate and stream an estimate PDF."""
    from app.services.pdf_service import PDFService
    from app.models.work_order import WorkOrderService as WOSvcModel, WorkOrderPart as WOPart
    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    # Direct DB query instead of service to avoid NotFoundException masking real errors
    work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == work_order_id).first()
    if not work_order:
        raise HTTPException(status_code=404, detail=f"Work order {work_order_id} not found in DB")
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
        import traceback
        logger.error(f'Estimate PDF error: {e}\n{traceback.format_exc()}')
        raise HTTPException(status_code=500, detail=f'PDF generation failed: {type(e).__name__}: {str(e)}')
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
    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    work_order = db.query(WorkOrderModel).filter(WorkOrderModel.id == work_order_id).first()
    if not work_order:
        raise HTTPException(status_code=404, detail=f"Work order {work_order_id} not found in DB")
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
    import re, json as _json
    NOTE_FIELDS = {
        'Pre-Call': [
            ('clientContactStatus', 'Client Contact Status'),
            ('appointmentTime', 'Appointment Time'),
            ('detailsReviewed', 'Work Order Details Reviewed'),
            ('toolsReady', 'Tools and Parts Prepared'),
            ('additionalNotes', 'Additional Notes'),
        ],
        'Follow Up': [
            ('servicePerformed', 'Service Performed'),
            ('partsUsed', 'Parts Used'),
            ('clientFeedback', 'Client Feedback'),
            ('nextSteps', 'Next Steps'),
            ('additionalNotes', 'Additional Notes'),
        ],
        'Redo': [
            ('originalIssue', 'Original Issue'),
            ('previousAttempts', 'Previous Attempts'),
            ('newApproach', 'New Approach'),
            ('requiredParts', 'Required Parts'),
            ('additionalNotes', 'Additional Notes'),
        ],
    }
    note_texts = []
    for n in notes:
        raw = n.note or ''
        # Extract type prefix e.g. [Pre-Call]
        match = re.match(r'^\[(.*?)\]\n?', raw)
        note_type = match.group(1) if match else None
        content = raw[match.end():].strip() if match else raw.strip()
        if not content:
            continue
        # Try to parse as JSON for structured note types
        if note_type and note_type in NOTE_FIELDS:
            try:
                data = _json.loads(content)
                lines = [f'{note_type}:']
                for field_id, label in NOTE_FIELDS[note_type]:
                    val = data.get(field_id, '')
                    if isinstance(val, bool):
                        val = '✓' if val else '✗'
                    if val:
                        lines.append(f'  {label}: {val}')
                note_texts.append('\n'.join(lines))
            except Exception:
                note_texts.append(f'{note_type}: {content}')
        else:
            note_texts.append(f'{note_type}: {content}' if note_type else content)
    try:
        pdf_bytes = PDFService.generate_work_order_invoice(rd, notes=note_texts)
    except Exception as e:
        import traceback
        logger.error(f'Invoice PDF error: {e}\n{traceback.format_exc()}')
        raise HTTPException(status_code=500, detail=f'PDF generation failed: {type(e).__name__}: {str(e)}')
    return StreamingResponse(BytesIO(pdf_bytes), media_type='application/pdf',
        headers={'Content-Disposition': f'inline; filename="invoice-{work_order.order_number}.pdf"'})


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

    from app.services import work_order_activity_service as activity
    activity.log_equipment_updated(db, work_order_id, current_user.id)
    
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
        # Check if user can view this work order
        if not await can_view_work_order(work_order_id, current_user, db):
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

@router.get("/{work_order_id}/payments", response_model=WorkOrderPaymentListResponse)
async def get_work_order_payments(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """List field-recorded payments for a work order."""
    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    items = list_work_order_payments(db, work_order_id)
    return WorkOrderPaymentListResponse(items=items, total=len(items))


@router.post("/{work_order_id}/record-payment", response_model=WorkOrderPaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_work_order_payment_endpoint(
    work_order_id: uuid.UUID = Path(..., description="The ID of the work order"),
    body: RecordWorkOrderPaymentRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Record a payment received in the field (cash, check, etc.).
    Applies the same billing updates as a successful Stripe payment.
    """
    if not await can_access_work_order(work_order_id, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        payment, completion = record_work_order_payment(db, work_order_id, current_user.id, body)
        db.commit()
        db.refresh(payment)

        recorder_name = f"{current_user.first_name} {current_user.last_name}".strip()
        return WorkOrderPaymentResponse(
            id=payment.id,
            work_order_id=payment.work_order_id,
            payment_number=payment.payment_number,
            amount=float(payment.amount),
            subtotal_amount=float(payment.subtotal_amount) if payment.subtotal_amount is not None else None,
            tax_amount=float(payment.tax_amount or 0),
            tax_rate_snapshot=float(payment.tax_rate_snapshot) if payment.tax_rate_snapshot is not None else None,
            payment_method=payment.payment_method,
            reference_number=payment.reference_number,
            notes=payment.notes,
            payment_date=payment.payment_date,
            recorded_by=payment.recorded_by,
            recorder_name=recorder_name or None,
            work_order_completed=completion.get("work_order_completed", False),
            needs_repair_outcome=completion.get("needs_repair_outcome", False),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Error recording work order payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error recording payment: {str(e)}",
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
            from app.services.work_order_payment_service import apply_payment_to_work_order

            apply_payment_to_work_order(
                db,
                work_order,
                float(override.payment_amount),
                user_id=current_user.id,
            )
        
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


@router.get(
    "/{work_order_id}/close-readiness",
    response_model=WorkOrderCloseReadinessResponse,
)
async def get_work_order_close_readiness(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    from app.services.work_order_lifecycle_service import build_close_readiness

    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this work order",
        )

    return build_close_readiness(db, work_order_id)


@router.post("/{work_order_id}/close", response_model=WorkOrderResponse)
async def close_work_order_endpoint(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    from app.services.work_order_lifecycle_service import close_work_order

    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to close this work order",
        )

    try:
        close_work_order(db, work_order_id, current_user.id)
        db.commit()
        return await WorkOrderService.get_work_order(db, work_order_id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{work_order_id}/reopen", response_model=WorkOrderResponse)
async def reopen_work_order_endpoint(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_user),
):
    from app.services.work_order_lifecycle_service import reopen_work_order

    try:
        reopen_work_order(db, work_order_id, current_user.id)
        db.commit()
        return await WorkOrderService.get_work_order(db, work_order_id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{work_order_id}/reclose", response_model=WorkOrderResponse)
async def reclose_work_order_endpoint(
    work_order_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_admin_or_manager_user),
):
    from app.services.work_order_lifecycle_service import reclose_work_order

    try:
        reclose_work_order(db, work_order_id, current_user.id)
        db.commit()
        return await WorkOrderService.get_work_order(db, work_order_id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{work_order_id}/create-redo")
async def create_redo_work_order_endpoint(
    work_order_id: uuid.UUID = Path(...),
    body: RedoWorkOrderCreateRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    from app.services.work_order_redo_service import create_redo_from_appointment

    if not await can_view_work_order(work_order_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create a redo for this work order",
        )

    try:
        return await create_redo_from_appointment(
            db,
            parent_work_order_id=work_order_id,
            appointment_id=body.appointment_id,
            user_id=current_user.id,
            scheduled_start=body.scheduled_start,
            scheduled_end=body.scheduled_end,
            time_window=body.time_window,
        )
    except (ValidationException, ConflictException) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))