import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import and_, or_, not_, func
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, timedelta, time
import uuid

from app.models.work_order import WorkOrder
from app.models.technician import Technician
from app.models.client import Client
from app.models.user import User
from app.schemas.scheduling import ScheduleRequest, AppointmentSlot
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

logger = logging.getLogger(__name__)

class SchedulingService:
    """Service for handling scheduling operations"""
    
    @staticmethod
    async def get_schedule(
        db: Session,
        start_date: datetime,
        end_date: datetime,
        technician_id: Optional[uuid.UUID] = None,
        client_id: Optional[uuid.UUID] = None,
        view_type: str = "day"
    ) -> Dict[str, Any]:
        """Get schedule data for the given date range with filters"""
        query = db.query(WorkOrder).filter(
            (WorkOrder.scheduled_start >= start_date) & 
            (WorkOrder.scheduled_start <= end_date) &
            (WorkOrder.status.in_(["pending", "scheduled", "in_progress", "completed", 
                                "parts_on_order", "reschedule", "need_to_contact", "redo"]))
        )
        
        # Apply filters
        if technician_id:
            query = query.filter(WorkOrder.assigned_technician_id == technician_id)
        
        if client_id:
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
        
        # Get available technicians
        available_technicians = []
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
                "start": start_date.date().isoformat(),
                "end": end_date.date().isoformat()
            },
            "view_type": view_type,
            "available_technicians": available_technicians
        }
    
    @staticmethod
    async def schedule_appointment(
        db: Session,
        schedule_data: ScheduleRequest,
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Schedule a new appointment or update work order scheduling"""
        # Get the work order
        work_order = db.query(WorkOrder).filter(WorkOrder.id == schedule_data.work_order_id).first()
        if not work_order:
            raise NotFoundException(f"Work order with ID {schedule_data.work_order_id} not found")
        
        try:
            # Check for scheduling conflicts if a technician is assigned
            if schedule_data.technician_id:
                # Check if the technician is available
                technician = db.query(Technician).filter(Technician.id == schedule_data.technician_id).first()
                if not technician:
                    raise NotFoundException(f"Technician with ID {schedule_data.technician_id} not found")
                
                # Check technician status
                if technician.status != "active":
                    raise ValidationException(f"Technician is not active and cannot be scheduled")
                
                from app.services.scheduling_constraints_service import assert_technician_available

                assert_technician_available(
                    db,
                    schedule_data.technician_id,
                    schedule_data.start_time,
                    schedule_data.end_time,
                )
                
                # Update the work order with technician assignment
                work_order.assigned_technician_id = schedule_data.technician_id
            
            # Update scheduling info
            work_order.scheduled_start = schedule_data.start_time
            work_order.scheduled_end = schedule_data.end_time
            
            # Update status to scheduled if it's pending
            if work_order.status == "pending":
                work_order.status = "scheduled"
            
            # Update notes if provided
            if schedule_data.notes:
                # Add to existing notes or create new
                if work_order.description:
                    work_order.description += f"\n\nScheduling Notes: {schedule_data.notes}"
                else:
                    work_order.description = f"Scheduling Notes: {schedule_data.notes}"
            
            # Update "updated_by" field
            if hasattr(work_order, 'updated_by'):
                work_order.updated_by = user_id
            
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
                "notes": schedule_data.notes
            }
            
        except (NotFoundException, ValidationException, ConflictException):
            raise
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error scheduling appointment: {str(e)}")
            raise ConflictException(f"Failed to schedule appointment: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error scheduling appointment: {str(e)}")
            raise ValidationException(f"Failed to schedule appointment: {str(e)}")
    
    @staticmethod
    async def get_available_slots(
        db: Session,
        date_value: datetime,
        technician_id: Optional[uuid.UUID] = None,
        duration_minutes: int = 60
    ) -> List[AppointmentSlot]:
        """Get available appointment slots for the given date and technician"""
        # Convert date to datetime objects for the full day
        start_datetime = datetime.combine(date_value.date(), time(0, 0))
        end_datetime = datetime.combine(date_value.date(), time(23, 59, 59))
        
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
            # Get all active technicians
            technicians = db.query(Technician).filter(Technician.status == "active").all()
        
        from app.services.scheduling_constraints_service import generate_available_slots

        on_date = date_value.date() if hasattr(date_value, "date") else date_value
        return generate_available_slots(
            db,
            on_date,
            [t for t in technicians if t],
            duration_minutes,
            business_start_hour=business_start_hour,
            business_end_hour=business_end_hour,
            slot_interval_minutes=slot_interval,
        )
    
    @staticmethod
    async def get_technician_availability(
        db: Session,
        technician_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get a technician's availability over a date range"""
        # Get technician
        technician = db.query(Technician).filter(Technician.id == technician_id).first()
        if not technician:
            raise NotFoundException(f"Technician with ID {technician_id} not found")
        
        # Get scheduled appointments
        appointments = db.query(WorkOrder).filter(
            WorkOrder.assigned_technician_id == technician_id,
            WorkOrder.status.in_(["scheduled", "in_progress"]),
            WorkOrder.scheduled_start >= start_date,
            WorkOrder.scheduled_start <= end_date
        ).all()
        
        # Format appointments
        formatted_appointments = []
        for appointment in appointments:
            # Get client name
            client_name = "Unknown"
            if appointment.client:
                client_name = appointment.client.company_name or f"{appointment.client.first_name} {appointment.client.last_name}"
                
            formatted_appointments.append({
                "id": str(appointment.id),
                "start": appointment.scheduled_start.isoformat() if appointment.scheduled_start else None,
                "end": appointment.scheduled_end.isoformat() if appointment.scheduled_end else None,
                "title": appointment.title,
                "order_number": appointment.order_number,
                "client_name": client_name,
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
                "start": start_date.date().isoformat(),
                "end": end_date.date().isoformat()
            }
        }
    
    @staticmethod
    async def update_technician_availability(
        db: Session,
        technician_id: uuid.UUID,
        availability_data: Dict[str, Any],
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Update a technician's availability settings"""
        # Get technician
        technician = db.query(Technician).filter(Technician.id == technician_id).first()
        if not technician:
            raise NotFoundException(f"Technician with ID {technician_id} not found")
        
        try:
            # Update availability settings
            technician.availability = {
                "workDays": availability_data["work_days"],
                "workHours": {
                    "start": availability_data["work_hours"]["start"],
                    "end": availability_data["work_hours"]["end"]
                },
                "exceptions": availability_data.get("exceptions", [])
            }
            
            # Update status if provided
            if availability_data.get("status"):
                technician.status = availability_data["status"]
            
            # Update the "updated_by" field if it exists
            if hasattr(technician, 'updated_by'):
                technician.updated_by = user_id
            
            db.commit()
            db.refresh(technician)
            
            return {
                "id": str(technician.id),
                "name": technician.name,
                "status": technician.status,
                "availability": technician.availability,
                "message": "Availability updated successfully"
            }
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating technician availability: {str(e)}")
            raise ConflictException(f"Failed to update technician availability: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating technician availability: {str(e)}")
            raise ValidationException(f"Failed to update technician availability: {str(e)}")
