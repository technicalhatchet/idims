from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, date
import logging

from app.db.database import get_db
from app.core.auth import get_auth_handler, AuthUser
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.models.technician import Technician
from app.models.service import Service
from app.core.exceptions import NotFoundException, ValidationException, ConflictException
from app.schemas.scheduling import (
    AppointmentSlot, 
    ScheduleResponse, 
    AppointmentResponse,
    ScheduleRequest,
    TechnicianAvailability,
    AvailabilityResponse,
    AppointmentPreviewResponse,
)
from app.core.dependencies import get_current_user, get_admin_or_manager_user
from app.utils.work_order_display import (
    primary_appointments_by_work_order_ids,
    technician_display_name_from_appointment,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _enum_to_str(value) -> Optional[str]:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


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
        logger.error(f"Authentication error in scheduling router: {str(e)}", exc_info=True)
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

@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    request: Request,
    start_date: date = Query(..., description="Start date for the schedule range"),
    end_date: date = Query(..., description="End date for the schedule range"),
    technician_id: Optional[uuid.UUID] = Query(None, description="Filter by technician ID"),
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    view_type: str = Query("day", description="View type (day, week, month, list)"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get schedule data for the given date range.
    Filter by technician or client if specified.
    """
    # Convert dates to datetime for query
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    user_roles = list(current_user.roles or [])

    # Base query for work orders (eager-load relations used in the response)
    query = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.client),
            joinedload(WorkOrder.technician).joinedload(Technician.user),
        )
        .filter(
            (WorkOrder.scheduled_start >= start_datetime)
            & (WorkOrder.scheduled_start <= end_datetime)
            & (
                WorkOrder.status.in_(
                    [
                        "pending",
                        "scheduled",
                        "in_progress",
                        "completed",
                        "parts_on_order",
                        "reschedule",
                        "need_to_contact",
                        "redo",
                    ]
                )
            )
        )
    )

    # Apply filters based on user role
    if "technician" in user_roles:
        # Technicians can only see their assignments
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician:
            raise NotFoundException("Technician profile not found")

        appt_wo_ids = (
            db.query(WorkOrderAppointment.work_order_id)
            .filter(WorkOrderAppointment.assigned_technician_id == technician.id)
            .subquery()
        )
        query = query.filter(
            or_(
                WorkOrder.assigned_technician_id == technician.id,
                WorkOrder.id.in_(appt_wo_ids),
            )
        )
    elif "client" in user_roles:
        # Clients can only see their own appointments
        from app.models.client import Client
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        
        query = query.filter(WorkOrder.client_id == client.id)
    elif technician_id:
        # Filter by specified technician for admins/managers (WO or appointment assignment)
        appt_wo_ids = (
            db.query(WorkOrderAppointment.work_order_id)
            .filter(WorkOrderAppointment.assigned_technician_id == technician_id)
            .subquery()
        )
        query = query.filter(
            or_(
                WorkOrder.assigned_technician_id == technician_id,
                WorkOrder.id.in_(appt_wo_ids),
            )
        )
    elif client_id:
        # Filter by specified client for admins/managers
        query = query.filter(WorkOrder.client_id == client_id)
    
    # Work orders in range (variable name kept for compatibility with clients)
    work_orders_in_range = query.all()
    primary_appt_by_wo = primary_appointments_by_work_order_ids(
        db, [wo.id for wo in work_orders_in_range]
    )

    # Format appointments for response
    formatted_appointments = []
    for appointment in work_orders_in_range:
        # Get client name
        client_name = "Unknown"
        if appointment.client:
            client_name = appointment.client.company_name or f"{appointment.client.first_name} {appointment.client.last_name}"
        
        # Technician on WO; fall back to primary WorkOrderAppointment when WO row is unset
        technician_name = "Unassigned"
        if appointment.assigned_technician_id and appointment.technician:
            technician_name = appointment.technician.name
        else:
            ap = primary_appt_by_wo.get(appointment.id)
            if ap and ap.assigned_technician_id:
                tname = technician_display_name_from_appointment(ap)
                if tname:
                    technician_name = tname

        # WorkOrder has no `title` column (removed); build a display title for the UI
        desc = (appointment.description or "").strip()
        display_title = desc[:200] if desc else f"Work order {appointment.order_number}"

        formatted_appointments.append({
            "id": str(appointment.id),
            "work_order_id": str(appointment.id),
            "source": "work_order",
            "title": display_title,
            "start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
            "end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
            "status": _enum_to_str(appointment.status),
            "client_id": str(appointment.client_id) if appointment.client_id else None,
            "client_name": client_name,
            "technician_id": str(appointment.assigned_technician_id) if appointment.assigned_technician_id else None,
            "technician_name": technician_name,
            "location": appointment.service_location.get("address") if appointment.service_location else None,
            "description": appointment.description,
            "order_number": appointment.order_number,
            "priority": _enum_to_str(appointment.priority),
        })
    
    # Get available technicians (for admin/manager)
    available_technicians = []
    if any(role in ["admin", "manager"] for role in user_roles):
        technicians = db.query(Technician).filter(Technician.status == "active").all()
        for tech in technicians:
            if tech.user:
                available_technicians.append({
                    "id": str(tech.id),
                    "name": f"{tech.user.first_name} {tech.user.last_name}",
                })
    
    return {
        "appointments": formatted_appointments,
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "view_type": view_type,
        "available_technicians": available_technicians
    }

@router.post("/schedule", response_model=AppointmentResponse)
async def schedule_appointment(
    request: Request,
    appointment_data: ScheduleRequest = Body(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Schedule a new appointment or update work order scheduling.
    """
    try:
        # Get the work order
        work_order = db.query(WorkOrder).filter(WorkOrder.id == appointment_data.work_order_id).first()
        if not work_order:
            raise NotFoundException(f"Work order with ID {appointment_data.work_order_id} not found")
        
        # Check for scheduling conflicts if a technician is assigned
        if appointment_data.technician_id:
            # Convert to datetime objects
            start_time = appointment_data.start_time
            end_time = appointment_data.end_time
            
            # Check if the technician is available
            technician = db.query(Technician).filter(Technician.id == appointment_data.technician_id).first()
            if not technician:
                raise NotFoundException(f"Technician with ID {appointment_data.technician_id} not found")
            
            # Check technician status
            if technician.status != "active":
                raise ValidationException(f"Technician is not active and cannot be scheduled")
            
            # Check for conflicts with existing appointments
            conflicts = db.query(WorkOrder).filter(
                WorkOrder.assigned_technician_id == appointment_data.technician_id,
                WorkOrder.id != work_order.id,  # Exclude current work order
                WorkOrder.status.in_(["scheduled", "in_progress"]),
                (
                    # New appointment starts during existing appointment
                    (WorkOrder.scheduled_start <= start_time) & 
                    (WorkOrder.scheduled_end > start_time)
                ) | (
                    # New appointment ends during existing appointment
                    (WorkOrder.scheduled_start < end_time) & 
                    (WorkOrder.scheduled_end >= end_time)
                ) | (
                    # New appointment completely contains existing appointment
                    (WorkOrder.scheduled_start >= start_time) & 
                    (WorkOrder.scheduled_end <= end_time)
                )
            ).first()
            
            if conflicts:
                raise ConflictException("This scheduling would create a conflict with another appointment")
            
            # Update the work order with scheduling information
            work_order.assigned_technician_id = appointment_data.technician_id
        
        # Update scheduling info
        work_order.scheduled_start = appointment_data.start_time
        work_order.scheduled_end = appointment_data.end_time
        
        # Update status to scheduled if it's pending
        if work_order.status == "pending":
            work_order.status = "scheduled"
        
        # Update notes if provided
        if appointment_data.notes:
            # Add to existing notes or create new
            if work_order.description:
                work_order.description += f"\n\nScheduling Notes: {appointment_data.notes}"
            else:
                work_order.description = f"Scheduling Notes: {appointment_data.notes}"
        
        # Save changes
        db.commit()
        db.refresh(work_order)
        
        # Format response
        client_name = "Unknown"
        if work_order.client:
            client_name = work_order.client.company_name or f"{work_order.client.first_name} {work_order.client.last_name}"
        
        technician_name = "Unassigned"
        if work_order.technician:
            technician_name = work_order.technician.name
        
        return {
            "id": str(work_order.id),
            "work_order_id": str(work_order.id),
            "order_number": work_order.order_number,
            "title": work_order.title,
            "start_time": work_order.scheduled_start.isoformat() if work_order.scheduled_start else None,
            "end_time": work_order.scheduled_end.isoformat() if work_order.scheduled_end else None,
            "client_id": str(work_order.client_id) if work_order.client_id else None,
            "client_name": client_name,
            "technician_id": str(work_order.assigned_technician_id) if work_order.assigned_technician_id else None,
            "technician_name": technician_name,
            "status": work_order.status,
            "location": work_order.service_location.get("address") if work_order.service_location else None,
            "notes": appointment_data.notes
        }
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error scheduling appointment: {str(e)}"
        )

@router.get("/schedule/available-slots", response_model=List[AppointmentSlot])
async def get_available_slots(
    request: Request,
    date: date = Query(..., description="Date to check for available slots"),
    technician_id: Optional[uuid.UUID] = Query(None, description="Technician ID to check availability for"),
    duration_minutes: int = Query(60, description="Duration of the appointment in minutes"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get available appointment slots for the given date and technician.
    If no technician is specified, get slots for all available technicians.
    """
    # Convert date to datetime objects for the full day
    start_datetime = datetime.combine(date, datetime.min.time())
    end_datetime = datetime.combine(date, datetime.max.time())
    
    # Business hours (configurable)
    business_start_hour = 8  # 8:00 AM
    business_end_hour = 17   # 5:00 PM
    
    # Slot interval in minutes (configurable)
    slot_interval = 30
    
    # Query technicians
    if technician_id:
        technicians = [db.query(Technician).filter(
            Technician.id == technician_id,
            Technician.status == "active"
        ).first()]
        
        if not technicians[0]:
            raise NotFoundException(f"Technician with ID {technician_id} not found or not active")
    else:
        # For admin/manager, get all active technicians
        if any(role in ["admin", "manager"] for role in current_user.roles):
            technicians = db.query(Technician).filter(Technician.status == "active").all()
        else:
            # For technicians, only return their own availability
            technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
            if not technician:
                raise NotFoundException("Technician profile not found")
            technicians = [technician]
    
    # Get all booked appointments for the date
    booked_appointments = {}
    for tech in technicians:
        if tech:
            tech_appointments = db.query(WorkOrder).filter(
                WorkOrder.assigned_technician_id == tech.id,
                WorkOrder.status.in_(["scheduled", "in_progress"]),
                WorkOrder.scheduled_start >= start_datetime,
                WorkOrder.scheduled_start <= end_datetime
            ).all()
            
            booked_appointments[str(tech.id)] = tech_appointments
    
    # Generate available slots
    available_slots = []
    
    for tech in technicians:
        if not tech:
            continue
            
        tech_booked = booked_appointments.get(str(tech.id), [])
        
        # Generate all possible slots during business hours
        current_slot_start = datetime.combine(date, datetime.min.time().replace(hour=business_start_hour))
        day_end = datetime.combine(date, datetime.min.time().replace(hour=business_end_hour))
        
        while current_slot_start + timedelta(minutes=duration_minutes) <= day_end:
            slot_end = current_slot_start + timedelta(minutes=duration_minutes)
            
            # Check if this slot conflicts with any booked appointments
            is_available = True
            for appointment in tech_booked:
                # Skip if appointment doesn't have scheduled times
                if not appointment.scheduled_start or not appointment.scheduled_end:
                    continue
                    
                # Check for conflict
                if (current_slot_start < appointment.scheduled_end and 
                    slot_end > appointment.scheduled_start):
                    is_available = False
                    break
            
            if is_available:
                available_slots.append({
                    "start_time": current_slot_start.isoformat(),
                    "end_time": slot_end.isoformat(),
                    "technician_id": str(tech.id),
                    "technician_name": tech.name
                })
            
            # Move to next slot
            current_slot_start += timedelta(minutes=slot_interval)
    
    return available_slots


@router.get("/appointment-preview-slots", response_model=AppointmentPreviewResponse)
async def get_appointment_preview_slots(
    request: Request,
    on_date: date = Query(..., alias="date", description="Calendar day to preview (local business day)"),
    technician_id: Optional[uuid.UUID] = Query(None, description="Limit to one technician; omit for all active techs"),
    duration_minutes: Optional[int] = Query(None, ge=15, le=960, description="Slot length in minutes (ignored if service_ids provided)"),
    service_ids: Optional[List[uuid.UUID]] = Query(None, description="If set, duration = sum of service duration_minutes"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    """
    Preview bookable time windows **without** creating a work order.

    Busy time is computed from **WorkOrderAppointment** rows (same source as dispatch),
    not only work-order-level schedule fields.
    """
    start_datetime = datetime.combine(on_date, datetime.min.time())
    end_datetime = datetime.combine(on_date, datetime.max.time())

    resolved_duration = 60
    if service_ids:
        total = 0
        for sid in service_ids:
            svc = db.query(Service).filter(Service.id == sid).first()
            if svc is not None and getattr(svc, "duration_minutes", None) is not None:
                total += int(svc.duration_minutes)
        if total > 0:
            resolved_duration = total
    elif duration_minutes is not None:
        resolved_duration = duration_minutes

    business_start_hour = 8
    business_end_hour = 17
    slot_interval = 30

    if technician_id:
        technicians = [
            db.query(Technician).filter(
                Technician.id == technician_id,
                Technician.status == "active",
            ).first()
        ]
        if not technicians[0]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Technician not found or not active",
            )
    else:
        if any(role in ["admin", "manager"] for role in current_user.roles):
            technicians = db.query(Technician).filter(Technician.status == "active").all()
        else:
            technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
            if not technician:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Technician profile not found",
                )
            technicians = [technician]

    booked_by_tech: Dict[str, List[WorkOrderAppointment]] = {}
    for tech in technicians:
        if not tech:
            continue
        q = (
            db.query(WorkOrderAppointment)
            .filter(
                WorkOrderAppointment.assigned_technician_id == tech.id,
                WorkOrderAppointment.scheduled_start <= end_datetime,
                WorkOrderAppointment.scheduled_end >= start_datetime,
                WorkOrderAppointment.status != "canceled",
            )
            .order_by(WorkOrderAppointment.scheduled_start)
        )
        booked_by_tech[str(tech.id)] = q.all()

    available_slots: List[dict] = []
    for tech in technicians:
        if not tech:
            continue
        tech_busy = booked_by_tech.get(str(tech.id), [])
        current_slot_start = datetime.combine(
            on_date, datetime.min.time().replace(hour=business_start_hour)
        )
        day_end = datetime.combine(
            on_date, datetime.min.time().replace(hour=business_end_hour)
        )

        while current_slot_start + timedelta(minutes=resolved_duration) <= day_end:
            slot_end = current_slot_start + timedelta(minutes=resolved_duration)
            is_available = True
            for appt in tech_busy:
                if not appt.scheduled_start or not appt.scheduled_end:
                    continue
                if current_slot_start < appt.scheduled_end and slot_end > appt.scheduled_start:
                    is_available = False
                    break
            if is_available:
                available_slots.append(
                    {
                        "start_time": current_slot_start.isoformat(),
                        "end_time": slot_end.isoformat(),
                        "technician_id": str(tech.id),
                        "technician_name": tech.name,
                    }
                )
            current_slot_start += timedelta(minutes=slot_interval)

    return AppointmentPreviewResponse(
        date=on_date.isoformat(),
        duration_minutes=resolved_duration,
        business_hours={
            "start": f"{business_start_hour:02d}:00",
            "end": f"{business_end_hour:02d}:00",
        },
        slot_interval_minutes=slot_interval,
        slots=available_slots,
    )


@router.get("/technicians/availability", response_model=AvailabilityResponse)
async def get_technician_availability(
    request: Request,
    technician_id: uuid.UUID = Query(..., description="Technician ID to check availability for"),
    start_date: date = Query(..., description="Start date of the range"),
    end_date: date = Query(..., description="End date of the range"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a technician's availability over a date range.
    Returns availability settings and booked appointments.
    """
    # Check permissions
    if not any(role in ["admin", "manager"] for role in current_user.roles) and technician_id != current_user.id:
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this technician's availability"
            )
    
    # Get technician
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if not technician:
        raise NotFoundException(f"Technician with ID {technician_id} not found")
    
    # Convert dates to datetime for query
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Get scheduled appointments
    appointments = db.query(WorkOrder).filter(
        WorkOrder.assigned_technician_id == technician_id,
        WorkOrder.status.in_(["scheduled", "in_progress"]),
        WorkOrder.scheduled_start >= start_datetime,
        WorkOrder.scheduled_start <= end_datetime
    ).all()
    
    # Format appointments
    formatted_appointments = []
    for appointment in appointments:
        formatted_appointments.append({
            "id": str(appointment.id),
            "start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
            "end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
            "title": appointment.title,
            "order_number": appointment.order_number,
            "client_name": appointment.client.company_name or f"{appointment.client.first_name} {appointment.client.last_name}" if appointment.client else "Unknown",
            "status": appointment.status
        })
    
    # Get availability settings
    availability = technician.availability or {
        "workDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "workHours": {
            "start": "08:00",
            "end": "17:00"
        },
        "exceptions": []
    }
    
    # Add status
    availability_status = "available"
    if technician.status != "active":
        availability_status = technician.status
    
    return {
        "technician_id": str(technician.id),
        "technician_name": technician.name,
        "status": availability_status,
        "availability": availability,
        "appointments": formatted_appointments,
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }

@router.put("/technicians/{technician_id}/availability")
async def update_technician_availability(
    request: Request,
    technician_id: uuid.UUID = Path(..., description="Technician ID to update availability for"),
    availability: TechnicianAvailability = Body(...),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a technician's availability settings.
    """
    # Check permissions
    if not any(role in ["admin", "manager"] for role in current_user.roles):
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or str(technician.id) != str(technician_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this technician's availability"
            )
    
    # Get technician
    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if not technician:
        raise NotFoundException(f"Technician with ID {technician_id} not found")
    
    try:
        # Update availability settings
        technician.availability = {
            "workDays": availability.work_days,
            "workHours": {
                "start": availability.work_hours.start,
                "end": availability.work_hours.end
            },
            "exceptions": availability.exceptions
        }
        
        # Update status if provided
        if availability.status:
            technician.status = availability.status
        
        db.commit()
        db.refresh(technician)
        
        return {
            "id": str(technician.id),
            "name": technician.name,
            "status": technician.status,
            "availability": technician.availability,
            "message": "Availability updated successfully"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating technician availability: {str(e)}"
        )

@router.get("/schedule/combined", response_model=ScheduleResponse)
async def get_combined_schedule(
    start_date: date,
    end_date: date,
    technician_id: Optional[uuid.UUID] = None,
    client_id: Optional[uuid.UUID] = None,
    view_type: str = "day",
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user_dependency)
):
    """
    Get appointment data for a date range. This endpoint only returns appointments
    and does not include work orders in the response, avoiding duplication.
    """
    try:
        from app.models.work_order import WorkOrderAppointment
        
        # Convert dates to datetime for query
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        # Get work order IDs for filtering appointments - Use OVERLAP logic
        work_order_query = db.query(WorkOrder.id).filter(
            WorkOrder.scheduled_start.isnot(None),
            WorkOrder.scheduled_end.isnot(None),
            WorkOrder.scheduled_start < end_datetime,  # NEW: Overlap check
            WorkOrder.scheduled_end > start_datetime   # NEW: Overlap check
        )

        # Apply filters based on parameters and user roles
        if technician_id:
            work_order_query = work_order_query.filter(WorkOrder.assigned_technician_id == technician_id)
        
        if client_id:
            work_order_query = work_order_query.filter(WorkOrder.client_id == client_id)

        # Apply role-based filtering
        if "technician" in current_user.roles:
            # Find technician ID for the current user
            technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
            if technician:
                work_order_query = work_order_query.filter(WorkOrder.assigned_technician_id == technician.id)
        elif "client" in current_user.roles:
            # Find client ID for the current user
            from app.models.client import Client
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if client:
                work_order_query = work_order_query.filter(WorkOrder.client_id == client.id)

        # Get work order IDs only
        work_order_ids = [wo_id for (wo_id,) in work_order_query.all()]
        
        # Now get appointments for these work orders - Use OVERLAP logic
        appointment_query = db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.work_order_id.in_(work_order_ids),
            WorkOrderAppointment.scheduled_start < end_datetime, # NEW: Overlap check
            WorkOrderAppointment.scheduled_end > start_datetime  # NEW: Overlap check
        )
        
        # Apply technician filter to appointments if specified
        if technician_id:
            appointment_query = appointment_query.filter(WorkOrderAppointment.assigned_technician_id == technician_id)
        
        # Get appointments
        appointments = appointment_query.all()
        
        # Load work orders for these appointments to avoid N+1 queries
        work_order_dict = {}
        for work_order in db.query(WorkOrder).filter(WorkOrder.id.in_(work_order_ids)).all():
            work_order_dict[work_order.id] = work_order
        
        # Format appointments for response
        formatted_appointments = []
        
        # Format appointments only (no work orders)
        for appt in appointments:
            work_order = work_order_dict.get(appt.work_order_id)
            if not work_order:
                continue
                
            # Get client name from related work order
            client_name = "Unknown"
            client_phone = None
            if work_order.client:
                client_name = work_order.client.company_name or f"{work_order.client.first_name} {work_order.client.last_name}"
                # Include client phone if available
                client_phone = work_order.client.phone
            
            # Get technician name
            technician_name = "Unassigned"
            if appt.technician:
                technician_name = appt.technician.name
                    
            formatted_appointments.append({
                "id": str(appt.id),
                "title": f"WO #{work_order.order_number} - {appt.appointment_type or 'Appointment'}",
                "start": appt.scheduled_start.isoformat() if appt.scheduled_start else None,
                "end": appt.scheduled_end.isoformat() if appt.scheduled_end else None,
                "status": appt.status or work_order.status,
                "technician_id": str(appt.assigned_technician_id) if appt.assigned_technician_id else None,
                "technician_name": technician_name,
                "client_id": str(work_order.client_id) if work_order.client_id else None,
                "client_name": client_name,
                "client_phone": client_phone,
                "location": work_order.service_location.get("address") if work_order.service_location else None,
                "description": appt.description if hasattr(appt, 'description') else work_order.description,
                "order_number": work_order.order_number,
                "priority": work_order.priority,
                "source": "appointment",
                "work_order_id": str(work_order.id),
                "appointment_type": appt.appointment_type,
                "equipment_type": work_order.equipment_type,
                "equipment_subtype": work_order.equipment_subtype,
                "equipment_make": work_order.equipment_make,
                "equipment_model": work_order.equipment_model,
            })

        # Get available technicians (for admin/manager)
        available_technicians = []
        if any(role in ["admin", "manager"] for role in current_user.roles):
            technicians = db.query(Technician).filter(Technician.status == "active").all()
            for tech in technicians:
                if tech.user:
                    available_technicians.append({
                        "id": str(tech.id),
                        "name": f"{tech.user.first_name} {tech.user.last_name}",
                    })

        return ScheduleResponse(
            appointments=formatted_appointments,
            date_range={
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            view_type=view_type,
            available_technicians=available_technicians
        )

    except Exception as e:
        logger.error(f"Error getting combined schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))