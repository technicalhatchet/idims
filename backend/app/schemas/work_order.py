from pydantic import BaseModel, validator, Field, field_validator
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict
import uuid
from decimal import Decimal
from app.schemas.service import ServiceResponse
from app.schemas.technician import TechnicianResponse
from pydantic import model_validator

class ServiceLocationSchema(BaseModel):
    """Schema for service location"""
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None

class WorkOrderServiceSchema(BaseModel):
    """Schema for work order service"""
    service_id: UUID
    quantity: float = 1.0
    price: Optional[float] = None
    notes: Optional[str] = None

class WorkOrderItemSchema(BaseModel):
    """Schema for work order item"""
    inventory_item_id: UUID
    quantity: float = 1.0
    price: Optional[float] = None
    notes: Optional[str] = None

class WorkOrderBase(BaseModel):
    """Base schema for Work Order data"""
    client_id: UUID
    # title: str # Removed title
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    service_location: Optional[Dict[str, Any]] = None
    
    # Optional equipment details
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_serial: Optional[str] = None
    equipment_version: Optional[str] = None
    equipment_type: Optional[str] = None  # 'appliance', 'tv', etc.
    equipment_subtype: Optional[str] = None  # 'refrigerator', 'washing_machine', 'under_50', etc.
    is_wall_mounted: Optional[bool] = False
    equipment_notes: Optional[str] = None
    symptoms: Optional[List[str]] = None
    
    # Removed scheduled_start, scheduled_end, estimated_duration, and assigned_technician_id
    # These will be handled through appointments
    
    quote_id: Optional[UUID] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[Dict[str, Any]] = None
    
    @validator('priority')
    def validate_priority(cls, v):
        allowed_priorities = ["low", "medium", "high", "urgent"]
        if v not in allowed_priorities:
            raise ValueError(f"Priority must be one of {allowed_priorities}")
        return v

class WorkOrderCreate(WorkOrderBase):
    """Schema for creating a new work order"""
    # services: Optional[List[WorkOrderServiceSchema]] = None # Removed services from initial creation
    items: Optional[List[WorkOrderItemSchema]] = None
    # New work orders are created with pending status by default


class InitialAppointmentCreate(BaseModel):
    """First appointment payload when creating a work order and initial visit in one transaction."""
    appointment_type: str = "diagnostic"
    scheduled_start: datetime
    assigned_technician_id: Optional[UUID] = None
    service_ids: Optional[List[UUID]] = Field(None, description="List of service IDs for this appointment")
    travel_time_before: Optional[int] = None
    travel_time_after: Optional[int] = None
    travel_distance_before: Optional[int] = None
    travel_distance_after: Optional[int] = None
    is_forced_schedule: Optional[bool] = None
    time_window: Optional[str] = None

    @validator("assigned_technician_id", pre=True)
    def empty_technician_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v

    @validator("appointment_type")
    def validate_appointment_type(cls, v):
        allowed_types = ["diagnostic", "repair", "follow-up", "inspection", "maintenance"]
        if v not in allowed_types:
            raise ValueError(f"Appointment type must be one of {allowed_types}")
        return v

    @validator("time_window")
    def validate_time_window(cls, v):
        if v is not None:
            allowed_windows = ["morning", "afternoon"]
            if v not in allowed_windows:
                raise ValueError(f"Time window must be one of {allowed_windows}")
        return v

    class Config:
        orm_mode = True


class WorkOrderWithInitialAppointmentCreate(WorkOrderCreate):
    """Create a work order and the first appointment atomically (same DB transaction)."""
    initial_appointment: InitialAppointmentCreate


