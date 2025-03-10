from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, date, timedelta
from uuid import UUID

class QuoteItemBase(BaseModel):
    """Base schema for quote item"""
    description: str
    quantity: float
    unit_price: float
    tax_rate: float = 0
    discount: float = 0
    service_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None

class QuoteItemCreate(QuoteItemBase):
    """Schema for creating a quote item"""
    pass

class QuoteItemUpdate(BaseModel):
    """Schema for updating a quote item"""
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    discount: Optional[float] = None
    service_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None

class QuoteItemResponse(QuoteItemBase):
    """Schema for quote item response"""
    id: UUID
    total: float
    quote_id: UUID
    created_at: datetime
    
    class Config:
        orm_mode = True

class QuoteBase(BaseModel):
    """Base schema for Quote data"""
    client_id: UUID
    title: str
    description: Optional[str] = None
    valid_until: date
    terms: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class QuoteCreate(QuoteBase):
    """Schema for creating a new quote"""
    items: List[QuoteItemCreate]
    status: str = "draft"
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["draft", "sent", "accepted", "rejected", "expired"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('valid_until')
    def validate_valid_until(cls, v):
        if v < datetime.now().date():
            raise ValueError("Valid until date cannot be in the past")
        return v

class QuoteUpdate(BaseModel):
    """Schema for updating a quote"""
    client_id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    valid_until: Optional[date] = None
    status: Optional[str] = None
    terms: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["draft", "sent", "accepted", "rejected", "expired"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('valid_until')
    def validate_valid_until(cls, v):
        if v is not None and v < datetime.now().date():
            raise ValueError("Valid until date cannot be in the past")
        return v

class QuoteResponse(QuoteBase):
    """Schema for quote response"""
    id: UUID
    quote_number: str
    status: str
    created_at: datetime
    updated_at: datetime
    subtotal: float
    tax: float
    discount: float
    total: float
    created_by: Optional[UUID] = None
    items: List[QuoteItemResponse]
    client: Optional[Dict[str, Any]] = None
    
    class Config:
        orm_mode = True

class QuoteListResponse(BaseModel):
    """Schema for paginated list of quotes"""
    total: int
    items: List[QuoteResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True

class QuoteStatusUpdate(BaseModel):
    """Schema for updating quote status"""
    status: str
    notes: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["draft", "sent", "accepted", "rejected", "expired"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class QuoteSend(BaseModel):
    """Schema for sending a quote"""
    email_recipients: Optional[List[str]] = None
    email_subject: Optional[str] = None
    email_message: Optional[str] = None
    send_to_client: bool = True

class ConvertQuoteRequest(BaseModel):
    """Schema for converting a quote to a work order or invoice"""
    convert_to: str  # "work_order" or "invoice"
    scheduled_start: Optional[datetime] = None  # For work order
    scheduled_end: Optional[datetime] = None    # For work order
    technician_id: Optional[UUID] = None        # For work order
    issue_date: Optional[date] = None           # For invoice
    due_date: Optional[date] = None             # For invoice
    
    @validator('convert_to')
    def validate_convert_to(cls, v):
        allowed_values = ["work_order", "invoice"]
        if v not in allowed_values:
            raise ValueError(f"Convert to must be one of {allowed_values}")
        return v