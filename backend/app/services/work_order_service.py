from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List, Dict, Any, Union
import uuid
from datetime import datetime
import logging

from app.models.work_order import WorkOrder, WorkOrderStatusHistory, WorkOrderService as WorkOrderServiceModel, WorkOrderItem, WorkOrderNote
from app.schemas.work_order import WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse
from app.core.exceptions import NotFoundException, ConflictException, ValidationException, BadRequestException

logger = logging.getLogger(__name__)

class WorkOrderService:
    """Enhanced service for handling work order operations"""
    
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
            query = query.filter(WorkOrder.assigned_technician_id == technician_id)
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
    async def create_work_order(
        db: Session,
        work_order_data: Dict[str, Any]
    ) -> WorkOrderResponse:
        """
        Create a new work order from quote data.
        """
        # Create work order
        work_order = WorkOrder(
            client_id=work_order_data["client_id"],
            description=work_order_data["description"],
            scheduled_date=work_order_data["scheduled_date"],
            priority=work_order_data["priority"],
            total_amount=work_order_data["total_amount"],
            status="scheduled",
            created_by=work_order_data["created_by"]
        )
        
        db.add(work_order)
        db.flush()  # Get the work_order.id
        
        # Add work order items
        for item in work_order_data["items"]:
            work_order_item = WorkOrderItem(
                work_order_id=work_order.id,
                description=item["description"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                total_price=item["total_price"]
            )
            db.add(work_order_item)
        
        db.commit()
        db.refresh(work_order)
        
        return work_order
    
    @staticmethod
    async def update_work_order(
        db: Session, 
        work_order_id: uuid.UUID, 
        work_order_data: WorkOrderUpdate
    ) -> WorkOrder:
        """Update an existing work order"""
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Prevent updating completed or cancelled work orders
        if work_order.status in ["completed", "cancelled"]:
            raise ConflictException(f"Cannot update a work order with status {work_order.status}")
        
        # Validate technician if assigned
        if work_order_data.assigned_technician_id:
            from app.models.technician import Technician
            technician = db.query(Technician).filter(
                Technician.id == work_order_data.assigned_technician_id
            ).first()
            
            if not technician:
                raise ValidationException(f"Technician with ID {work_order_data.assigned_technician_id} not found")
        
        try:
            # Begin transaction
            update_data = work_order_data.dict(exclude_unset=True)
            
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
                
                # Set timestamps based on status
                if update_data["status"] == "in_progress" and not work_order.actual_start:
                    work_order.actual_start = datetime.utcnow()
                elif update_data["status"] == "completed" and not work_order.actual_end:
                    work_order.actual_end = datetime.utcnow()
            
            # Update the work order with provided fields
            for key, value in update_data.items():
                if key not in ["updated_by", "status_notes"]:
                    setattr(work_order, key, value)
            
            db.commit()
            db.refresh(work_order)
            
            return work_order
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating work order: {str(e)}")
            raise ConflictException(f"Failed to update work order: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating work order: {str(e)}")
            raise BadRequestException(f"Failed to update work order: {str(e)}")
    
    @staticmethod
    async def delete_work_order(db: Session, work_order_id: uuid.UUID) -> bool:
        """Delete a work order"""
        work_order = await WorkOrderService.get_work_order(db, work_order_id)
        
        # Prevent deleting completed or in_progress work orders
        if work_order.status in ["completed", "in_progress"]:
            raise ConflictException(f"Cannot delete a work order with status {work_order.status}")
        
        try:
            # Check if there are invoices related to this work order
            from app.models.invoice import Invoice
            invoice = db.query(Invoice).filter(Invoice.work_order_id == work_order_id).first()
            
            if invoice:
                raise ConflictException("Cannot delete work order with associated invoices")
            
            # Delete associated records
            db.query(WorkOrderStatusHistory).filter(
                WorkOrderStatusHistory.work_order_id == work_order_id
            ).delete()
            
            db.query(WorkOrderServiceModel).filter(
                WorkOrderServiceModel.work_order_id == work_order_id
            ).delete()
            
            db.query(WorkOrderItem).filter(
                WorkOrderItem.work_order_id == work_order_id
            ).delete()
            
            db.query(WorkOrderNote).filter(
                WorkOrderNote.work_order_id == work_order_id
            ).delete()
            
            # Delete the work order
            db.delete(work_order)
            db.commit()
            
            return True
            
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
            "scheduled": ["in_progress", "cancelled"],
            "in_progress": ["completed", "cancelled"],
            "completed": ["billed"],
            "cancelled": ["scheduled"]
        }
        
        if status not in valid_transitions.get(work_order.status, []):
            raise ValidationException(
                f"Cannot transition work order from {work_order.status} to {status}"
            )
        
        work_order.status = status
        if notes:
            work_order.notes = f"{work_order.notes}\nStatus Update: {notes}"
        work_order.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(work_order)
        
        return work_order