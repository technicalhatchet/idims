from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Enum, Integer, Float, Numeric, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base
from app.models.service import Service

# Association Table for WorkOrderAppointment and Service
appointment_services_association = Table(
    'appointment_services_association',
    Base.metadata,
    Column('appointment_id', UUID(as_uuid=True), ForeignKey('work_order_appointments.id'), primary_key=True),
    Column('service_id', UUID(as_uuid=True), ForeignKey('services.id'), primary_key=True)
)

class WorkOrder(Base):
    """Work order model for storing service job information"""
    __tablename__ = "work_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    # title = Column(String(200), nullable=False) # Removed title
    description = Column(Text, nullable=True)
    priority = Column(Enum("low", "medium", "high", "urgent", name="work_order_priority_enum"), default="medium")
    status = Column(Enum("pending", "scheduled", "en_route", "waiting_on_parts", "in_progress", "on_hold",
                        "completed", "completed_pending_payment", "pending_estimate_approval",
                        "canceled", "parts_on_order", "reschedule", "need_to_contact",
                        "unreachable", "recall", "redo", "refunded", "closed",
                        name="work_order_status_enum"), default="pending")
    property_id = Column(UUID(as_uuid=True), ForeignKey('properties.id', ondelete='SET NULL'), nullable=True)
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
    
    # Equipment details
    equipment_make = Column(String(100), nullable=True)
    equipment_model = Column(String(100), nullable=True)
    equipment_serial = Column(String(100), nullable=True)
    equipment_version = Column(String(100), nullable=True)
    equipment_type = Column(String(50), nullable=True)  # 'appliance', 'tv', etc.
    equipment_subtype = Column(String(50), nullable=True)  # 'refrigerator', 'washing_machine', 'under_50', etc.
    is_wall_mounted = Column(Boolean, default=False)
    equipment_notes = Column(Text, nullable=True)
    symptoms = Column(JSONB, nullable=True)  # List of reported symptoms
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    client = relationship("Client", back_populates="work_orders")
    technician = relationship("Technician", foreign_keys=[assigned_technician_id], back_populates="work_orders")
    service_items = relationship("WorkOrderService", back_populates="work_order", cascade="all, delete-orphan")
    items = relationship("WorkOrderItem", back_populates="work_order", cascade="all, delete-orphan")
    notes = relationship("WorkOrderNote", back_populates="work_order", cascade="all, delete-orphan")
    status_history = relationship("WorkOrderStatusHistory", back_populates="work_order", cascade="all, delete-orphan")
    activity_log = relationship("WorkOrderActivityLog", back_populates="work_order", cascade="all, delete-orphan")
    performance_metrics = relationship("WorkOrderPerformanceMetric", back_populates="work_order", cascade="all, delete-orphan")
    appointments = relationship(
        "WorkOrderAppointment",
        back_populates="work_order",
        foreign_keys="WorkOrderAppointment.work_order_id",
        primaryjoin="WorkOrder.id == WorkOrderAppointment.work_order_id",
        cascade="all, delete-orphan",
    )
    invoices = relationship("Invoice", back_populates="work_order")
    documents = relationship("Document", back_populates="work_order")
    quote = relationship("Quote", back_populates="work_order")
    parts = relationship("WorkOrderPart", back_populates="work_order", cascade="all, delete-orphan")
    property_ref = relationship("Property", back_populates="work_orders")
    dma_outcome = relationship("DmaRepairOutcome", back_populates="work_order", uselist=False, cascade="all, delete-orphan")
    field_payments = relationship("WorkOrderPayment", back_populates="work_order", cascade="all, delete-orphan")
    expenses = relationship("WorkOrderExpense", back_populates="work_order", cascade="all, delete-orphan")
    expense_receipts = relationship("ExpenseReceipt", back_populates="work_order", cascade="all, delete-orphan")
    photos = relationship("WorkOrderPhoto", back_populates="work_order", cascade="all, delete-orphan")
    appointment_mileage = relationship("AppointmentMileage", back_populates="work_order", cascade="all, delete-orphan")
    
    # New columns for invoice totals
    invoice_subtotal = Column(Numeric(10, 2), nullable=True, default=0.00)
    invoice_tax = Column(Numeric(10, 2), nullable=True, default=0.00)
    invoice_total = Column(Numeric(10, 2), nullable=True, default=0.00)
    
    # Payment tracking fields for billing system
    amount_previously_paid = Column(Numeric(10, 2), nullable=False, default=0.00)
    diagnostic_discount_applied = Column(Boolean, default=False)
    diagnostic_discount_amount = Column(Numeric(10, 2), nullable=True)
    
    # Tax tracking
    tax_rate = Column(Numeric(5, 4), nullable=False, default=0.0775)  # e.g. 0.0775 = 7.75%
    tax_collected = Column(Numeric(10, 2), nullable=False, default=0.00)  # Running total of tax actually collected

    # Administrative close (separate from status=completed / operational complete)
    is_closed = Column(Boolean, nullable=False, default=False)
    closed_at = Column(DateTime, nullable=True)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    parent_work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True)
    is_redo = Column(Boolean, nullable=False, default=False)
    redo_source_appointment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_order_appointments.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    parent_work_order = relationship(
        "WorkOrder",
        remote_side=[id],
        foreign_keys=[parent_work_order_id],
        back_populates="child_redo_work_orders",
    )
    child_redo_work_orders = relationship(
        "WorkOrder",
        foreign_keys=[parent_work_order_id],
        back_populates="parent_work_order",
    )
    redo_source_appointment = relationship(
        "WorkOrderAppointment",
        foreign_keys=[redo_source_appointment_id],
        primaryjoin="WorkOrder.redo_source_appointment_id == WorkOrderAppointment.id",
        uselist=False,
        post_update=True,
    )
    closed_by_user = relationship("User", foreign_keys=[closed_by])
    
    def __repr__(self):
        return f"<WorkOrder {self.order_number}>" # Removed title from repr
    
    @property
    def duration(self):
        """Get actual duration in minutes if available"""
        if self.actual_start and self.actual_end:
            return (self.actual_end - self.actual_start).total_seconds() / 60
        return None
    
    @property
    def is_completed(self):
        """Check if work order is completed or administratively closed"""
        return self.status in ("completed", "closed")
    
    @property
    def is_overdue(self):
        """Check if work order is overdue"""
        if self.status in ["pending", "scheduled", "in_progress"] and self.scheduled_end:
            return datetime.utcnow() > self.scheduled_end
        return False

    def calculate_totals(self):
        from decimal import Decimal
        
        # Calculate subtotal from services (only billable services)
        services_subtotal = Decimal('0.00')
        diagnostic_price = Decimal('0.00')
        repair_price = Decimal('0.00')
        
        for item in self.service_items:
            if hasattr(item, 'total_price') and item.total_price is not None and item.billing_status in ['billable', 'paid']:
                item_price = Decimal(str(item.total_price))
                services_subtotal += item_price
                
                # Check if this is a diagnostic service
                if hasattr(item, 'service') and item.service and item.service.service_type == 'diagnostic':
                    diagnostic_price += item_price
                elif hasattr(item, 'service') and item.service and item.service.service_type == 'repair':
                    repair_price += item_price
        
        # Calculate subtotal from parts
        parts_subtotal = Decimal('0.00')
        for part in self.parts:
            if hasattr(part, 'price') and part.price is not None:
                price = Decimal(str(part.price))
                upfront = Decimal(str(part.amount_upfront_collected or 0))
                if part.status == 'phone_payment':
                    # Already paid in full - counts toward total but not due today
                    parts_subtotal += price
                elif part.status == 'upfront_50':
                    # 50% collected, 50% still owed - count full price in total
                    parts_subtotal += price
                elif part.status == 'installed':
                    # Full price or remaining balance due
                    parts_subtotal += price
        
        # Apply diagnostic discount when diagnostic + repair SKUs exist
        discount_amount = Decimal('0.00')
        if diagnostic_price > 0 and repair_price > 0:
            if self.diagnostic_discount_applied and self.diagnostic_discount_amount:
                discount_amount = Decimal(str(self.diagnostic_discount_amount))
            elif not self.diagnostic_discount_applied:
                discount_amount = diagnostic_price
                self.diagnostic_discount_applied = True
                self.diagnostic_discount_amount = discount_amount
            services_subtotal -= discount_amount

        # Total subtotal (services after discount + parts)
        subtotal = services_subtotal + parts_subtotal

        # Tax on parts only (matches invoice tab)
        tax_rate = Decimal(str(self.tax_rate or 0))
        tax = (parts_subtotal * tax_rate).quantize(Decimal('0.01'))
        total = subtotal + tax

        self.invoice_subtotal = subtotal
        self.invoice_tax = tax
        self.invoice_total = total
    
    def calculate_due_today(self):
        """Calculate amount due today (only billable items)"""
        from decimal import Decimal
        
        due_today = Decimal('0.00')
        
        # Add billable services
        for item in self.service_items:
            if (hasattr(item, 'total_price') and item.total_price is not None and 
                item.billing_status in ['billable', 'paid']):
                due_today += Decimal(str(item.total_price))
        
        # Add billable parts
        for part in self.parts:
            if (hasattr(part, 'price') and part.price is not None and 
                part.status in ['completed', 'phone_payment', 'up_front']):
                due_today += Decimal(str(part.price))
        
        # Apply diagnostic discount if applicable
        if self.diagnostic_discount_applied and self.diagnostic_discount_amount:
            due_today -= Decimal(str(self.diagnostic_discount_amount))
        
        return due_today
    
    def get_billing_status_summary(self):
        """Get summary of billing statuses for invoice display"""
        from decimal import Decimal
        
        summary = {
            'total_work_order': Decimal('0.00'),
            'amount_previously_paid': Decimal(str(self.amount_previously_paid or 0)),
            'due_today': Decimal('0.00'),
            'diagnostic_discount': Decimal(str(self.diagnostic_discount_amount or 0))
        }
        
        # Calculate total work order value (all items, regardless of billing status)
        for item in self.service_items:
            if hasattr(item, 'total_price') and item.total_price is not None:
                summary['total_work_order'] += Decimal(str(item.total_price))
        
        for part in self.parts:
            if hasattr(part, 'price') and part.price is not None:
                summary['total_work_order'] += Decimal(str(part.price))
        
        # Calculate due today
        summary['due_today'] = self.calculate_due_today()
        
        return summary


