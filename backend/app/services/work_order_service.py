from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text, select, cast, Date, or_
from typing import Optional, List, Dict, Any, Union, Tuple
import re
import uuid
from uuid import UUID
from datetime import datetime, timezone, date as py_date, timedelta
import logging
from sqlalchemy.future import select as future_select
from decimal import Decimal

from app.models.work_order import (
    WorkOrder,
    WorkOrderStatusHistory,
    WorkOrderService as WorkOrderServiceModel,
    WorkOrderItem,
    WorkOrderNote,
    WorkOrderAppointment,
    WorkOrderPart,
    WorkOrderActivityLog,
    WorkOrderPerformanceMetric,
    appointment_services_association,
)
from app.services import work_order_activity_service as activity
from app.models.service import Service
from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderAppointmentCreate,
    WorkOrderAppointmentUpdate,
    InitialAppointmentCreate,
)
from app.core.exceptions import NotFoundException, ConflictException, ValidationException, BadRequestException
from app.utils import travel_calculator
from app.models.technician import Technician
from app.models.technician_skill import TechnicianSkill
from app.models.skill import Skill
from app.models.invoice import Invoice, InvoiceItem
from app.schemas.work_order import WorkOrderNoteCreate, WorkOrderPartCreate, WorkOrderPartUpdate
from app.schemas.scheduling import ScheduleRequest
from app.services.user_service import UserService
from app.utils.travel_calculator import (
    get_travel_time_and_distance 
)
from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_appointment_start(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt.replace(second=0, microsecond=0)


def _appointment_starts_equal(a: Optional[datetime], b: Optional[datetime]) -> bool:
    return _normalize_appointment_start(a) == _normalize_appointment_start(b)

NOTE_TYPE_STATUS_UPDATE = "Status Update"
NOTE_TYPE_APPOINTMENT_INFO = "Appointment Info"
NOTE_TYPE_REPAIR_OUTCOME = "Repair Outcome"

# Note types that should default to private (not shown to clients)
PRIVATE_NOTE_TYPES = frozenset({
    NOTE_TYPE_STATUS_UPDATE,
    NOTE_TYPE_APPOINTMENT_INFO,
    NOTE_TYPE_REPAIR_OUTCOME,
})

_SYSTEM_STATUS_NOTE_PREFIXES = (
    "Assigned to technician ",
    "Status synced:",
)


def _format_status_label(status) -> str:
    if status is None:
        return "unknown"
    return status.value if hasattr(status, "value") else str(status)


def _is_user_status_note(notes: Optional[str]) -> bool:
    if not notes or not str(notes).strip():
        return False
    text = str(notes).strip()
    if text == "Status updated":
        return False
    return not any(text.startswith(prefix) for prefix in _SYSTEM_STATUS_NOTE_PREFIXES)


def _add_work_order_typed_note(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    note_type: str,
    body: str,
    is_private: Optional[bool] = None,
) -> None:
    text = (body or "").strip()
    if not text:
        return
    if is_private is None:
        is_private = note_type in PRIVATE_NOTE_TYPES
    db.add(
        WorkOrderNote(
            work_order_id=work_order_id,
            user_id=user_id,
            note=f"[{note_type}]\n{text}",
            is_private=is_private,
        )
    )


class WorkOrderService:
    """Enhanced service for handling work order operations"""
    
    def __init__(self, db: Session):
        """Initialize the service with a database session"""
        self.db = db
    
    @staticmethod
    async def get_work_orders(
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[str] = None,
        client_id: Optional[uuid.UUID] = None,
        technician_id: Optional[uuid.UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get work orders with filtering options"""
        logger.debug("Starting WorkOrderService.get_work_orders")
        query = db.query(WorkOrder)
        
        # Apply filters
        if status:
            logger.debug(f"Filtering by status: {status}")
            query = query.filter(WorkOrder.status == status)
        if client_id:
            logger.debug(f"Filtering by client_id: {client_id}")
            query = query.filter(WorkOrder.client_id == client_id)
        if technician_id:
            logger.debug(f"Filtering by technician_id: {technician_id}")
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
        if start_date:
            logger.debug(f"Filtering by start_date >= {start_date}")
            query = query.filter(WorkOrder.scheduled_start >= start_date)
        if end_date:
            logger.debug(f"Filtering by end_date <= {end_date}")
            query = query.filter(WorkOrder.scheduled_start <= end_date)
        
        # Get total count for pagination
        total = query.count()
        logger.debug(f"Total work orders matching filters: {total}")
        
        # Apply pagination
        query = query.order_by(WorkOrder.created_at.desc())
        work_orders = query.offset(skip).limit(limit).all()
        logger.debug(f"Retrieved {len(work_orders)} work orders")
        
        # For empty results, return empty list instead of None
        if not work_orders:
            work_orders = []
        
        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 0
        page = skip // limit + 1 if limit > 0 else 1
        
        return {
            "total": total,
            "items": work_orders,
            "page": page,
            "pages": pages
        }
    
    @staticmethod
    async def get_work_order(db: Session, work_order_id: uuid.UUID) -> WorkOrder:
        """Get a specific work order by ID"""
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        
        if not work_order:
            raise NotFoundException(f"Work order with ID {work_order_id} not found")
        
        return work_order

    @staticmethod
    def get_work_order_detail(db: Session, work_order_id: uuid.UUID) -> WorkOrder:
        """Load a work order with related rows for the detail API (avoids N+1 queries)."""
        from sqlalchemy.orm import selectinload, joinedload
        from app.models.client import Client
        from app.models.technician import Technician
        from app.models.work_order import (
            WorkOrderAppointment,
            WorkOrderNote,
            WorkOrderService as WorkOrderServiceModel,
        )

        work_order = (
            db.query(WorkOrder)
            .options(
                joinedload(WorkOrder.client).selectinload(Client.properties),
                joinedload(WorkOrder.client).joinedload(Client.user),
                joinedload(WorkOrder.technician).joinedload(Technician.user),
                selectinload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service),
                selectinload(WorkOrder.items),
                selectinload(WorkOrder.parts),
                selectinload(WorkOrder.appointments).selectinload(WorkOrderAppointment.services),
                selectinload(WorkOrder.appointments)
                .joinedload(WorkOrderAppointment.technician)
                .joinedload(Technician.user),
                selectinload(WorkOrder.notes).joinedload(WorkOrderNote.user),
            )
            .filter(WorkOrder.id == work_order_id)
            .first()
        )

        if not work_order:
            raise NotFoundException(f"Work order with ID {work_order_id} not found")

        return work_order
    
    @staticmethod
    async def create_work_order(
        db: Session,
        work_order_data: Dict[str, Any],
        *,
        commit: bool = True,
    ) -> WorkOrder:
        """
        Create a new work order from WorkOrderCreate schema data.
        Returns the created work order object directly.

        If commit is False, the caller must commit (e.g. composite create with initial appointment).
        """
        try:
            # Generate a sequential order number if not provided
            if "order_number" not in work_order_data:
                order_number = await WorkOrderService.get_next_work_order_number(db)
                logger.info(f"Generated sequential work order number: {order_number}")
            else:
                order_number = work_order_data["order_number"]
                
                # Verify the provided order number is unique
                if db.query(WorkOrder).filter(WorkOrder.order_number == order_number).first():
                    raise ValidationException(f"Work order number {order_number} already exists")
            
            # Create work order with mandatory fields
            work_order = WorkOrder(
                client_id=work_order_data["client_id"],
                # title=work_order_data["title"], # Removed title
                description=work_order_data.get("description"),
                priority=work_order_data.get("priority", "medium"),
                status="pending",  # Always set status to pending by default
                order_number=order_number,
                created_by=work_order_data["created_by"],
                service_location=work_order_data.get("service_location"),
                is_recurring=work_order_data.get("is_recurring", False),
                recurrence_pattern=work_order_data.get("recurrence_pattern"),
                # Add equipment fields
                equipment_make=work_order_data.get("equipment_make"),
                equipment_model=work_order_data.get("equipment_model"),
                equipment_serial=work_order_data.get("equipment_serial"),
                equipment_version=work_order_data.get("equipment_version"),
                equipment_type=work_order_data.get("equipment_type"),
                equipment_subtype=work_order_data.get("equipment_subtype"),
                is_wall_mounted=work_order_data.get("is_wall_mounted", False),
                equipment_notes=work_order_data.get("equipment_notes"),
                symptoms=work_order_data.get("symptoms")
            )
            
            db.add(work_order)
            db.flush()  # Get the work_order.id
            
            # Add work order services if provided
            if "services" in work_order_data and work_order_data["services"]:
                for service in work_order_data["services"]:
                    work_order_service = WorkOrderServiceModel(
                        work_order_id=work_order.id,
                        service_id=service["service_id"],
                        quantity=service.get("quantity", 1.0),
                        price=service.get("price"),
                        notes=service.get("notes")
                    )
                    db.add(work_order_service)
            
            # Add work order items if provided
            if "items" in work_order_data and work_order_data["items"]:
                for item in work_order_data["items"]:
                    work_order_item = WorkOrderItem(
                        work_order_id=work_order.id,
                        # inventory_item_id field removed - doesn't exist in database
                        description=item.get("description", "Item"),
                        quantity=item.get("quantity", 1.0),
                        price=item.get("price", 0.0),
                        notes=item.get("notes")
                    )
                    db.add(work_order_item)
            
            # Create initial status history
            status_history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                previous_status='',  # Empty string instead of None for the first status
                new_status=work_order.status,
                changed_by=work_order_data["created_by"],
                notes="Work order created"
            )
            db.add(status_history)

            activity.log_work_order_created(db, work_order.id, work_order_data["created_by"])
            
            if commit:
                db.commit()
                db.refresh(work_order)
                await WorkOrderService._schedule_notifications(db, work_order)
            else:
                db.flush()
                db.refresh(work_order)

            logger.info(f"Created work order with ID: {work_order.id}")
            return work_order

        except Exception as e:
            db.rollback()
            logger.error(f"Error creating work order: {str(e)}")
            raise ValidationException(f"Failed to create work order: {str(e)}")

    @staticmethod
    async def create_work_order_with_initial_appointment(
        db: Session,
        work_order_data: Dict[str, Any],
        initial_appointment: InitialAppointmentCreate,
        user_id: uuid.UUID,
    ) -> Tuple[WorkOrder, WorkOrderAppointment]:
        """
        Create a work order and first appointment in one transaction, then send the same
        notifications as a standalone work order create (after commit).
        """
        try:
            work_order = await WorkOrderService.create_work_order(db, work_order_data, commit=False)
            initial_payload = (
                initial_appointment.model_dump()
                if hasattr(initial_appointment, "model_dump")
                else initial_appointment.dict()
            )
            appt_in = WorkOrderAppointmentCreate(
                work_order_id=work_order.id,
                **initial_payload,
            )
            svc = WorkOrderService(db)
            appointment = await svc.create_work_order_appointment(
                appt_in, user_id, commit=False
            )
            db.commit()
            db.refresh(work_order)
            db.refresh(appointment)
            await WorkOrderService._schedule_notifications(db, work_order)
            return work_order, appointment
        except (ValidationException, NotFoundException):
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error in create_work_order_with_initial_appointment: {str(e)}", exc_info=True)
            raise ValidationException(f"Failed to create work order with appointment: {str(e)}")
    
    @staticmethod
    async def update_work_order(
        db: Session, 
        work_order_id: uuid.UUID, 
        work_order_data: WorkOrderUpdate
    ) -> WorkOrder:
        """Update an existing work order"""
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        from app.services.work_order_lifecycle_service import assert_work_order_mutable

        assert_work_order_mutable(work_order)
        
        # Validate technician if assigned
        if work_order_data.assigned_technician_id:
            from app.models.technician import Technician
            technician = db.query(Technician).filter(
                Technician.id == work_order_data.assigned_technician_id
            ).first()
            
            if not technician:
                # For now, instead of failing, just set the technician ID to None
                logger.warning(f"Technician with ID {work_order_data.assigned_technician_id} not found; setting to None")
                work_order_data.assigned_technician_id = None
                
        # Validate client if assigned
        if work_order_data.client_id:
            from app.models.client import Client
            client = db.query(Client).filter(
                Client.id == work_order_data.client_id
            ).first()
            
            if not client:
                # For now, instead of failing, just keep the existing client ID
                logger.warning(f"Client with ID {work_order_data.client_id} not found; keeping original client")
                work_order_data.client_id = work_order.client_id
        
        try:
            # Begin transaction
            update_data = work_order_data.dict(exclude_unset=True)
            previous_status = work_order.status
            previous_technician_id = work_order.assigned_technician_id
            
            # Ensure status is not null - if it's null, keep the existing status
            if "status" in update_data and update_data["status"] is None:
                logger.warning(f"Status is null in update data, keeping existing status: {work_order.status}")
                update_data.pop("status")
            
            # If status is changing, create status history
            if "status" in update_data and update_data["status"] != work_order.status:
                # Create status history record
                status_history = WorkOrderStatusHistory(
                    work_order_id=work_order.id,
                    previous_status=work_order.status,
                    new_status=update_data["status"],
                    changed_by=update_data.get("updated_by", work_order.created_by),
                    notes=update_data.get("status_notes", "Status updated")
                )
                db.add(status_history)
                activity.log_work_order_status_changed(
                    db,
                    work_order.id,
                    update_data.get("updated_by", work_order.created_by),
                    activity._status_val(previous_status),
                    activity._status_val(update_data["status"]),
                )
                status_notes_raw = update_data.get("status_notes")
                if _is_user_status_note(status_notes_raw):
                    actor_id = update_data.get("updated_by", work_order.created_by)
                    if actor_id:
                        _add_work_order_typed_note(
                            db,
                            work_order_id=work_order.id,
                            user_id=actor_id,
                            note_type=NOTE_TYPE_STATUS_UPDATE,
                            body=(
                                f"Status changed: {_format_status_label(previous_status)}"
                                f" → {_format_status_label(update_data['status'])}\n\n"
                                f"{str(status_notes_raw).strip()}"
                            ),
                        )
                
                # Set timestamps based on status
                if update_data["status"] == "in_progress" and not work_order.actual_start:
                    work_order.actual_start = datetime.utcnow()
                elif update_data["status"] == "completed" and not work_order.actual_end:
                    work_order.actual_end = datetime.utcnow()
            
            # Update the work order with provided fields
            for key, value in update_data.items():
                if key not in ["updated_by", "status_notes"]:
                    setattr(work_order, key, value)

            actor_id = update_data.get("updated_by", work_order.updated_by or work_order.created_by)
            if "status" in update_data and activity._status_val(update_data["status"]) != activity._status_val(previous_status):
                from app.services.work_order_performance_service import handle_work_order_status_timing
                handle_work_order_status_timing(
                    db,
                    work_order=work_order,
                    previous_status=activity._status_val(previous_status),
                    user_id=actor_id,
                )
                from app.services.work_order_status_sync_service import (
                    sync_appointments_from_work_order_status,
                )

                sync_appointments_from_work_order_status(
                    db,
                    work_order,
                    actor_id,
                    previous_work_order_status=activity._status_val(previous_status),
                    new_work_order_status=activity._status_val(update_data["status"]),
                )

            if (
                "assigned_technician_id" in update_data
                and update_data["assigned_technician_id"] != previous_technician_id
                and update_data["assigned_technician_id"] is not None
            ):
                tech_name = None
                tech = (
                    db.query(Technician)
                    .options(selectinload(Technician.user))
                    .filter(Technician.id == update_data["assigned_technician_id"])
                    .first()
                )
                if tech and tech.user:
                    tech_name = activity.get_user_display_name(tech.user)
                activity.log_work_order_assigned(db, work_order.id, actor_id, tech_name)
            
            db.commit()
            db.refresh(work_order)
            
            return work_order
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating work order: {str(e)}")
            raise ConflictException(f"Failed to update work order: {str(e)}")
        except (ConflictException, BadRequestException, ValidationException, NotFoundException):
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating work order: {str(e)}")
            raise BadRequestException(f"Failed to update work order: {str(e)}")
    
    @staticmethod
    async def delete_work_order(db: Session, work_order_id: uuid.UUID) -> bool:
        """Delete a work order"""
        try:
            logger.info(f"Attempting to delete work order with ID: {work_order_id}")
            
            work_order = await WorkOrderService.get_work_order(db, work_order_id)
            
            # Prevent deleting completed or in_progress work orders
            if work_order.status in ["completed", "in_progress"]:
                logger.warning(f"Cannot delete work order with status {work_order.status}")
                raise ConflictException(f"Cannot delete a work order with status {work_order.status}")
            
            # Check if there are invoices related to this work order
            # Using raw SQL to be safer and avoid ORM model mismatches
            logger.info(f"Checking for associated invoices for work order {work_order_id}")
            invoice_exists = db.execute(
                text("SELECT COUNT(*) FROM invoices WHERE work_order_id = :work_order_id"),
                {"work_order_id": str(work_order_id)}
            ).scalar()
            
            logger.info(f"Found {invoice_exists} invoices for work order {work_order_id}")
            
            if invoice_exists and int(invoice_exists) > 0:
                logger.warning(f"Work order {work_order_id} has {invoice_exists} associated invoices, cannot delete")
                raise ConflictException("Cannot delete work order with associated invoices")
            
            # Delete associated records
            try:
                logger.info(f"Deleting status history records for work order {work_order_id}")
                status_count = db.query(WorkOrderStatusHistory).filter(
                    WorkOrderStatusHistory.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {status_count} status history records")
                
                logger.info(f"Deleting service records for work order {work_order_id}")
                service_count = db.query(WorkOrderServiceModel).filter(
                    WorkOrderServiceModel.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {service_count} service records")
                
                logger.info(f"Deleting item records for work order {work_order_id}")
                item_count = db.query(WorkOrderItem).filter(
                    WorkOrderItem.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {item_count} item records")
                
                logger.info(f"Deleting note records for work order {work_order_id}")
                note_count = db.query(WorkOrderNote).filter(
                    WorkOrderNote.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {note_count} note records")

                logger.info(f"Deleting performance metrics for work order {work_order_id}")
                metric_count = db.query(WorkOrderPerformanceMetric).filter(
                    WorkOrderPerformanceMetric.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {metric_count} performance metric records")

                logger.info(f"Deleting activity log records for work order {work_order_id}")
                activity_count = db.query(WorkOrderActivityLog).filter(
                    WorkOrderActivityLog.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {activity_count} activity log records")

                logger.info(f"Deleting part records for work order {work_order_id}")
                part_count = db.query(WorkOrderPart).filter(
                    WorkOrderPart.work_order_id == work_order_id
                ).delete()
                logger.info(f"Deleted {part_count} part records")

                appointment_ids = [
                    row[0]
                    for row in db.query(WorkOrderAppointment.id).filter(
                        WorkOrderAppointment.work_order_id == work_order_id
                    ).all()
                ]
                if appointment_ids:
                    logger.info(
                        f"Deleting appointment service links for {len(appointment_ids)} appointments"
                    )
                    db.execute(
                        appointment_services_association.delete().where(
                            appointment_services_association.c.appointment_id.in_(appointment_ids)
                        )
                    )

                logger.info(f"Deleting appointment records for work order {work_order_id}")
                appointment_count = db.query(WorkOrderAppointment).filter(
                    WorkOrderAppointment.work_order_id == work_order_id
                ).delete(synchronize_session=False)
                logger.info(f"Deleted {appointment_count} appointment records")
                
                # Delete the work order
                logger.info(f"Deleting work order {work_order_id}")
                
                # Use a direct SQL delete instead of ORM to avoid loading relationships
                db.execute(
                    text("DELETE FROM work_orders WHERE id = :work_order_id"),
                    {"work_order_id": str(work_order_id)}
                )
                db.commit()
                
                logger.info(f"Successfully deleted work order {work_order_id} and all related records")
                return True
            except Exception as e:
                db.rollback()
                logger.error(f"Error deleting work order dependencies: {str(e)}")
                raise ConflictException(f"Failed to delete work order dependencies: {str(e)}")
                
        except ConflictException:
            raise
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting work order: {str(e)}")
            raise ConflictException(f"Failed to delete work order: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting work order: {str(e)}")
            raise BadRequestException(f"Failed to delete work order: {str(e)}")
    
    @staticmethod
    async def _schedule_notifications(db: Session, work_order: WorkOrder) -> None:
        """Schedule notifications for work order events"""
        # Import here to avoid circular imports
        from app.services.notification_service import NotificationService
        from app.models.client import Client
        from app.models.user import User
        from app.models.technician import Technician
        from app.schemas.notification import NotificationCreate
        
        try:
            # Notify client about new work order
            if work_order.client_id:
                client = db.query(Client).filter(Client.id == work_order.client_id).first()
                
                if client and client.user_id:
                    client_notification = NotificationCreate(
                        user_id=client.user_id,
                        title="New Work Order Created",
                        content=f"A new work order #{work_order.order_number} has been created for you",
                        type="in_app",
                        related_id=work_order.id,
                        related_type="work_order"
                    )
                    
                    await NotificationService.create_notification(db, client_notification, send_immediately=True)
            
            # Notify technician if assigned
            if work_order.assigned_technician_id:
                technician = db.query(Technician).filter(
                    Technician.id == work_order.assigned_technician_id
                ).first()
                
                if technician and technician.user_id:
                    tech_notification = NotificationCreate(
                        user_id=technician.user_id,
                        title="New Job Assignment",
                        content=f"You have been assigned to work order #{work_order.order_number}",
                        type="in_app",
                        related_id=work_order.id,
                        related_type="work_order"
                    )
                    
                    await NotificationService.create_notification(db, tech_notification, send_immediately=True)
                    
                    # Schedule reminders if work order is scheduled
                    if work_order.scheduled_start:
                        from app.background.tasks.reminders import schedule_appointment_reminder
                        
                        # Schedule reminders for 24 hours and 1 hour before appointment
                        schedule_appointment_reminder.delay(
                            work_order_id=str(work_order.id),
                            user_id=str(technician.user_id),
                            scheduled_time=work_order.scheduled_start.isoformat(),
                            hours_before=24
                        )
                        
                        schedule_appointment_reminder.delay(
                            work_order_id=str(work_order.id),
                            user_id=str(technician.user_id),
                            scheduled_time=work_order.scheduled_start.isoformat(),
                            hours_before=1
                        )
        except Exception as e:
            # Log error but don't fail the work order creation
            logger.error(f"Error scheduling notifications: {str(e)}")

    @staticmethod
    async def update_work_order_status(
        db: Session,
        work_order_id: uuid.UUID,
        status: str,
        notes: Optional[str] = None
    ) -> WorkOrderResponse:
        """
        Update a work order's status.
        """
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        
        if not work_order:
            raise NotFoundException(f"Work order with ID {work_order_id} not found")
        
        # Validate status transition
        valid_transitions = {
            "scheduled": ["in_progress", "canceled"],
            "in_progress": ["completed", "canceled"],
            "completed": ["billed"],
            "canceled": ["scheduled"]
        }
        
        if status not in valid_transitions.get(work_order.status, []):
            raise ValidationException(
                f"Cannot transition work order from {work_order.status} to {status}"
            )
        
        # Save previous status before updating
        previous_status = work_order.status if work_order.status else ''
        
        # Update work order status
        work_order.status = status
        if notes:
            work_order.notes = f"{work_order.notes}\nStatus Update: {notes}"
        work_order.updated_at = datetime.utcnow()
        
        # Create status history record
        status_history = WorkOrderStatusHistory(
            work_order_id=work_order.id,
            previous_status=previous_status,
            new_status=status,
            changed_by=work_order.updated_by or work_order.created_by,
            notes=notes or "Status updated"
        )
        db.add(status_history)
        
        db.commit()
        db.refresh(work_order)
        
        return work_order

    @staticmethod
    async def get_next_work_order_number(db: Session) -> str:
        """
        Generate the next available work order number in the sequence.
        Format: CT-NNNNNN where NNNNNN is a 6-digit sequential number starting at 001002.
        """
        # Find the highest order number currently in use
        latest_work_order = db.query(WorkOrder).filter(
            WorkOrder.order_number.like("CT-%")
        ).order_by(WorkOrder.order_number.desc()).first()
        
        if latest_work_order:
            # Extract the number portion and increment
            try:
                # Get the number part after "CT-"
                current_number = int(latest_work_order.order_number.split('-')[1])
                next_number = current_number + 1
            except (ValueError, IndexError):
                # If parsing fails, start from 001002
                logger.warning(f"Could not parse order number from {latest_work_order.order_number}, starting from 001002")
                next_number = 1002
        else:
            # No existing work orders, start from 001002
            next_number = 1002
        
        # Format with leading zeros to ensure 6 digits
        next_order_number = f"CT-{next_number:06d}"
        
        # Check if this order number already exists (in case of race conditions)
        while db.query(WorkOrder).filter(WorkOrder.order_number == next_order_number).first():
            logger.warning(f"Work order number {next_order_number} already exists, incrementing")
            next_number += 1
            next_order_number = f"CT-{next_number:06d}"
        
        return next_order_number

    @staticmethod
    async def get_work_order_appointments(
        db: Session,
        work_order_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get appointments for a specific work order with optional filtering"""
        logger.debug(f"Starting WorkOrderService.get_work_order_appointments for work_order_id: {work_order_id}")
        
        # Verify work order exists
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Query appointments with services eagerly loaded
        query = db.query(WorkOrderAppointment).options(
            selectinload(WorkOrderAppointment.services)
        ).filter(WorkOrderAppointment.work_order_id == work_order_id)
        
        # Apply status filter if provided
        if status:
            logger.debug(f"Filtering appointments by status: {status}")
            query = query.filter(WorkOrderAppointment.status == status)
        
        # Get total count for pagination
        total = query.count()
        logger.debug(f"Total appointments matching filters: {total}")
        
        # Apply pagination and ordering
        query = query.order_by(WorkOrderAppointment.scheduled_start.asc())
        appointments = query.offset(skip).limit(limit).all()
        logger.debug(f"Retrieved {len(appointments)} appointments")
        
        # For empty results, return empty list instead of None
        if not appointments:
            appointments = []
        
        # Calculate pages
        pages = (total + limit - 1) // limit if limit > 0 else 0
        page = skip // limit + 1 if limit > 0 else 1
        
        return {
            "total": total,
            "items": appointments,
            "page": page,
            "pages": pages
        }
    
    @staticmethod
    async def get_work_order_appointment(
        db: Session, 
        appointment_id: uuid.UUID
    ) -> WorkOrderAppointment:
        """Get a specific appointment by ID, including its associated services."""
        appointment = db.query(WorkOrderAppointment).options(
            selectinload(WorkOrderAppointment.services)
        ).filter(WorkOrderAppointment.id == appointment_id).first()
        
        if not appointment:
            raise NotFoundException(f"Appointment with ID {appointment_id} not found")
        
        return appointment
    
    async def create_work_order_appointment(
        self,
        appointment_data: WorkOrderAppointmentCreate,
        user_id: uuid.UUID,
        *,
        commit: bool = True,
    ) -> WorkOrderAppointment:
        """Create a new work order appointment, adjusting start time based on travel from previous appointment and calculating end time based on services."""
        try:
            # Verify work order exists
            work_order = await WorkOrderService.get_work_order(self.db, appointment_data.work_order_id)
            if not work_order:
                raise NotFoundException(f"Work order with ID {appointment_data.work_order_id} not found.")

            from app.services.work_order_lifecycle_service import assert_work_order_mutable

            assert_work_order_mutable(work_order)

            # Calculate scheduled_end based on services or default to 1 hour
            # scheduled_end is not expected in WorkOrderAppointmentCreate schema, so we calculate it here.
            estimated_duration_minutes = 45  # Default slot length when no SKU duration
            if appointment_data.service_ids:
                total_service_duration = 0
                for service_id in appointment_data.service_ids:
                    service = self.db.query(Service).filter(Service.id == service_id).first()
                    if service and service.duration_minutes:
                        total_service_duration += service.duration_minutes
                if total_service_duration > 0:
                    estimated_duration_minutes = total_service_duration
            
            # Ensure scheduled_start is present before calculation
            if not appointment_data.scheduled_start:
                raise ValidationException("scheduled_start is required to create an appointment.")
            
            calculated_scheduled_end = appointment_data.scheduled_start + timedelta(minutes=estimated_duration_minutes)

            resolved_technician_id = (
                appointment_data.assigned_technician_id or work_order.assigned_technician_id
            )
            if resolved_technician_id and not appointment_data.is_forced_schedule:
                from app.services.scheduling_constraints_service import assert_technician_available

                assert_technician_available(
                    self.db,
                    resolved_technician_id,
                    appointment_data.scheduled_start,
                    calculated_scheduled_end,
                )

            if resolved_technician_id and work_order.assigned_technician_id != resolved_technician_id:
                work_order.assigned_technician_id = resolved_technician_id

            db_appointment = WorkOrderAppointment(
                work_order_id=appointment_data.work_order_id,
                appointment_type=appointment_data.appointment_type,
                scheduled_start=appointment_data.scheduled_start,
                scheduled_end=calculated_scheduled_end, # Use the calculated end time
                assigned_technician_id=resolved_technician_id,
                status="scheduled",  # Default status
                created_by=user_id, # Make sure current_user_id is available in this scope
                notes=appointment_data.notes,
                travel_time_before=appointment_data.travel_time_before,
                travel_time_after=appointment_data.travel_time_after,
                travel_distance_before=appointment_data.travel_distance_before,
                travel_distance_after=appointment_data.travel_distance_after,
                is_forced_schedule=appointment_data.is_forced_schedule,
                time_window=appointment_data.time_window
            )
            self.db.add(db_appointment)
            self.db.flush() # Flush to get db_appointment.id

            # Link services ↔ appointment (many-to-many) so UI and APIs can show SKUs on the visit
            if appointment_data.service_ids:
                linked = set()
                for service_id in appointment_data.service_ids:
                    if service_id in linked:
                        continue
                    linked.add(service_id)
                    if not self.db.query(Service).filter(Service.id == service_id).first():
                        logger.warning(
                            "Service %s not found; skipping appointment_services link.", service_id
                        )
                        continue
                    self.db.execute(
                        appointment_services_association.insert().values(
                            appointment_id=db_appointment.id,
                            service_id=service_id,
                        )
                    )

            # Logic for Invoice and InvoiceItems
            if appointment_data.service_ids:
                logger.info(f"Processing {len(appointment_data.service_ids)} service_ids for invoicing: {appointment_data.service_ids}")
                # Ensure invoice exists or create it
                invoice = self.db.query(Invoice).filter(Invoice.work_order_id == db_appointment.work_order_id).first()
                if not invoice:
                    if not work_order.client_id:
                        logger.error(f"Work order {work_order.id} must have a client to create an invoice. Aborting invoice creation for this appointment.")
                        raise ValidationException("Work order must have a client to create an invoice.")
                    logger.info(f"No existing invoice found for work order {db_appointment.work_order_id}. Creating a new one.")
                    invoice = Invoice(
                        invoice_number=f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{str(db_appointment.work_order_id)[:4]}",
                        client_id=work_order.client_id,
                        work_order_id=db_appointment.work_order_id,
                        status="draft",
                        issue_date=datetime.utcnow(),
                        due_date=datetime.utcnow(), # Consider a proper due_date logic
                        created_by=user_id
                    )
                    self.db.add(invoice)
                    self.db.flush() # Flush to get invoice.id
                    logger.info(f"Created new invoice {invoice.id} for work order {db_appointment.work_order_id}.")
                else:
                    logger.info(f"Found existing invoice {invoice.id} for work order {db_appointment.work_order_id}.")

                current_invoice_subtotal = Decimal(invoice.subtotal) or Decimal(0.0) # Start with existing subtotal if any
                for service_id_from_appointment in appointment_data.service_ids:
                    logger.info(f"Processing service_id {service_id_from_appointment} for invoice {invoice.id}.")
                    main_service = self.db.query(Service).filter(Service.id == service_id_from_appointment).first()
                    if not main_service:
                        logger.warning(f"Service with ID {service_id_from_appointment} not found in main services table. Skipping for invoice item creation.")
                        continue
                    logger.info(f"Found main_service: {main_service.name} (ID: {main_service.id}) with base_price: {main_service.base_price}")

                    work_order_service_entry = self.db.query(WorkOrderServiceModel).filter(
                        WorkOrderServiceModel.work_order_id == db_appointment.work_order_id,
                        WorkOrderServiceModel.service_id == main_service.id
                    ).first()

                    if not work_order_service_entry:
                        logger.info(f"No WorkOrderService entry found for WO {db_appointment.work_order_id} and Service {main_service.id}. Creating one.")
                        calculated_price = Decimal(1) * Decimal(main_service.base_price) # Assuming quantity is 1 initially
                        work_order_service_entry = WorkOrderServiceModel(
                            work_order_id=db_appointment.work_order_id,
                            service_id=main_service.id,
                            appointment_id=db_appointment.id,
                            name=main_service.name,
                            quantity=1,
                            unit_price=Decimal(main_service.base_price),
                            price=calculated_price
                        )
                        self.db.add(work_order_service_entry)
                        self.db.flush() # Get ID for work_order_service_entry
                        logger.info(f"Created WorkOrderService entry {work_order_service_entry.id} with price {work_order_service_entry.price}.")
                    else:
                        logger.info(f"Found existing WorkOrderService entry {work_order_service_entry.id} with price {work_order_service_entry.price}.")
                        if work_order_service_entry.billing_status == "not_billable":
                            work_order_service_entry.appointment_id = db_appointment.id
                    
                    existing_invoice_item = self.db.query(InvoiceItem).filter(
                        InvoiceItem.invoice_id == invoice.id,
                        InvoiceItem.work_order_service_id == work_order_service_entry.id # Link to WorkOrderService.id
                    ).first()

                    if not existing_invoice_item:
                        logger.info(f"No existing InvoiceItem for WOS ID {work_order_service_entry.id} on invoice {invoice.id}. Creating new InvoiceItem.")
                        invoice_item = InvoiceItem(
                            invoice_id=invoice.id,
                            description=work_order_service_entry.name,
                            quantity=Decimal(work_order_service_entry.quantity),  # Ensure Decimal
                            unit_price=Decimal(work_order_service_entry.unit_price), # Ensure Decimal
                            work_order_service_id=work_order_service_entry.id,
                            # tax_rate, discount, total will be calculated by calculate_total()
                        )
                        invoice_item.calculate_total() # Calculate total before adding
                        self.db.add(invoice_item)
                        logger.info(f"Created new InvoiceItem {invoice_item.id} with total {invoice_item.total}")
                    else:
                        logger.info(f"Found existing InvoiceItem {existing_invoice_item.id} for WOS ID {work_order_service_entry.id}. Updating it.")
                        existing_invoice_item.description = work_order_service_entry.name
                        existing_invoice_item.quantity = Decimal(work_order_service_entry.quantity) # Ensure Decimal
                        existing_invoice_item.unit_price = Decimal(work_order_service_entry.unit_price) # Ensure Decimal
                        # Recalculate total, tax_rate and discount might be set elsewhere or default to 0
                        existing_invoice_item.calculate_total()
                        logger.info(f"Updated existing InvoiceItem {existing_invoice_item.id} with quantity {existing_invoice_item.quantity} and unit_price {existing_invoice_item.unit_price}, new total: {existing_invoice_item.total}")
                
                # Recalculate invoice totals based on all WorkOrderService entries for this WorkOrder
                self.db.flush() # Ensure all newly added/updated invoice items are flushed to capture their totals
                
                all_wos_for_invoice = self.db.query(WorkOrderServiceModel).filter(WorkOrderServiceModel.work_order_id == db_appointment.work_order_id).all()
                current_invoice_subtotal = sum(
                    Decimal(wos.price) for wos in all_wos_for_invoice if wos.price is not None
                )
                logger.info(f"Recalculated invoice {invoice.id} subtotal: {current_invoice_subtotal} based on {len(all_wos_for_invoice)} WorkOrderService entries.")

                # Invoice ORM columns are Float; keep all arithmetic in float to avoid Decimal/float errors downstream
                invoice.subtotal = float(current_invoice_subtotal)
                invoice.tax = float(invoice.tax or 0)
                disc = float(invoice.discount_amount or 0)
                invoice.total_amount = float(invoice.subtotal) + float(invoice.tax) - disc
                invoice.update_balance()

            # Only calculate travel info automatically if not already provided
            if (db_appointment.travel_time_before is None or 
                db_appointment.travel_distance_before is None):
                # Update travel time and distance for this appointment
                travel_calculator.update_appointment_travel_info(self.db, str(db_appointment.id))
                # Refresh to get the updated travel info
                self.db.refresh(db_appointment)
            
            # Auto-add trip charge based on zone (zip code lookup)
            try:
                from app.services.zone_service import get_zone_service
                import re
                zone_service = get_zone_service(self.db)
                
                # Get service address from work order
                service_address = None
                property_zip = None
                
                if work_order.service_location and isinstance(work_order.service_location, dict):
                    service_address = work_order.service_location.get('address')
                    # Try to extract zip from address string (5-digit zip at end)
                    if service_address:
                        zip_match = re.search(r'\b(\d{5})(?:-\d{4})?\s*$', service_address)
                        if zip_match:
                            property_zip = zip_match.group(1)
                
                # Calculate drive time from SHOP to service location
                shop_to_property_drive_time = None
                if service_address:
                    shop_address = travel_calculator.get_default_shop_address()
                    travel_time, _ = travel_calculator.get_travel_time_and_distance(shop_address, service_address)
                    if travel_time is not None:
                        shop_to_property_drive_time = float(travel_time)  # Already in minutes
                
                logger.info(f"Zone lookup: zip={property_zip}, shop_drive_time={shop_to_property_drive_time} minutes, address={service_address}")
                
                zone_result = zone_service.determine_zone(
                    zip_code=property_zip,
                    drive_time_minutes=shop_to_property_drive_time
                )
                
                if zone_result and zone_result.get('tripCharge') is not None:
                    zone_service.add_trip_charge_to_work_order(
                        work_order_id=db_appointment.work_order_id,
                        zone_key=zone_result['zoneKey'],
                        trip_charge=zone_result['tripCharge'],
                        appointment_id=db_appointment.id
                    )
                    logger.info(f"Added trip charge for zone '{zone_result['zoneKey']}' (method: {zone_result.get('method')}): ${zone_result['tripCharge']}")
                elif zone_result:
                    logger.info(f"Zone '{zone_result['zoneKey']}' requires manual trip charge (method: {zone_result.get('method')})")
                else:
                    logger.info("No zone determined for trip charge")
            except Exception as zone_error:
                logger.warning(f"Failed to add trip charge: {zone_error}", exc_info=True)
                # Don't fail appointment creation if trip charge fails
            
            logger.info(f"Syncing work order schedule for work_order_id: {appointment_data.work_order_id} post-appointment creation.")
            try:
                await self.sync_work_order_schedule_with_appointments(
                    appointment_data.work_order_id,
                    changed_by=user_id,
                )
            except Exception as sync_error:
                logger.error(f"Error syncing work order schedule: {str(sync_error)}", exc_info=True)
                raise # Re-raise the exception to be caught by the main handler

            from app.services.work_order_status_sync_service import (
                sync_work_order_status_from_appointment,
            )

            sync_work_order_status_from_appointment(
                self.db,
                db_appointment,
                user_id,
            )

            activity.log_appointment_added(
                self.db,
                appointment_data.work_order_id,
                user_id,
                db_appointment.scheduled_start,
                db_appointment.appointment_type,
            )

            if appointment_data.notes and str(appointment_data.notes).strip():
                appt_type = appointment_data.appointment_type or "visit"
                start = db_appointment.scheduled_start
                end = db_appointment.scheduled_end
                schedule_line = ""
                if start:
                    schedule_line = f"Scheduled: {start.strftime('%b %d, %Y %I:%M %p')}"
                    if end:
                        schedule_line += f" – {end.strftime('%I:%M %p')}"
                body_lines = [f"Appointment added ({appt_type})."]
                if schedule_line:
                    body_lines.append(schedule_line)
                body_lines.append("")
                body_lines.append(str(appointment_data.notes).strip())
                _add_work_order_typed_note(
                    self.db,
                    work_order_id=appointment_data.work_order_id,
                    user_id=user_id,
                    note_type=NOTE_TYPE_APPOINTMENT_INFO,
                    body="\n".join(body_lines),
                )

            if commit:
                self.db.commit()
                committed_appointment_id = db_appointment.id
                try:
                    refetched_appointment = self.db.query(WorkOrderAppointment).filter(
                        WorkOrderAppointment.id == committed_appointment_id
                    ).one_or_none()
                    if refetched_appointment:
                        logger.info(
                            f"Successfully committed and re-fetched appointment {refetched_appointment.id}. "
                            f"Final schedule: {refetched_appointment.scheduled_start} to {refetched_appointment.scheduled_end}"
                        )
                        return refetched_appointment
                    logger.error(f"CRITICAL: Appointment {committed_appointment_id} not found after commit.")
                    raise ValidationException(
                        f"Failed to confirm appointment creation for ID {committed_appointment_id} after commit."
                    )
                except ValidationException:
                    raise
                except Exception as query_exc:
                    logger.error(
                        f"CRITICAL: Error re-fetching appointment {committed_appointment_id} after commit: {str(query_exc)}",
                        exc_info=True,
                    )
                    raise ValidationException(
                        f"Failed to confirm appointment creation for ID {committed_appointment_id} due to query error: {str(query_exc)}"
                    )
            self.db.flush()
            self.db.refresh(db_appointment)
            return db_appointment
        except ConflictException:
            self.db.rollback()
            raise
        except ValidationException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating work order appointment: {str(e)}", exc_info=True)
            raise ValidationException(f"Failed to create appointment: {str(e)}")
    
    async def update_work_order_appointment(
        self,
        appointment_id: uuid.UUID,
        appointment_data: WorkOrderAppointmentUpdate,
        user_id: uuid.UUID
    ) -> WorkOrderAppointment:
        """Update an existing work order appointment"""
        appointment = self.db.query(WorkOrderAppointment).filter(WorkOrderAppointment.id == appointment_id).first()
        if not appointment:
            raise NotFoundException(f"Appointment with ID {appointment_id} not found")

        work_order = await WorkOrderService.get_work_order(self.db, appointment.work_order_id)
        update_data_preview = appointment_data.model_dump(exclude_unset=True)
        from app.services.work_order_lifecycle_service import assert_appointment_update_allowed

        assert_appointment_update_allowed(
            work_order,
            set(update_data_preview.keys()),
            update_data_preview.get("status"),
        )
        
        # Store original start and technician to check for changes
        original_start_time = appointment.scheduled_start
        original_technician_id = appointment.assigned_technician_id
        original_status = activity._status_val(appointment.status)
        original_service_ids = set(s.id for s in appointment.services) # Assuming 'services' relationship exists

        # Update fields from appointment_data
        update_data = appointment_data.model_dump(exclude_unset=True)

        if "status" in update_data:
            from app.services.work_order_status_sync_service import normalize_appointment_status_for_update

            update_data["status"] = normalize_appointment_status_for_update(
                update_data["status"],
                work_order_closed=bool(getattr(work_order, "is_closed", False)),
            )
        
        # Calendar block (scheduled_end - scheduled_start) is fixed at book time unless start moves
        # or the client explicitly extends the block after adding SKUs.
        services_changed = 'service_ids' in update_data and set(update_data['service_ids']) != original_service_ids
        start_time_changed = (
            'scheduled_start' in update_data
            and not _appointment_starts_equal(original_start_time, update_data['scheduled_start'])
        )

        explicit_end = update_data.get('scheduled_end')
        forced_schedule = update_data.get('is_forced_schedule', appointment.is_forced_schedule)
        extend_calendar_block = bool(update_data.pop('extend_calendar_block', False))

        original_block_minutes = 45
        if original_start_time and appointment.scheduled_end:
            delta = appointment.scheduled_end - original_start_time
            original_block_minutes = max(1, int(delta.total_seconds() / 60))

        if start_time_changed:
            import pandas as pd

            new_start_time = pd.Timestamp(update_data.get('scheduled_start', original_start_time))

            skip_end_recalc = forced_schedule and explicit_end is not None
            if not skip_end_recalc:
                update_data['scheduled_end'] = new_start_time + pd.Timedelta(
                    minutes=original_block_minutes
                )
        elif services_changed:
            import pandas as pd

            current_service_ids = update_data.get('service_ids', original_service_ids)
            planned_minutes = 45
            if current_service_ids:
                total_service_duration = 0
                for service_id in current_service_ids:
                    service = self.db.query(Service).filter(Service.id == service_id).first()
                    if service and service.duration_minutes:
                        total_service_duration += service.duration_minutes
                if total_service_duration > 0:
                    planned_minutes = total_service_duration

            skip_end_recalc = forced_schedule and explicit_end is not None
            if not skip_end_recalc:
                anchor_start = update_data.get('scheduled_start', original_start_time)
                if extend_calendar_block:
                    block_minutes = max(original_block_minutes, planned_minutes)
                    update_data['scheduled_end'] = pd.Timestamp(anchor_start) + pd.Timedelta(
                        minutes=block_minutes
                    )
                elif planned_minutes < original_block_minutes:
                    update_data['scheduled_end'] = pd.Timestamp(anchor_start) + pd.Timedelta(
                        minutes=planned_minutes
                    )


        for key, value in update_data.items():
            if key == "service_ids": # Special handling for service_ids
                continue
            setattr(appointment, key, value)

        if "status" in update_data:
            from app.services.work_order_performance_service import handle_appointment_status_timing
            from app.services.work_order_status_sync_service import (
                COMPLETION_APPOINTMENT_STATUSES,
                sync_work_order_status_from_appointment,
            )
            from app.services.work_order_billing_helpers import apply_appointment_status_billing

            if not appointment.services:
                self.db.refresh(appointment)
            normalized_status = activity._status_val(update_data["status"])
            handle_appointment_status_timing(
                self.db,
                appointment=appointment,
                previous_status=original_status,
                user_id=user_id,
            )
            sync_work_order_status_from_appointment(
                self.db,
                appointment,
                user_id,
                previous_appointment_status=original_status,
            )
            apply_appointment_status_billing(
                self.db,
                work_order=work_order,
                appointment_id=appointment.id,
                new_status=normalized_status,
            )
            if normalized_status in COMPLETION_APPOINTMENT_STATUSES:
                sync_work_order_status_from_appointment(
                    self.db,
                    appointment,
                    user_id,
                    previous_appointment_status=original_status,
                    after_billing=True,
                )
        
        appointment.updated_at = datetime.utcnow()
        appointment.updated_by = user_id

        # Handle Service associations if service_ids are provided
        if "service_ids" in update_data:
            new_service_ids = set(update_data["service_ids"])
            
            # Remove services no longer associated
            current_services_on_appointment = self.db.query(Service).join(appointment_services_association).filter(
                appointment_services_association.c.appointment_id == appointment.id
            ).all()

            for service_in_db in current_services_on_appointment:
                if service_in_db.id not in new_service_ids:
                    # This requires 'appointment.services.remove(service_in_db)' if using ORM relationships directly
                    # For association table, direct delete might be needed or ensure cascade works.
                    # Assuming direct manipulation of association for now if not using backref list appends/removes
                    pass # Placeholder: Logic to remove from association needed

            # Add new services
            # Clear existing services and re-add (simplest for now if direct association manipulation)
            # A more robust way is to check appointment.services relationship and append/remove
            stmt_delete_assoc = appointment_services_association.delete().where(
                appointment_services_association.c.appointment_id == appointment.id
            )
            self.db.execute(stmt_delete_assoc)

            for service_id in new_service_ids:
                service = self.db.query(Service).filter(Service.id == service_id).first()
                if service:
                    stmt_insert_assoc = appointment_services_association.insert().values(
                        appointment_id=appointment.id,
                        service_id=service.id
                    )
                    self.db.execute(stmt_insert_assoc)

            # --- Clean up WorkOrderService records for removed SKUs ---
            removed_service_ids = original_service_ids - new_service_ids
            for removed_id in removed_service_ids:
                old_wos = self.db.query(WorkOrderServiceModel).filter(
                    WorkOrderServiceModel.work_order_id == appointment.work_order_id,
                    WorkOrderServiceModel.service_id == removed_id,
                    WorkOrderServiceModel.billing_status == 'not_billable'
                ).first()
                if old_wos:
                    self.db.query(InvoiceItem).filter(
                        InvoiceItem.work_order_service_id == old_wos.id
                    ).delete()
                    self.db.delete(old_wos)
                    logger.info(f"Deleted WorkOrderService {old_wos.id} for removed service {removed_id}")
            self.db.flush()
        
            # --- Invoice Update Logic for service_ids changes ---
            if services_changed: # Only update invoice items if services actually changed
                invoice = self.db.query(Invoice).filter(Invoice.work_order_id == appointment.work_order_id).first()
                if not invoice:
                    # If no invoice, and services are being added, create one.
                    if new_service_ids:
                        work_order = self.db.query(WorkOrder).filter(WorkOrder.id == appointment.work_order_id).first()
                        if not work_order or not work_order.client_id:
                             raise ValidationException("Work order or client missing for invoice creation.")
                        invoice = Invoice(
                            invoice_number=f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{str(appointment.work_order_id)[:4]}",
                            client_id=work_order.client_id,
                            work_order_id=appointment.work_order_id,
                            status="draft",
                            issue_date=datetime.utcnow(),
                            due_date=datetime.utcnow(),
                            created_by=user_id
                        )
                        self.db.add(invoice)
                        self.db.flush()
                
                if invoice: # Proceed if invoice exists or was just created
                    # Invoice items reference work_order_service.id, not services.id
                    existing_invoice_items = self.db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()

                    for item in list(existing_invoice_items):
                        if not item.work_order_service_id:
                            continue
                        wos_row = self.db.query(WorkOrderServiceModel).filter(
                            WorkOrderServiceModel.id == item.work_order_service_id,
                        ).first()
                        if not wos_row or wos_row.service_id not in new_service_ids:
                            self.db.delete(item)

                    current_invoice_subtotal = 0.0
                    for sid in new_service_ids:
                        main_service = self.db.query(Service).filter(Service.id == sid).first()
                        if not main_service:
                            continue

                        wos_entry = self.db.query(WorkOrderServiceModel).filter(
                            WorkOrderServiceModel.work_order_id == appointment.work_order_id,
                            WorkOrderServiceModel.service_id == main_service.id,
                        ).first()
                        if not wos_entry:
                            calculated_price = Decimal(1) * Decimal(main_service.base_price)
                            wos_entry = WorkOrderServiceModel(
                                work_order_id=appointment.work_order_id,
                                service_id=main_service.id,
                                appointment_id=appointment.id,
                                name=main_service.name,
                                quantity=1,
                                unit_price=Decimal(main_service.base_price),
                                price=calculated_price,
                            )
                            self.db.add(wos_entry)
                            self.db.flush()
                        elif wos_entry.billing_status == "not_billable":
                            wos_entry.appointment_id = appointment.id

                        existing_item = self.db.query(InvoiceItem).filter(
                            InvoiceItem.invoice_id == invoice.id,
                            InvoiceItem.work_order_service_id == wos_entry.id,
                        ).first()

                        if not existing_item:
                            invoice_item = InvoiceItem(
                                invoice_id=invoice.id,
                                description=wos_entry.name,
                                quantity=1,
                                unit_price=Decimal(main_service.base_price),
                                work_order_service_id=wos_entry.id,
                            )
                            invoice_item.calculate_total()
                            self.db.add(invoice_item)
                            current_invoice_subtotal += float(invoice_item.total or 0)
                        else:
                            existing_item.description = wos_entry.name
                            existing_item.unit_price = float(main_service.base_price)
                            existing_item.calculate_total()
                            current_invoice_subtotal += float(existing_item.total or 0)

                    invoice.subtotal = float(current_invoice_subtotal)
                    invoice.tax = float(invoice.tax or 0)
                    disc = float(invoice.discount_amount or 0)
                    invoice.total_amount = float(invoice.subtotal) + float(invoice.tax) - disc
                    invoice.update_balance()

        self.db.flush() # Flush to apply updates before travel calculations

        if (
            appointment.assigned_technician_id
            and appointment.scheduled_start
            and appointment.scheduled_end
        ):
            from app.services.scheduling_constraints_service import (
                appointment_status_occupies_schedule,
                assert_technician_available,
            )

            if appointment_status_occupies_schedule(appointment.status) and not appointment.is_forced_schedule:
                assert_technician_available(
                    self.db,
                    appointment.assigned_technician_id,
                    appointment.scheduled_start,
                    appointment.scheduled_end,
                    exclude_appointment_id=appointment.id,
                )

        # Recalculate travel only when technician or start time changes (not SKU-only edits)
        schedule_affects_travel = (
            original_technician_id != appointment.assigned_technician_id
            or not _appointment_starts_equal(original_start_time, appointment.scheduled_start)
        )

        if schedule_affects_travel:
            if appointment.assigned_technician_id:
                logger.info(
                    f"Technician or start time changed for appointment {appointment_id}. Updating travel info."
                )
                travel_calculator.update_appointment_travel_info(self.db, str(appointment.id))

            if original_technician_id and original_technician_id != appointment.assigned_technician_id:
                appointment_date = original_start_time.date()
                logger.info(
                    f"Technician changed from {original_technician_id} to "
                    f"{appointment.assigned_technician_id} for appointment {appointment_id}. "
                    f"Updating old tech's schedule for date {appointment_date}."
                )
                travel_calculator.update_technician_day_travel_info(
                    self.db,
                    str(original_technician_id),
                    appointment_date,
                )
                if appointment.scheduled_start:
                    travel_calculator.update_technician_day_travel_info(
                        self.db,
                        str(appointment.assigned_technician_id),
                        appointment.scheduled_start,
                    )
        
        # After updating an appointment, sync the work order's schedule with appointments
        await self.sync_work_order_schedule_with_appointments(
            appointment.work_order_id,
            changed_by=user_id,
        )

        new_status = activity._status_val(appointment.status)
        if "status" in update_data and new_status != original_status:
            activity.log_appointment_status_changed(
                self.db,
                appointment.work_order_id,
                user_id,
                original_status,
                new_status,
                appointment.scheduled_start,
            )
        elif start_time_changed and appointment.scheduled_start and original_start_time:
            activity.log_appointment_rescheduled(
                self.db,
                appointment.work_order_id,
                user_id,
                original_start_time,
                appointment.scheduled_start,
            )
        
        self.db.commit()
        self.db.refresh(appointment)
        
        return appointment
    
    async def delete_work_order_appointment(
        self,
        appointment_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Delete a work order appointment"""
        # Get the appointment
        appointment = self.db.query(WorkOrderAppointment).filter(WorkOrderAppointment.id == appointment_id).first()
        if not appointment:
            raise NotFoundException(f"Appointment with ID {appointment_id} not found")
        
        # Store the work order ID and technician ID before deleting the appointment
        work_order_id = appointment.work_order_id
        technician_id = appointment.assigned_technician_id
        appointment_date = appointment.scheduled_start
        appointment_type = appointment.appointment_type

        activity.log_appointment_removed(
            self.db,
            work_order_id,
            user_id,
            appointment.scheduled_start,
            appointment_type,
        )
        
        # Delete any services associated with this appointment
        # First, get the service IDs so we can delete linked invoice items
        from app.models.work_order import WorkOrderService as WorkOrderServiceModel
        from app.models.invoice import InvoiceItem
        
        service_ids = [s.id for s in self.db.query(WorkOrderServiceModel.id).filter(
            WorkOrderServiceModel.appointment_id == appointment_id
        ).all()]
        
        if service_ids:
            # Delete invoice items that reference these services
            self.db.query(InvoiceItem).filter(
                InvoiceItem.work_order_service_id.in_(service_ids)
            ).delete(synchronize_session=False)
            
            # Now delete the services
            self.db.query(WorkOrderServiceModel).filter(
                WorkOrderServiceModel.appointment_id == appointment_id
            ).delete(synchronize_session=False)
        
        # Delete the appointment
        self.db.delete(appointment)
        self.db.flush()
        
        # Update the technician's day travel info if applicable
        if technician_id:
            travel_calculator.update_technician_day_travel_info(
                self.db, 
                str(technician_id), 
                appointment_date
            )
        
        # After deleting an appointment, sync the work order's schedule with remaining appointments
        await self.sync_work_order_schedule_with_appointments(
            work_order_id,
            changed_by=user_id,
        )
        
        self.db.commit()
        
        return True

    async def sync_work_order_schedule_with_appointments(
        self,
        work_order_id: uuid.UUID,
        *,
        changed_by: Optional[uuid.UUID] = None,
    ) -> None:
        """
        Sync a work order's scheduled_start and scheduled_end with its appointments.
        This method calculates the overall time span of all active appointments,
        setting the work order's schedule to cover all appointments.
        """
        logger.info(f"Syncing work order {work_order_id} schedule with appointments")
        
        # Get the work order
        work_order = self.db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if not work_order:
            logger.error(f"Work order with ID {work_order_id} not found")
            return

        def _status_val(s) -> str:
            if s is None:
                return ""
            return s.value if hasattr(s, "value") else str(s)

        def _resolve_status_actor(appointments_list) -> Optional[uuid.UUID]:
            if changed_by:
                return changed_by
            if work_order.updated_by:
                return work_order.updated_by
            if work_order.created_by:
                return work_order.created_by
            for appt in appointments_list:
                if appt.created_by:
                    return appt.created_by
            return None

        def _record_status_sync(previous_status: str, new_status: str, notes: str, appointments_list) -> None:
            actor = _resolve_status_actor(appointments_list)
            if not actor:
                logger.warning(
                    "Skipping work order status history for %s (%s -> %s): no changed_by available",
                    work_order_id,
                    previous_status,
                    new_status,
                )
                return
            self.db.add(
                WorkOrderStatusHistory(
                    work_order_id=work_order.id,
                    previous_status=previous_status,
                    new_status=new_status,
                    changed_by=actor,
                    notes=notes,
                )
            )
        
        # Get all active appointments for this work order, sorted by scheduled_start
        appointments = self.db.query(WorkOrderAppointment).filter(
            WorkOrderAppointment.work_order_id == work_order_id,
            WorkOrderAppointment.status != 'canceled'
        ).order_by(WorkOrderAppointment.scheduled_start).all()
        
        if not appointments:
            logger.info(f"No active appointments found for work order {work_order_id}, clearing schedule")
            # No active appointments, clear the work order schedule
            work_order.scheduled_start = None
            work_order.scheduled_end = None

            if _status_val(work_order.status) == "scheduled":
                work_order.status = "pending"
                _record_status_sync(
                    "scheduled",
                    "pending",
                    "Status synced: no active appointments",
                    appointments,
                )
        else:
            # Calculate the overall time span of all appointments
            earliest_start = min(appt.scheduled_start for appt in appointments)
            latest_end = max(appt.scheduled_end for appt in appointments)
            
            logger.info(f"Work order {work_order_id} has {len(appointments)} active appointments. " +
                       f"Setting schedule to span from {earliest_start} to {latest_end}")
            logger.info(f"Appointments: {', '.join([str(appt.id) for appt in appointments])}")
            
            # Update the work order's schedule to cover all appointments
            work_order.scheduled_start = earliest_start
            work_order.scheduled_end = latest_end

            # List and dashboards key off work_orders.status; keep it aligned when visits exist
            if _status_val(work_order.status) in ("pending", "reschedule"):
                previous = _status_val(work_order.status)
                work_order.status = "scheduled"
                _record_status_sync(
                    previous,
                    "scheduled",
                    "Status synced: work order has active appointment(s)",
                    appointments,
                )
        
        # Save the changes
        self.db.add(work_order)
        # No need to commit here, the calling method will handle that
    
    @staticmethod
    async def create_work_order_note(
        db: Session,
        work_order_id: uuid.UUID,
        user_id: uuid.UUID,
        note_text: str,
        is_private: bool = False
    ) -> WorkOrderNote:
        """Create a new note for a work order"""
        try:
            # Verify work order exists
            work_order = await WorkOrderService.get_work_order(db, work_order_id)
            
            # Auto-detect note type and default certain types to private
            match = re.match(r"^\[(.*?)\]", note_text or "")
            if match:
                note_type = match.group(1)
                if note_type in PRIVATE_NOTE_TYPES:
                    is_private = True
            
            # Create the note
            note = WorkOrderNote(
                work_order_id=work_order_id,
                user_id=user_id,
                note=note_text,
                is_private=is_private
            )
            
            db.add(note)
            db.flush()

            from app.services.dma_service import upsert_repair_outcome_from_note
            upsert_repair_outcome_from_note(
                db,
                work_order_id=work_order_id,
                user_id=user_id,
                note_id=note.id,
                note_text=note_text,
            )

            db.commit()
            db.refresh(note)
            
            logger.info(f"Created note with ID: {note.id} for work order: {work_order.id}")
            return note
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating note: {str(e)}")
            raise ValidationException(f"Failed to create note: {str(e)}")
    
    @staticmethod
    async def get_work_order_notes(
        db: Session,
        work_order_id: uuid.UUID,
        include_private: bool = True
    ) -> List[WorkOrderNote]:
        """Get notes for a specific work order"""
        # Verify work order exists
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Query notes
        query = db.query(WorkOrderNote).filter(WorkOrderNote.work_order_id == work_order_id)
        
        # Filter private notes if specified
        if not include_private:
            query = query.filter(WorkOrderNote.is_private == False)
        
        # Get notes with newest first
        notes = query.order_by(WorkOrderNote.created_at.desc()).all()
        
        return notes

    async def get_technician_schedule_for_date(
        self,
        *, 
        technician_id: UUID, 
        schedule_date: py_date
    ) -> Optional[List[WorkOrderAppointment]]:
        """
        Fetches all appointments assigned to a specific technician on a specific date.
        Orders the appointments by their scheduled start time.
        Returns None if a database error occurs during fetching.
        """
        logger.info(f"Service method called: get_technician_schedule_for_date for tech {technician_id} on date {schedule_date}")
        try:
            # Convert the date filter to a SQL-compatible date format
            start_of_day = datetime.combine(schedule_date, datetime.min.time())
            end_of_day = datetime.combine(schedule_date, datetime.max.time())
            
            # Use synchronous query API with self.db
            appointments = self.db.query(WorkOrderAppointment).filter(
                WorkOrderAppointment.assigned_technician_id == technician_id,
                WorkOrderAppointment.scheduled_start >= start_of_day,
                WorkOrderAppointment.scheduled_start <= end_of_day
            ).order_by(WorkOrderAppointment.scheduled_start.asc()).all()
            
            logger.info(f"Successfully fetched {len(appointments)} appointments for technician {technician_id} on {schedule_date}")
            # Return the list of appointments (could be empty)
            return appointments
        
        except Exception as e:
            # Log the full error details for debugging
            logger.error(f"Database error fetching schedule for technician {technician_id} on {schedule_date}: {e}", exc_info=True)
            # Return None to indicate failure to the router
            return None

    @staticmethod
    async def get_work_order_timeline(db: Session, work_order_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Return debriefing / activity log entries for a work order."""
        await WorkOrderService.get_work_order(db, work_order_id)
        return activity.get_work_order_activity_timeline(db, work_order_id)