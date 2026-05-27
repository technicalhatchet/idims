from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


class DmaCodesResponse(BaseModel):
    problem_codes: dict[str, str]
    resolution_codes: dict[str, str]


class DmaRepairOutcomeResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    source_note_id: Optional[UUID] = None
    customer_complaint: Optional[str] = None
    problem_code: Optional[str] = None
    resolution_code: Optional[str] = None
    confirmed_fix: str
    error_code_text: Optional[str] = None
    replaced_parts: Optional[str] = None
    repair_successful: bool = True
    callback_required: bool = False
    technician_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    order_number: Optional[str] = None
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    equipment_serial: Optional[str] = None
    symptoms: Optional[Any] = None
    work_order_description: Optional[str] = None

    class Config:
        from_attributes = True


class DmaSearchResponse(BaseModel):
    items: List[DmaRepairOutcomeResponse]
    total: int
    page: int
    pages: int