class WorkOrderService(Base):
    """Work order service model for services provided in a work order"""
    __tablename__ = "work_order_service"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False, index=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False, index=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("work_order_appointments.id"), nullable=True, index=True)  # Link to specific appointment
    name = Column(String(255), nullable=False) # Name of the service at time of adding
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)  # Price per unit at time of adding
    price = Column(Numeric(10, 2), nullable=False) # Total price for this service line (quantity * unit_price)
    notes = Column(Text, nullable=True)
    billing_status = Column(Enum("not_billable", "billable", "paid", "waived", name="billing_status_enum"), nullable=False, default="not_billable")
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="service_items")
    service = relationship("Service") # Relationship to the main Service/SKU table
    appointment = relationship("WorkOrderAppointment") # Relationship to the specific appointment
    
    @property
    def total_price(self):
        """Calculate total price for this service"""
        # This property can now directly return the stored price,
        # or be used as a check if recalculation is ever needed.
        # For now, it's better to rely on the stored price column for consistency.
        # If self.price is not set, then calculate it.
        if self.price is not None:
            return self.price
        if self.quantity is not None and self.unit_price is not None:
            return self.quantity * self.unit_price
        return 0.00

    def __repr__(self):
        return f"<WorkOrderService(work_order_id='{self.work_order_id}', service_id='{self.service_id}', name='{self.name}', quantity='{self.quantity}')>"


