from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from uuid import UUID

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
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    service_location: Optional[Dict[str, Any]] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    estimated_duration: Optional[int] = None  # in minutes
    assigned_technician_id: Optional[UUID] = None
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
    services: Optional[List[WorkOrderServiceSchema]] = None
    items: Optional[List[WorkOrderItemSchema]] = None

class WorkOrderUpdate(BaseModel):
    """Schema for updating a work order"""
    client_id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    status_notes: Optional[str] = None
    service_location: Optional[Dict[str, Any]] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    estimated_duration: Optional[int] = None
    assigned_technician_id: Optional[UUID] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[Dict[str, Any]] = None
    updated_by: Optional[UUID] = None
    
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
            allowed_statuses = ["pending", "scheduled", "in_progress", "on_hold", "completed", "cancelled"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class WorkOrderServiceResponse(WorkOrderServiceSchema):
    """Schema for work order service response"""
    id: UUID
    name: str
    total: float
    
    class Config:
        orm_mode = True

class WorkOrderItemResponse(WorkOrderItemSchema):
    """Schema for work order item response"""
    id: UUID
    name: str
    total: float
    
    class Config:
        orm_mode = True

class WorkOrderResponse(WorkOrderBase):
    """Schema for work order response"""
    id: UUID
    order_number: str
    status: str
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    services: Optional[List[WorkOrderServiceResponse]] = None
    items: Optional[List[WorkOrderItemResponse]] = None
    client: Optional[Dict[str, Any]] = None
    technician: Optional[Dict[str, Any]] = None
    
    class Config:
        orm_mode = True

class WorkOrderListResponse(BaseModel):
    """Schema for paginated list of work orders"""
    total: int
    items: List[WorkOrderResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True

class WorkOrderStatusUpdate(BaseModel):
    """Schema for updating work order status"""
    status: str
    notes: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["pending", "scheduled", "in_progress", "on_hold", "completed", "cancelled"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class WorkOrderAssign(BaseModel):
    """Schema for assigning a work order to a technician"""
    technician_id: UUID