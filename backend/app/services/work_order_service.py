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
        query = db.query(WorkOrder)
        
        # Apply filters
        if status:
            query = query.filter(WorkOrder.status == status)
        if client_id:
            query = query.filter(WorkOrder.client_id == client_id)
        if technician_id:
            query = query.filter(WorkOrder.assigned_technician_id == technician_id)
        if start_date:
            query = query.filter(WorkOrder.scheduled_start >= start_date)
        if end_date:
            query = query.filter(WorkOrder.scheduled_start <= end_date)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(WorkOrder.created_at.desc())
        work_orders = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": work_orders,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def get_work_order(db: Session, work_order_id: uuid.UUID) -> WorkOrder:
        """Get a specific work order by ID"""
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        
        if not work_order:
            raise NotFoundException(f"Work order with ID {work_order_id} not found")
        
        return work_order
    
    @staticmethod
    async def create_work_order(db: Session, work_order_data: WorkOrderCreate, user_id: uuid.UUID) -> WorkOrder:
        """Create a new work order with proper transaction handling"""
        # Validate client exists
        from app.models.client import Client
        client = db.query(Client).filter(Client.id == work_order_data.client_id).first()
        if not client:
            raise ValidationException(f"Client with ID {work_order_data.client_id} not found")
        
        # Validate technician if assigned
        if work_order_data.assigned_technician_id:
            from app.models.technician import Technician
            technician = db.query(Technician).filter(
                Technician.id == work_order_data.assigned_technician_id
            ).first()
            
            if not technician:
                raise ValidationException(f"Technician with ID {work_order_data.assigned_technician_id} not found")
        
        # Generate unique order number
        from app.models.settings import Settings
        settings = db.query(Settings).filter(Settings.key == "work_order_settings").first()
        
        if settings:
            work_order_settings = settings.value
            prefix = work_order_settings.get("auto_number_prefix", "WO-")
            next_number = work_order_settings.get("auto_number_start", 1001)
            
            # Find the latest work order number
            latest_work_order = db.query(WorkOrder).order_by(WorkOrder.order_number.desc()).first()
            
            if latest_work_order and latest_work_order.order_number.startswith(prefix):
                try:
                    last_number = int(latest_work_order.order_number[len(prefix):])
                    next_number = last_number + 1
                except (ValueError, TypeError):
                    pass
            
            order_number = f"{prefix}{next_number}"
            
            # Update the setting
            work_order_settings["auto_number_start"] = next_number + 1
            settings.value = work_order_settings
        else:
            # Fallback if settings not found
            import random
            order_number = f"WO-{random.randint(1000, 9999)}"
        
        try:
            # Begin transaction
            new_work_order = WorkOrder(
                order_number=order_number,
                client_id=work_order_data.client_id,
                title=work_order_data.title,
                description=work_order_data.description,
                priority=work_order_data.priority,
                status="pending",
                service_location=work_order_data.service_location,
                scheduled_start=work_order_data.scheduled_start,
                scheduled_end=work_order_data.scheduled_end,
                estimated_duration=work_order_data.estimated_duration,
                assigned_technician_id=work_order_data.assigned_technician_id,
                quote_id=work_order_data.quote_id,
                is_recurring=work_order_data.is_recurring,
                recurrence_pattern=work_order_data.recurrence_pattern,
                created_by=user_id
            )
            
            db.add(new_work_order)
            db.flush()  # Flush to get the ID without committing
            
            # If assigned to technician, update status and create history
            if new_work_order.assigned_technician_id:
                new_work_order.status = "scheduled"
                
                # Create status history
                status_history = WorkOrderStatusHistory(
                    work_order_id=new_work_order.id,
                    previous_status="pending",
                    new_status="scheduled",
                    changed_by=user_id,
                    notes="Initial assignment"
                )
                db.add(status_history)
            
            # Add services if provided
            if work_order_data.services:
                for service_data in work_order_data.services:
                    # Validate service exists
                    from app.models.service import Service
                    service = db.query(Service).filter(Service.id == service_data.service_id).first()
                    if not service:
                        raise ValidationException(f"Service with ID {service_data.service_id} not found")
                    
                    service_item = WorkOrderServiceModel(
                        work_order_id=new_work_order.id,
                        service_id=service_data.service_id,
                        quantity=service_data.quantity,
                        price=service_data.price or service.base_price,
                        notes=service_data.notes
                    )
                    db.add(service_item)
            
            # Add inventory items if provided
            if work_order_data.items:
                for item_data in work_order_data.items:
                    # Validate inventory item exists
                    from app.models.inventory import InventoryItem
                    inv_item = db.query(InventoryItem).filter(
                        InventoryItem.id == item_data.inventory_item_id
                    ).first()
                    
                    if not inv_item:
                        raise ValidationException(f"Inventory item with ID {item_data.inventory_item_id} not found")
                    
                    # Check if enough quantity is available
                    if inv_item.quantity_in_stock < item_data.quantity:
                        raise ConflictException(
                            f"Not enough {inv_item.name} in stock. Available: {inv_item.quantity_in_stock}"
                        )
                    
                    work_order_item = WorkOrderItem(
                        work_order_id=new_work_order.id,
                        inventory_item_id=item_data.inventory_item_id,
                        quantity=item_data.quantity,
                        price=item_data.price or inv_item.unit_price,
                        notes=item_data.notes
                    )
                    db.add(work_order_item)
            
            # Commit the transaction
            db.commit()
            db.refresh(new_work_order)
            
            # Schedule notifications in background
            await WorkOrderService._schedule_notifications(db, new_work_order)
            
            return new_work_order
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating work order: {str(e)}")
            raise ConflictException(f"Failed to create work order: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating work order: {str(e)}")
            raise BadRequestException(f"Failed to create work order: {str(e)}")
    
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