class WorkOrderItem(Base):
    """Work order item model for inventory items used in a work order"""
    __tablename__ = "work_order_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    # Field doesn't exist in the database - commented out
    # inventory_item_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    price = Column(Float, nullable=False)  # Price per unit
    notes = Column(Text, nullable=True)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="items")
    #inventory_item = relationship("InventoryItem")
    
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


class WorkOrderPhoto(Base):
    """Field photos attached to a work order (Notes tab)."""
    __tablename__ = "work_order_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(
        UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description = Column(String(500), nullable=True)
    is_model_sn_tag = Column(Boolean, nullable=False, default=False)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    storage_backend = Column(String(20), nullable=False, default="local")
    local_path = Column(String(512), nullable=True)
    drive_file_id = Column(String(128), nullable=True)
    drive_web_view_link = Column(String(512), nullable=True)
    drive_folder_id = Column(String(128), nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="photos")
    uploader = relationship("User")

    def __repr__(self):
        return f"<WorkOrderPhoto {self.id}: {self.filename}>"


class WorkOrderStatusHistory(Base):
    """Work order status history model for tracking status changes"""
    __tablename__ = "work_order_status_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    previous_status = Column(String(50), nullable=False, default='')
    new_status = Column(String(50), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="status_history")
    user = relationship("User", foreign_keys=[changed_by])
    
    def __repr__(self):
        return f"<StatusHistory {self.work_order_id}: {self.previous_status} -> {self.new_status}>"


class WorkOrderActivityLog(Base):
    """Debriefing / audit trail for work order and appointment changes."""
    __tablename__ = "work_order_activity_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type = Column(String(80), nullable=False)
    headline = Column(String(500), nullable=False)
    actor_label = Column(String(50), nullable=False)
    event_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="activity_log")
    user = relationship("User")

    def __repr__(self):
        return f"<WorkOrderActivityLog {self.event_type}: {self.headline[:40]}>"


