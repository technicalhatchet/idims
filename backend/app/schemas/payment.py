from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from uuid import UUID

class PaymentBase(BaseModel):
    """Base schema for Payment data"""
    invoice_id: UUID
    amount: float
    payment_method: str
    payment_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    
    @validator('payment_method')
    def validate_payment_method(cls, v):
        allowed_methods = ["credit_card", "cash", "check", "bank_transfer", "paypal", "stripe", "other"]
        if v not in allowed_methods:
            raise ValueError(f"Payment method must be one of {allowed_methods}")
        return v
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return v

class PaymentCreate(PaymentBase):
    """Schema for creating a new payment"""
    status: str = "success"
    transaction_id: Optional[str] = None
    processor_response: Optional[Dict[str, Any]] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["success", "pending", "failed", "refunded"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class PaymentUpdate(BaseModel):
    """Schema for updating a payment"""
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    payment_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    transaction_id: Optional[str] = None
    processor_response: Optional[Dict[str, Any]] = None
    
    @validator('payment_method')
    def validate_payment_method(cls, v):
        if v is not None:
            allowed_methods = ["credit_card", "cash", "check", "bank_transfer", "paypal", "stripe", "other"]
            if v not in allowed_methods:
                raise ValueError(f"Payment method must be one of {allowed_methods}")
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["success", "pending", "failed", "refunded"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('amount')
    def validate_amount(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return v

class PaymentResponse(PaymentBase):
    """Schema for payment response"""
    id: UUID
    payment_number: str
    status: str
    transaction_id: Optional[str] = None
    processor_response: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    invoice_number: Optional[str] = None
    client_id: Optional[UUID] = None
    client_name: Optional[str] = None
    
    class Config:
        orm_mode = True

class PaymentListResponse(BaseModel):
    """Schema for paginated list of payments"""
    total: int
    items: List[PaymentResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True

class RefundRequest(BaseModel):
    """Schema for payment refund request"""
    amount: Optional[float] = None  # If None, refund full amount
    reason: Optional[str] = None

class PaymentMethodBase(BaseModel):
    """Base schema for payment method"""
    type: str
    token: Optional[str] = None
    last_four: Optional[str] = None
    expiry_date: Optional[str] = None
    nickname: Optional[str] = None
    is_default: bool = False
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('type')
    def validate_type(cls, v):
        allowed_types = ["credit_card", "bank_account", "paypal", "other"]
        if v not in allowed_types:
            raise ValueError(f"Type must be one of {allowed_types}")
        return v
    
    @validator('last_four')
    def validate_last_four(cls, v):
        if v is not None and (len(v) != 4 or not v.isdigit()):
            raise ValueError("Last four must be a 4-digit string")
        return v
    
    @validator('expiry_date')
    def validate_expiry_date(cls, v):
        if v is not None:
            import re
            if not re.match(r'^(0[1-9]|1[0-2])/20[2-9][0-9]$', v):
                raise ValueError("Expiry date must be in format MM/YYYY")
        return v

class PaymentMethodCreate(PaymentMethodBase):
    """Schema for creating a new payment method"""
    pass

class PaymentMethodUpdate(BaseModel):
    """Schema for updating a payment method"""
    nickname: Optional[str] = None
    is_default: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None

class PaymentMethodResponse(PaymentMethodBase):
    """Schema for payment method response"""
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class PaymentIntentCreate(BaseModel):
    """Schema for creating a payment intent with Stripe"""
    invoice_id: UUID
    amount: float
    payment_method_id: Optional[str] = None
    save_payment_method: bool = False
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v