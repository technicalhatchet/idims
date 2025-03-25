from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, date, timedelta
from uuid import UUID
from pydantic import ConfigDict

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
    model_config = ConfigDict(from_attributes=True)

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
    """Quote response schema"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    model_config = ConfigDict(from_attributes=True)

class QuoteListResponse(BaseModel):
    """Quote list response schema"""
    items: List[QuoteResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)

class QuoteDetailResponse(QuoteResponse):
    """Quote detail response schema"""
    items: List[QuoteItemResponse]
    model_config = ConfigDict(from_attributes=True)

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