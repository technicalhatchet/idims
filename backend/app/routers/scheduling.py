from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, date

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.work_order import WorkOrder
from app.models.technician import Technician
from app.core.exceptions import NotFoundException, ValidationException, ConflictException
from app.schemas.scheduling import (
    AppointmentSlot, 
    ScheduleResponse, 
    AppointmentResponse,
    ScheduleRequest,
    TechnicianAvailability,
    AvailabilityResponse
)

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    start_date: date = Query(..., description="Start date for the schedule range"),
    end_date: date = Query(..., description="End date for the schedule range"),
    technician_id: Optional[uuid.UUID] = Query(None, description="Filter by technician ID"),
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    view_type: str = Query("day", description="View type (day, week, month, list)"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get schedule data for the given date range.
    Filter by technician or client if specified.
    """
    # Convert dates to datetime for query
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Base query for work orders
    query = db.query(WorkOrder).filter(
        (WorkOrder.scheduled_start >= start_datetime) & 
        (WorkOrder.scheduled_start <= end_datetime) &
        (WorkOrder.status.in_(["pending", "scheduled", "in_progress"]))
    )
    
    # Apply filters based on user role
    if current_user.role == "technician":
        # Technicians can only see their assignments
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician:
            raise NotFoundException("Technician profile not found")
        
        query = query.filter(WorkOrder.assigned_technician_id == technician.id)
    elif current_user.role == "client":
        # Clients can only see their own appointments
        from app.models.client import Client
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        
        query = query.filter(WorkOrder.client_id == client.id)
    elif technician_id:
        # Filter by specified technician for admins/managers
        query = query.filter(WorkOrder.assigned_technician_id == technician_id)
    elif client_id:
        # Filter by specified client for admins/managers
        query = query.filter(WorkOrder.client_id == client_id)
    
    # Get appointments
    appointments = query.all()
    
    # Format appointments for response
    formatted_appointments = []
    for appointment in appointments:
        # Get client name
        client_name = "Unknown"
        if appointment.client:
            client_name = appointment.client.company_name or f"{appointment.client.first_name} {appointment.client.last_name}"
        
        # Get technician name
        technician_name = "Unassigned"
        if appointment.technician:
            technician_name = appointment.technician.name
        
        formatted_appointments.append({
            "id": str(appointment.id),
            "title": appointment.title,
            "start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
            "end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
            "status": appointment.status,
            "client_id": str(appointment.client_id) if appointment.client_id else None,
            "client_name": client_name,
            "technician_id": str(appointment.assigned_technician_id) if appointment.assigned_technician_id else None,
            "technician_name": technician_name,
            "location": appointment.service_location.get("address") if appointment.service_location else None,
            "description": appointment.description,
            "order_number": appointment.order_number,
            "priority": appointment.priority
        })
    
    # Get available technicians (for admin/manager)
    available_technicians = []
    if current_user.role in ["admin", "manager"]:
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
    appointment_data: ScheduleRequest = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
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
    date: date = Query(..., description="Date to check for available slots"),
    technician_id: Optional[uuid.UUID] = Query(None, description="Technician ID to check availability for"),
    duration_minutes: int = Query(60, description="Duration of the appointment in minutes"),
    current_user: User = Depends(auth_handler.get_current_user),
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
        if current_user.role in ["admin", "manager"]:
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

@router.get("/technicians/availability", response_model=AvailabilityResponse)
async def get_technician_availability(
    technician_id: uuid.UUID = Query(..., description="Technician ID to check availability for"),
    start_date: date = Query(..., description="Start date of the range"),
    end_date: date = Query(..., description="End date of the range"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a technician's availability over a date range.
    Returns availability settings and booked appointments.
    """
    # Check permissions
    if current_user.role not in ["admin", "manager"] and technician_id != current_user.id:
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
    technician_id: uuid.UUID = Path(..., description="Technician ID to update availability for"),
    availability: TechnicianAvailability = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a technician's availability settings.
    """
    # Check permissions
    if current_user.role not in ["admin", "manager"]:
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