from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, date
from uuid import UUID
from pydantic import ConfigDict

class InvoiceItemBase(BaseModel):
    """Base schema for invoice item"""
    description: str
    quantity: float
    unit_price: float
    tax_rate: float = 0
    discount: float = 0
    work_order_service_id: Optional[UUID] = None
    work_order_item_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None

class InvoiceItemCreate(InvoiceItemBase):
    """Schema for creating an invoice item"""
    pass

class InvoiceItemUpdate(BaseModel):
    """Schema for updating an invoice item"""
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    discount: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class InvoiceItemResponse(InvoiceItemBase):
    """Schema for invoice item response"""
    id: UUID
    total: float
    invoice_id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InvoiceBase(BaseModel):
    """Base schema for invoice data"""
    client_id: UUID
    work_order_id: Optional[UUID] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    discount: Optional[float] = None
    total: Optional[float] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    payment_instructions: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class InvoiceCreate(InvoiceBase):
    """Schema for creating a new invoice"""
    items: List[InvoiceItemCreate]
    status: Optional[str] = "draft"
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('due_date')
    def validate_due_date(cls, v, values):
        if v and 'issue_date' in values and values['issue_date']:
            if v < values['issue_date']:
                raise ValueError("Due date cannot be before issue date")
        return v

class InvoiceUpdate(BaseModel):
    """Schema for updating an invoice"""
    client_id: Optional[UUID] = None
    work_order_id: Optional[UUID] = None
    status: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    discount: Optional[float] = None
    total: Optional[float] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    payment_instructions: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('due_date')
    def validate_due_date(cls, v, values):
        if v and 'issue_date' in values and values['issue_date']:
            if v < values['issue_date']:
                raise ValueError("Due date cannot be before issue date")
        return v

class InvoiceResponse(InvoiceBase):
    """Invoice response schema"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    model_config = ConfigDict(from_attributes=True)

class InvoiceListResponse(BaseModel):
    """Invoice list response schema"""
    items: List[InvoiceResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)

class InvoiceDetailResponse(InvoiceResponse):
    """Invoice detail response schema"""
    items: List[InvoiceItemResponse]
    model_config = ConfigDict(from_attributes=True)

class InvoiceStatusUpdate(BaseModel):
    """Schema for updating invoice status"""
    status: str
    notes: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class InvoiceSend(BaseModel):
    """Schema for sending an invoice"""
    email_recipients: Optional[List[str]] = None
    email_subject: Optional[str] = None
    email_message: Optional[str] = None
    send_to_client: bool = True