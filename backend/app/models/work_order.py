from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Enum, Integer, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class WorkOrder(Base):
    """Work order model for storing service job information"""
    __tablename__ = "work_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Enum("low", "medium", "high", "urgent", name="work_order_priority_enum"), default="medium")
    status = Column(Enum("pending", "scheduled", "in_progress", "on_hold", "completed", "cancelled", 
                         name="work_order_status_enum"), default="pending")
    service_location = Column(JSONB, nullable=True)  # Address and location details
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    estimated_duration = Column(Integer, nullable=True)  # In minutes
    assigned_technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id"), nullable=True)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=True)
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    client = relationship("Client", back_populates="work_orders")
    technician = relationship("Technician", foreign_keys=[assigned_technician_id], back_populates="work_orders")
    services = relationship("WorkOrderService", back_populates="work_order", cascade="all, delete-orphan")
    items = relationship("WorkOrderItem", back_populates="work_order", cascade="all, delete-orphan")
    notes = relationship("WorkOrderNote", back_populates="work_order", cascade="all, delete-orphan")
    status_history = relationship("WorkOrderStatusHistory", back_populates="work_order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="work_order")
    
    def __repr__(self):
        return f"<WorkOrder {self.order_number}: {self.title}>"
    
    @property
    def duration(self):
        """Get actual duration in minutes if available"""
        if self.actual_start and self.actual_end:
            return (self.actual_end - self.actual_start).total_seconds() / 60
        return None
    
    @property
    def is_completed(self):
        """Check if work order is completed"""
        return self.status == "completed"
    
    @property
    def is_overdue(self):
        """Check if work order is overdue"""
        if self.status in ["pending", "scheduled", "in_progress"] and self.scheduled_end:
            return datetime.utcnow() > self.scheduled_end
        return False


class WorkOrderService(Base):
    """Work order service model for services provided in a work order"""
    __tablename__ = "work_order_services"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    price = Column(Float, nullable=False)  # Price per unit
    notes = Column(Text, nullable=True)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="services")
    service = relationship("Service")
    
    @property
    def total(self):
        """Calculate total price for this service"""
        return self.quantity * self.price


class WorkOrderItem(Base):
    """Work order item model for inventory items used in a work order"""
    __tablename__ = "work_order_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    #inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    price = Column(Float, nullable=False)  # Price per unit
    notes = Column(Text, nullable=True)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="items")
    inventory_item = relationship("InventoryItem")
    
    @property
    def total(self):
        """Calculate total price for this item"""
        return self.quantity * self.price


class WorkOrderNote(Base):
    """Work order note model for tracking comments and updates"""
    __tablename__ = "work_order_notes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    is_private = Column(Boolean, default=False)  # If true, only visible to staff
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="notes")
    user = relationship("User")
    
    def __repr__(self):
        return f"<WorkOrderNote {self.id}: {self.note[:30]}...>"


class WorkOrderStatusHistory(Base):
    """Work order status history model for tracking status changes"""
    __tablename__ = "work_order_status_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="status_history")
    user = relationship("User", foreign_keys=[changed_by])
    
    def __repr__(self):
        return f"<StatusHistory {self.work_order_id}: {self.previous_status} -> {self.new_status}>"