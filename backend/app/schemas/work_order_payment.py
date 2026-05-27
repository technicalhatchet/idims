from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


ALLOWED_PAYMENT_METHODS = [
    "cash",
    "check",
    "credit_card",
    "bank_transfer",
    "other",
]


class RecordWorkOrderPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Total amount received")
    subtotal_amount: Optional[float] = Field(None, ge=0)
    tax_amount: Optional[float] = Field(0, ge=0)
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    mark_work_order_completed: bool = False

    @validator("payment_method")
    def validate_payment_method(cls, v):
        if v not in ALLOWED_PAYMENT_METHODS:
            raise ValueError(f"payment_method must be one of {ALLOWED_PAYMENT_METHODS}")
        return v


class WorkOrderPaymentResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    payment_number: str
    amount: float
    subtotal_amount: Optional[float] = None
    tax_amount: float
    tax_rate_snapshot: Optional[float] = None
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    payment_date: datetime
    recorded_by: UUID
    recorder_name: Optional[str] = None

    class Config:
        from_attributes = True


class WorkOrderPaymentListResponse(BaseModel):
    items: List[WorkOrderPaymentResponse]
    total: int
