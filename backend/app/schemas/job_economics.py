from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.constants.expense_categories import EXPENSE_CATEGORIES, MILEAGE_METHODS


class ExpenseVendorResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class ExpenseVendorListResponse(BaseModel):
    items: List[ExpenseVendorResponse]


class ExpenseCategoryItem(BaseModel):
    slug: str
    label: str


class ExpenseCategoriesResponse(BaseModel):
    items: List[ExpenseCategoryItem]


class WorkOrderExpenseCreate(BaseModel):
    category: str
    amount: Decimal = Field(..., gt=0)
    vendor_id: Optional[UUID] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[date] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        slug = (v or "").strip().lower()
        if slug not in EXPENSE_CATEGORIES:
            raise ValueError(f"Invalid category. Must be one of: {', '.join(EXPENSE_CATEGORIES)}")
        return slug


class WorkOrderExpenseUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    vendor_id: Optional[UUID] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[date] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        slug = v.strip().lower()
        if slug not in EXPENSE_CATEGORIES:
            raise ValueError(f"Invalid category. Must be one of: {', '.join(EXPENSE_CATEGORIES)}")
        return slug


class WorkOrderExpenseResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    category: str
    amount: Decimal
    vendor_id: Optional[UUID] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    expense_date: date
    created_at: datetime
    vendor: Optional[ExpenseVendorResponse] = None

    class Config:
        from_attributes = True


class WorkOrderExpenseListResponse(BaseModel):
    items: List[WorkOrderExpenseResponse]
    total: Decimal


class ExpenseReceiptResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    expense_id: Optional[UUID] = None
    filename: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    storage_backend: str
    drive_web_view_link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseReceiptListResponse(BaseModel):
    items: List[ExpenseReceiptResponse]


class AppointmentMileageUpsert(BaseModel):
    method: str = "estimated"
    miles: Decimal = Field(..., ge=0)
    odometer_start: Optional[Decimal] = None
    odometer_end: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        slug = (v or "estimated").strip().lower()
        if slug not in MILEAGE_METHODS:
            raise ValueError(f"Invalid method. Must be one of: {', '.join(MILEAGE_METHODS)}")
        return slug


class AppointmentMileageResponse(BaseModel):
    id: UUID
    appointment_id: UUID
    work_order_id: UUID
    method: str
    miles: Decimal
    odometer_start: Optional[Decimal] = None
    odometer_end: Optional[Decimal] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobEconomicsLineItem(BaseModel):
    label: str
    amount: Decimal


class JobEconomicsResponse(BaseModel):
    work_order_id: UUID
    order_number: Optional[str] = None
    customer_paid: Decimal
    parts_cost: Decimal
    other_expenses: Decimal
    mileage_miles: Decimal
    mileage_cost: Decimal
    mileage_rate: Decimal
    estimated_net: Decimal
    line_items: List[JobEconomicsLineItem]
    disclaimer: str = "Operational estimate only — not tax advice."


class MonthlyEconomicsReportResponse(BaseModel):
    period_start: date
    period_end: date
    revenue_collected: Decimal
    parts_cost: Decimal
    other_expenses: Decimal
    mileage_miles: Decimal
    mileage_cost: Decimal
    estimated_net: Decimal
    expenses_by_category: List[JobEconomicsLineItem]
    top_vendors: List[JobEconomicsLineItem]


class PropertyServiceHistoryItem(BaseModel):
    work_order_id: UUID
    order_number: Optional[str] = None
    completed_at: Optional[datetime] = None
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_subtype: Optional[str] = None
    description: Optional[str] = None
    resolution_summary: Optional[str] = None
    amount_collected: Optional[Decimal] = None
    status: Optional[str] = None


class PropertyServiceHistoryResponse(BaseModel):
    property_id: UUID
    address: Optional[str] = None
    items: List[PropertyServiceHistoryItem]