class WorkOrderUpdate(BaseModel):
    """Schema for updating a work order"""
    # title: Optional[str] = None # Removed title
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[uuid.UUID] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    estimated_duration: Optional[int] = None  # In minutes
    assigned_technician_id: Optional[uuid.UUID] = None
    service_location: Optional[Dict[str, Any]] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[Dict[str, Any]] = None
    updated_by: Optional[uuid.UUID] = None
    status_notes: Optional[str] = None
    
    # Equipment fields
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_serial: Optional[str] = None
    equipment_version: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    is_wall_mounted: Optional[bool] = None
    equipment_notes: Optional[str] = None
    
    class Config:
        orm_mode = True
        arbitrary_types_allowed = True
        json_encoders = {
            uuid.UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat() if v else None
        }
    
    @validator('priority')
    def validate_priority(cls, v):
        if v is not None:
            allowed_priorities = ["low", "medium", "high", "urgent"]
            if v not in allowed_priorities:
                raise ValueError(f"Priority must be one of {allowed_priorities}")
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["pending", "scheduled", "en_route", "waiting_on_parts", "in_progress", "on_hold",
                              "completed", "completed_pending_payment", "pending_estimate_approval",
                              "cancelled", "parts_on_order", "reschedule", "need_to_contact",
                              "unreachable", "recall", "redo"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class WorkOrderServiceResponse(WorkOrderServiceSchema):
    """Schema for work order service response"""
    id: UUID
    name: str
    unit_price: float
    quantity: float
    total_price: float
    billing_status: str = "not_billable"  # not_billable, billable, paid, waived
    appointment_id: Optional[UUID] = None  # Link to specific appointment
    model_config = ConfigDict(from_attributes=True)

class WorkOrderItemResponse(WorkOrderItemSchema):
    """Schema for work order item response"""
    id: UUID
    total: float
    work_order_id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkOrderResponse(WorkOrderBase):
    """Work order response schema"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    status: str
    # Scheduling at WO level (may be mirrored from appointments for display)
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    estimated_duration: Optional[int] = None
    assigned_technician_id: Optional[UUID] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    order_number: str
    client_name: Optional[str] = None
    client_user: Optional[Dict[str, Any]] = None
    technician_name: Optional[str] = None
    technician_user: Optional[Dict[str, Any]] = None
    
    # Invoice fields
    invoice_subtotal: Optional[float] = None
    invoice_tax: Optional[float] = None
    invoice_total: Optional[float] = None
    
    # Payment tracking fields
    amount_previously_paid: Optional[float] = 0.00
    diagnostic_discount_applied: Optional[bool] = False
    diagnostic_discount_amount: Optional[float] = None
    tax_rate: Optional[float] = 0.0775
    tax_collected: Optional[float] = 0.00

    # Service items
    service_items: List[WorkOrderServiceResponse] = []
    
    # Format equipment details for display with defaults
    formatted_equipment_make: Optional[str] = None
    formatted_equipment_model: Optional[str] = None
    formatted_equipment_serial: Optional[str] = None
    formatted_equipment_version: Optional[str] = None
    formatted_equipment_type: Optional[str] = None
    formatted_equipment_subtype: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True, extra="allow")
    
    @field_validator('formatted_equipment_make', 'formatted_equipment_model', 
                    'formatted_equipment_serial', 'formatted_equipment_version',
                    'formatted_equipment_type', 'formatted_equipment_subtype', mode='after')
    @classmethod
    def set_default_value(cls, v, info):
        field_name = info.field_name.replace('formatted_', '')
        original_value = getattr(info.data, field_name, None)
        return original_value if original_value else 'N/A'

class WorkOrderListResponse(BaseModel):
    """Work order list response schema"""
    items: List[WorkOrderResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)

class WorkOrderStatusUpdate(BaseModel):
    """Schema for updating work order status"""
    status: str
    notes: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["pending", "scheduled", "en_route", "waiting_on_parts", "in_progress", "on_hold",
                          "completed", "completed_pending_payment", "pending_estimate_approval",
                          "cancelled", "parts_on_order", "reschedule", "need_to_contact",
                          "unreachable", "recall", "redo"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class WorkOrderAssign(BaseModel):
    """Schema for assigning a work order to a technician"""
    technician_id: UUID

class WorkOrderAppointmentBase(BaseModel):
    """Base schema for Work Order Appointment data"""
    work_order_id: UUID
    appointment_type: str  # 'diagnostic', 'repair', 'follow-up', etc.
    scheduled_start: datetime
    scheduled_end: datetime
    assigned_technician_id: Optional[UUID] = None
    notes: Optional[str] = None  # Note: This field is not yet implemented in the database model
    travel_time_before: Optional[int] = None  # Time in seconds to reach appointment location
    travel_time_after: Optional[int] = None   # Time in seconds to next appointment or back to shop
    travel_distance_before: Optional[int] = None  # Distance in meters to appointment
    travel_distance_after: Optional[int] = None   # Distance in meters to next location
    is_forced_schedule: Optional[bool] = None  # Flag for admin-forced scheduling
    time_window: Optional[str] = None  # 'morning' or 'afternoon'
    
    @validator('appointment_type')
    def validate_appointment_type(cls, v):
        allowed_types = ["diagnostic", "repair", "follow-up", "inspection", "maintenance"]
        if v not in allowed_types:
            raise ValueError(f"Appointment type must be one of {allowed_types}")
        return v
        
    @validator('time_window')
    def validate_time_window(cls, v):
        if v is not None:
            allowed_windows = ["morning", "afternoon"]
            if v not in allowed_windows:
                raise ValueError(f"Time window must be one of {allowed_windows}")
        return v

class WorkOrderAppointmentCreate(BaseModel):
    """Schema for creating a new work order appointment"""
    work_order_id: UUID
    appointment_type: str
    scheduled_start: datetime
    # scheduled_end: datetime # Will be calculated based on services
    assigned_technician_id: Optional[UUID] = None
    service_ids: Optional[List[UUID]] = Field(None, description="List of service IDs for this appointment")
    travel_time_before: Optional[int] = None
    travel_time_after: Optional[int] = None
    travel_distance_before: Optional[int] = None
    travel_distance_after: Optional[int] = None
    is_forced_schedule: Optional[bool] = None
    time_window: Optional[str] = None

    class Config:
        orm_mode = True

class WorkOrderAppointmentUpdate(BaseModel):
    """Schema for updating a work order appointment"""
    work_order_id: Optional[UUID] = None
    appointment_type: Optional[str] = None
    status: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    # scheduled_end: Optional[datetime] = None # Will be recalculated if start or services change
    assigned_technician_id: Optional[UUID] = None
    service_ids: Optional[List[UUID]] = Field(None, description="List of service IDs for this appointment")
    notes: Optional[str] = None
    travel_time_before: Optional[int] = None
    travel_time_after: Optional[int] = None
    travel_distance_before: Optional[int] = None
    travel_distance_after: Optional[int] = None
    is_forced_schedule: Optional[bool] = None

    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["scheduled", "reschedule", "completed", "canceled", "phone_payment", "refund"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class WorkOrderAppointmentResponse(WorkOrderAppointmentBase):
    """Schema for a work order appointment response"""
    id: UUID
    work_order_id: UUID
    appointment_type: Optional[str] = None
    status: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    assigned_technician_id: Optional[UUID] = None
    notes: Optional[str] = None
    travel_time_before: Optional[int] = None
    travel_time_after: Optional[int] = None
    travel_distance_before: Optional[float] = None
    travel_distance_after: Optional[float] = None
    is_forced_schedule: Optional[bool] = None
    time_window: Optional[str] = None

    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None

    services: Optional[List[ServiceResponse]] = []
    assigned_technician: Optional[TechnicianResponse] = None
    
    # Explicitly declare service_ids here, even if inherited, to make validator target clear
    service_ids: Optional[List[UUID]] = Field(default_factory=list) # Default to empty list

    @model_validator(mode='after')
    def populate_service_ids_from_services(self) -> 'WorkOrderAppointmentResponse':
        # Always ensure service_ids is at least an empty list before trying to populate
        if self.service_ids is None: # Should be handled by default_factory, but as a safeguard
            self.service_ids = []

        if hasattr(self, 'services') and self.services:
            # Populate service_ids from the services relationship
            # This will overwrite the default_factory empty list if services are present
            populated_ids = [s.id for s in self.services if s and hasattr(s, 'id') and s.id is not None]
            if populated_ids: # Only assign if we actually got some IDs
                self.service_ids = populated_ids
        # If no services or no valid IDs from services, service_ids remains default_factory list (or already populated)
        return self

    class Config:
        from_attributes = True


class WorkOrderWithInitialAppointmentResponse(BaseModel):
    """Response for composite work order + first appointment creation."""
    work_order: WorkOrderResponse
    appointment: WorkOrderAppointmentResponse

    model_config = ConfigDict(from_attributes=True)


class WorkOrderDetailResponse(WorkOrderResponse):
    """Work order detail response schema"""
    items: List[WorkOrderItemResponse]
    services: List[WorkOrderServiceResponse]
    appointments: List[WorkOrderAppointmentResponse] = []
    model_config = ConfigDict(from_attributes=True)

class WorkOrderNoteCreate(BaseModel):
    """Schema for creating a new work order note"""
    work_order_id: UUID
    note: str
    is_private: bool = False

class WorkOrderNoteResponse(BaseModel):
    """Work order note response schema"""
    id: UUID
    work_order_id: UUID
    user_id: UUID
    note: str
    is_private: bool
    created_at: datetime
    user_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# New schemas for parts
class WorkOrderPartBase(BaseModel):
    """Base schema for work order part"""
    number: str
    description: str
    cost: float
    price: float
    vendor: Optional[str] = None
    status: str = "needed"  # 'needed', 'ordered', 'received', 'installed', 'not_installed', 'completed', 'phone_payment', 'up_front'
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    
    amount_upfront_collected: float = 0.00
    tax_collected: float = 0.00

    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["needed", "ordered", "received", "installed", "not_installed", "upfront_50", "phone_payment", "paid_not_installed"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('vendor')
    def validate_vendor(cls, v):
        if v is not None:
            allowed_vendors = ["Tribles", "ShopJimmy", "Encompass", "Sears", "Amazon", "PartsSelect", "Other"]
            if v not in allowed_vendors:
                raise ValueError(f"Vendor must be one of {allowed_vendors}")
        return v

class WorkOrderPartCreate(WorkOrderPartBase):
    """Schema for creating a new work order part"""
    work_order_id: UUID

class WorkOrderPartUpdate(BaseModel):
    """Schema for updating a work order part"""
    number: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    price: Optional[float] = None
    vendor: Optional[str] = None
    status: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    amount_upfront_collected: Optional[float] = None
    tax_collected: Optional[float] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["needed", "ordered", "received", "installed", "not_installed", "upfront_50", "phone_payment", "paid_not_installed"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('vendor')
    def validate_vendor(cls, v):
        if v is not None:
            allowed_vendors = ["Tribles", "ShopJimmy", "Encompass", "Sears", "Amazon", "PartsSelect", "Other"]
            if v not in allowed_vendors:
                raise ValueError(f"Vendor must be one of {allowed_vendors}")
        return v
        
    model_config = ConfigDict(from_attributes=True)

class WorkOrderPartResponse(WorkOrderPartBase):
    """Schema for responding with a work order part"""
    id: UUID
    work_order_id: UUID
    amount_upfront_collected: float = 0.00
    tax_collected: float = 0.00
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    
    model_config = ConfigDict(from_attributes=True)

# New schemas for billing system
class BillingStatusUpdate(BaseModel):
    """Schema for updating billing status of a service"""
    service_id: UUID
    billing_status: str
    
    @validator('billing_status')
    def validate_billing_status(cls, v):
        allowed_statuses = ["not_billable", "billable", "paid", "waived"]
        if v not in allowed_statuses:
            raise ValueError(f"Billing status must be one of {allowed_statuses}")
        return v

class WorkOrderBillingSummary(BaseModel):
    """Schema for work order billing summary"""
    total_work_order: float
    amount_previously_paid: float
    due_today: float
    diagnostic_discount: float
    
class AdminBillingOverride(BaseModel):
    """Schema for admin billing overrides"""
    service_id: Optional[UUID] = None
    part_id: Optional[UUID] = None
    action: str  # 'waive_diagnostic', 'change_billing_status', 'apply_payment'
    new_billing_status: Optional[str] = None
    payment_amount: Optional[float] = None
    
    @validator('action')
    def validate_action(cls, v):
        allowed_actions = ["waive_diagnostic", "change_billing_status", "apply_payment"]
        if v not in allowed_actions:
            raise ValueError(f"Action must be one of {allowed_actions}")
        return v