class WorkOrderPerformanceMetric(Base):
    """Stored field-performance metrics (on-site time, etc.) for reporting."""
    __tablename__ = "work_order_performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False, index=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("work_order_appointments.id"), nullable=True, index=True)
    metric_type = Column(String(50), nullable=False, default="on_site_duration")
    actual_minutes = Column(Float, nullable=False)
    estimated_minutes = Column(Float, nullable=True)
    percent_of_estimate = Column(Float, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    event_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="performance_metrics")
    appointment = relationship("WorkOrderAppointment")

    def __repr__(self):
        return f"<WorkOrderPerformanceMetric {self.metric_type}: {self.actual_minutes}m>"


class WorkOrderAppointment(Base):
    """Work order appointment model for scheduling multiple appointments for a work order"""
    __tablename__ = "work_order_appointments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    appointment_type = Column(String(50), nullable=False)  # 'diagnostic', 'repair', 'follow-up', etc.
    status = Column(Enum("scheduled", "reschedule", "completed", "canceled", "phone_payment", "refund",
                    "en_route", "in_progress", "completed_pending_payment", "unreachable", "failed", "redo",
                    name="appointment_status_enum"), default="scheduled")
    scheduled_start = Column(DateTime, nullable=False)
    scheduled_end = Column(DateTime, nullable=False)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    assigned_technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Travel time fields
    travel_time_before = Column(Integer, nullable=True)  # Time in seconds to reach appointment location
    travel_time_after = Column(Integer, nullable=True)   # Time in seconds to next appointment or back to shop
    travel_distance_before = Column(Integer, nullable=True)  # Distance in meters to appointment
    travel_distance_after = Column(Integer, nullable=True)   # Distance in meters to next location
    is_forced_schedule = Column(Boolean, default=False)  # Flag for admin-forced scheduling
    time_window = Column(String(50), nullable=True) # Added time_window field for 'morning'/'afternoon'
    notes = Column(Text, nullable=True)  # Notes for this appointment
    
    mileage = relationship("AppointmentMileage", back_populates="appointment", uselist=False, cascade="all, delete-orphan")
    
    # Relationships
    work_order = relationship(
        "WorkOrder",
        back_populates="appointments",
        foreign_keys=[work_order_id],
        primaryjoin="WorkOrderAppointment.work_order_id == WorkOrder.id",
    )
    technician = relationship("Technician", foreign_keys=[assigned_technician_id])
    services = relationship(
        "Service", 
        secondary=appointment_services_association,
        backref="appointments_associated" # Using backref to avoid conflict if Service model has its own 'appointments' relationship
    )
    
    def __repr__(self):
        return f"<WorkOrderAppointment {self.id}: {self.appointment_type} - {self.status}>"
    
    @property
    def duration(self):
        """Get actual duration in minutes if available"""
        if self.actual_start and self.actual_end:
            return (self.actual_end - self.actual_start).total_seconds() / 60
        return None
    
    @property
    def is_completed(self):
        """Check if appointment is completed"""
        return self.status == "completed"
    
    @property
    def is_overdue(self):
        """Check if appointment is overdue"""
        if self.status in ["scheduled"] and self.scheduled_end:
            return datetime.utcnow() > self.scheduled_end
        return False


class WorkOrderPart(Base):
    """Work order part model for tracking parts used in a work order"""
    __tablename__ = "work_order_parts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=False)
    
    number = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    cost = Column(Float, nullable=False, default=0.0)
    price = Column(Float, nullable=False, default=0.0)
    vendor = Column(String(50), nullable=True)  # 'Tribles', 'ShopJimmy', 'Encompass', 'Sears', 'Amazon', 'PartsSelect', 'Other'
    status = Column(String(50), nullable=False, default="needed")  # 'needed', 'ordered', 'received', 'upfront_50', 'phone_payment', 'paid_not_installed', 'installed', 'not_installed'
    tracking_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    amount_upfront_collected = Column(Numeric(10, 2), nullable=False, default=0.00)
    tax_collected = Column(Numeric(10, 2), nullable=False, default=0.00)  # Tax collected on this part
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="parts")
    
    def __repr__(self):
        return f"<WorkOrderPart {self.number}: {self.description}>"
    
    @property
    def markup_percentage(self):
        """Calculate markup percentage"""
        if self.cost and self.cost > 0:
            return ((self.price - self.cost) / self.cost) * 100
        return None