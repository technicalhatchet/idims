from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Any, Literal
from datetime import datetime, date
from uuid import UUID

from app.constants.dma_codes import DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES


class DmaCodesResponse(BaseModel):
    problem_codes: dict[str, str]
    resolution_codes: dict[str, str]


class DmaTagResponse(BaseModel):
    id: UUID
    slug: str
    label: str


class DmaTagsResponse(BaseModel):
    items: List[DmaTagResponse]


class DmaRepairRecordCreate(BaseModel):
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    customer_complaint: Optional[str] = None
    problem_code: Optional[str] = None
    resolution_code: Optional[str] = None
    confirmed_fix: str = Field(..., min_length=1)
    error_code_text: Optional[str] = None
    replaced_parts: Optional[str] = None
    repair_successful: bool = True
    callback_required: bool = False
    technician_summary: Optional[str] = None
    performed_on: Optional[date] = None
    tags: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_equipment_hint(self):
        make = (self.equipment_make or "").strip()
        subtype = (self.equipment_subtype or "").strip()
        if not make and not subtype:
            raise ValueError("Provide at least equipment make or appliance type")
        return self

    @field_validator("problem_code")
    @classmethod
    def validate_problem_code(cls, v):
        if v and v not in DMA_PROBLEM_CODES:
            raise ValueError(f"problem_code must be one of {list(DMA_PROBLEM_CODES.keys())}")
        return v

    @field_validator("resolution_code")
    @classmethod
    def validate_resolution_code(cls, v):
        if v and v not in DMA_RESOLUTION_CODES:
            raise ValueError(f"resolution_code must be one of {list(DMA_RESOLUTION_CODES.keys())}")
        return v


class DmaRepairRecordUpdate(BaseModel):
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    customer_complaint: Optional[str] = None
    problem_code: Optional[str] = None
    resolution_code: Optional[str] = None
    confirmed_fix: Optional[str] = None
    error_code_text: Optional[str] = None
    replaced_parts: Optional[str] = None
    repair_successful: Optional[bool] = None
    callback_required: Optional[bool] = None
    technician_summary: Optional[str] = None
    performed_on: Optional[date] = None
    tags: Optional[List[str]] = None

    @field_validator("problem_code")
    @classmethod
    def validate_problem_code(cls, v):
        if v and v not in DMA_PROBLEM_CODES:
            raise ValueError(f"problem_code must be one of {list(DMA_PROBLEM_CODES.keys())}")
        return v

    @field_validator("resolution_code")
    @classmethod
    def validate_resolution_code(cls, v):
        if v and v not in DMA_RESOLUTION_CODES:
            raise ValueError(f"resolution_code must be one of {list(DMA_RESOLUTION_CODES.keys())}")
        return v


class DmaRepairRecordResponse(BaseModel):
    id: UUID
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    customer_complaint: Optional[str] = None
    problem_code: Optional[str] = None
    resolution_code: Optional[str] = None
    confirmed_fix: str
    error_code_text: Optional[str] = None
    replaced_parts: Optional[str] = None
    repair_successful: bool = True
    callback_required: bool = False
    technician_summary: Optional[str] = None
    performed_on: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    tags: List[DmaTagResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class DmaRepairOutcomeResponse(BaseModel):
    id: UUID
    source_type: Literal["work_order", "field_record"] = "work_order"
    work_order_id: Optional[UUID] = None
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
    performed_on: Optional[date] = None
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
    tags: List[DmaTagResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class DmaSearchResponse(BaseModel):
    items: List[DmaRepairOutcomeResponse]
    total: int
    page: int
    pages: int


class DmaSuggestionFix(BaseModel):
    label: str
    count: int


class DmaSuggestionSearchParams(BaseModel):
    equipment_make: Optional[str] = None
    equipment_subtype: Optional[str] = None
    error_code: Optional[str] = None


class DmaErrorCodeReferenceSummary(BaseModel):
    id: UUID
    manufacturer: str
    equipment_subtype: str
    code: str
    code_normalized: str
    meaning: str
    alias_group_id: UUID

    class Config:
        from_attributes = True


class DmaSuggestionsResponse(BaseModel):
    total_count: int
    common_fixes: List[DmaSuggestionFix]
    detected_error_codes: List[str] = Field(default_factory=list)
    search_params: DmaSuggestionSearchParams
    error_code_references: List[DmaErrorCodeReferenceSummary] = Field(default_factory=list)


class DmaErrorCodeReferenceResponse(BaseModel):
    id: UUID
    manufacturer: str
    equipment_subtype: str
    code: str
    code_normalized: str
    meaning: str
    common_causes: Optional[str] = None
    recommended_fix: Optional[str] = None
    alias_group_id: UUID
    related_codes: List[DmaErrorCodeReferenceSummary] = Field(default_factory=list)

    class Config:
        from_attributes = True


class DmaErrorCodeSearchResponse(BaseModel):
    items: List[DmaErrorCodeReferenceSummary]
    total: int
    page: int
    pages: int
