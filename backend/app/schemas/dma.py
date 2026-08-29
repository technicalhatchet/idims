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
    category: Optional[str] = None

    class Config:
        from_attributes = True


class DmaTagsResponse(BaseModel):
    items: List[DmaTagResponse]


class DmaOutcomeStatusResponse(BaseModel):
    has_outcome: bool


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
    outcome_confidence: Optional[str] = None
    callback_required: bool = False
    technician_summary: Optional[str] = None
    performed_on: Optional[date] = None
    title: Optional[str] = None
    equipment_serial: Optional[str] = None
    context: Optional[str] = None
    visibility: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    @field_validator("context")
    @classmethod
    def validate_context(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_CONTEXTS
        if v not in DMA_CONTEXTS:
            raise ValueError(f"context must be one of {sorted(DMA_CONTEXTS)}")
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_VISIBILITIES
        if v not in DMA_VISIBILITIES:
            raise ValueError(f"visibility must be one of {sorted(DMA_VISIBILITIES)}")
        return v

    @field_validator("outcome_confidence")
    @classmethod
    def validate_outcome_confidence(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import OUTCOME_CONFIDENCE_VALUES
        if v not in OUTCOME_CONFIDENCE_VALUES:
            raise ValueError(
                f"outcome_confidence must be one of {sorted(OUTCOME_CONFIDENCE_VALUES)}"
            )
        return v

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
    outcome_confidence: Optional[str] = None
    callback_required: Optional[bool] = None
    technician_summary: Optional[str] = None
    performed_on: Optional[date] = None
    title: Optional[str] = None
    equipment_serial: Optional[str] = None
    context: Optional[str] = None
    visibility: Optional[str] = None
    moderation_status: Optional[str] = None
    tags: Optional[List[str]] = None

    @field_validator("outcome_confidence")
    @classmethod
    def validate_outcome_confidence(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import OUTCOME_CONFIDENCE_VALUES
        if v not in OUTCOME_CONFIDENCE_VALUES:
            raise ValueError(
                f"outcome_confidence must be one of {sorted(OUTCOME_CONFIDENCE_VALUES)}"
            )
        return v

    @field_validator("context")
    @classmethod
    def validate_context(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_CONTEXTS
        if v not in DMA_CONTEXTS:
            raise ValueError(f"context must be one of {sorted(DMA_CONTEXTS)}")
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_VISIBILITIES
        if v not in DMA_VISIBILITIES:
            raise ValueError(f"visibility must be one of {sorted(DMA_VISIBILITIES)}")
        return v

    @field_validator("moderation_status")
    @classmethod
    def validate_moderation_status(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_MODERATION_STATUSES
        if v not in DMA_MODERATION_STATUSES:
            raise ValueError(f"moderation_status must be one of {sorted(DMA_MODERATION_STATUSES)}")
        return v

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
    outcome_confidence: Optional[str] = None
    callback_required: bool = False
    technician_summary: Optional[str] = None
    performed_on: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    title: Optional[str] = None
    equipment_serial: Optional[str] = None
    context: str = "tech"
    visibility: str = "private"
    moderation_status: str = "approved"
    imported_work_order_id: Optional[UUID] = None
    tags: List[DmaTagResponse] = Field(default_factory=list)
    linked_diagnostic_count: int = 0

    class Config:
        from_attributes = True


class DmaStandaloneDiagnosticCreate(BaseModel):
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    equipment_serial: Optional[str] = None
    customer_complaint: Optional[str] = None
    payload: dict
    outcome_id: Optional[UUID] = None
    context: Optional[str] = None
    visibility: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_DIAGNOSTIC_STATUSES
        if v not in DMA_DIAGNOSTIC_STATUSES:
            raise ValueError("status must be in_progress, completed, or abandoned")
        return v

    @field_validator("payload")
    @classmethod
    def validate_payload(cls, v):
        if not isinstance(v, dict) or not v.get("templateId"):
            raise ValueError("payload must include templateId")
        return v

    @field_validator("context")
    @classmethod
    def validate_context(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_CONTEXTS
        if v not in DMA_CONTEXTS:
            raise ValueError(f"context must be one of {sorted(DMA_CONTEXTS)}")
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_VISIBILITIES
        if v not in DMA_VISIBILITIES:
            raise ValueError(f"visibility must be one of {sorted(DMA_VISIBILITIES)}")
        return v


class DmaStandaloneDiagnosticUpdate(BaseModel):
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    equipment_serial: Optional[str] = None
    customer_complaint: Optional[str] = None
    payload: Optional[dict] = None
    outcome_id: Optional[UUID] = None
    visibility: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_DIAGNOSTIC_STATUSES
        if v not in DMA_DIAGNOSTIC_STATUSES:
            raise ValueError("status must be in_progress, completed, or abandoned")
        return v

    @field_validator("payload")
    @classmethod
    def validate_payload(cls, v):
        if v is None:
            return v
        if not isinstance(v, dict) or not v.get("templateId"):
            raise ValueError("payload must include templateId")
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_VISIBILITIES
        if v not in DMA_VISIBILITIES:
            raise ValueError(f"visibility must be one of {sorted(DMA_VISIBILITIES)}")
        return v


class DmaOutcomeSummary(BaseModel):
    repair_successful: bool
    moderation_status: str
    visibility: str


class DmaStandaloneDiagnosticResponse(BaseModel):
    id: UUID
    outcome_id: Optional[UUID] = None
    outcome_summary: Optional[DmaOutcomeSummary] = None
    equipment_make: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    equipment_serial: Optional[str] = None
    customer_complaint: Optional[str] = None
    payload: dict
    context: str
    visibility: str
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    imported_work_order_id: Optional[UUID] = None
    status: str = "in_progress"
    template_id: Optional[str] = None
    template_label: Optional[str] = None

    class Config:
        from_attributes = True


class DmaStandaloneDiagnosticListResponse(BaseModel):
    items: List[DmaStandaloneDiagnosticResponse]
    total: int
    page: int
    pages: int


class DmaRepairRecordModerateRequest(BaseModel):
    moderation_status: Literal["approved", "rejected"]
    visibility: Optional[str] = None

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v):
        if v is None:
            return v
        from app.constants.dma_standalone import DMA_VISIBILITIES
        if v not in DMA_VISIBILITIES:
            raise ValueError(f"visibility must be one of {sorted(DMA_VISIBILITIES)}")
        return v


class DmaImportToWorkOrderResponse(BaseModel):
    record_id: UUID
    work_order_id: UUID
    imported_work_order_id: UUID
    status: Literal["imported"] = "imported"
    diagnostic_note_id: Optional[UUID] = None
    repair_outcome_note_id: Optional[UUID] = None
    imported_diagnostic_note_ids: List[UUID] = []
    message: str = "Imported to work order notes"


class DmaRepairRecordListResponse(BaseModel):
    items: List[DmaRepairRecordResponse]
    total: int
    page: int
    pages: int


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
    repair_memory_match: Optional[str] = None
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


class DmaEvidenceNudge(BaseModel):
    tag: str
    label: str
    case_count: int


class DmaEvidenceNudgesResponse(BaseModel):
    equipment_subtype: Optional[str] = None
    nudges: List[DmaEvidenceNudge] = Field(default_factory=list)


class DmaPatternFixCount(BaseModel):
    label: str
    count: int


class DmaPatternBucket(BaseModel):
    total_cases: int
    successful_repairs: int
    success_rate_pct: float
    callback_cases: int
    callback_rate_pct: float
    top_fixes: List[DmaPatternFixCount] = Field(default_factory=list)


class DmaPatternCodeRow(DmaPatternBucket):
    code: str
    label: str


class DmaPatternTagRow(DmaPatternBucket):
    tag: str
    label: str


class DmaPatternEvidencePathRow(DmaPatternBucket):
    leading_category_id: str
    leading_category_label: str
    problem_code: str
    problem_label: str


class DmaPatternReportFilters(BaseModel):
    equipment_make: Optional[str] = None
    equipment_subtype: Optional[str] = None
    problem_code: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    min_cases: int = 2


class DmaPatternReportSummary(DmaPatternBucket):
    work_order_cases: int = 0
    field_record_cases: int = 0
    cases_with_evidence_snapshot: int = 0


class DmaPatternReportResponse(BaseModel):
    filters: DmaPatternReportFilters
    summary: DmaPatternReportSummary
    by_problem_code: List[DmaPatternCodeRow] = Field(default_factory=list)
    by_resolution_code: List[DmaPatternCodeRow] = Field(default_factory=list)
    by_tag: List[DmaPatternTagRow] = Field(default_factory=list)
    common_fixes: List[DmaPatternFixCount] = Field(default_factory=list)
    evidence_paths: List[DmaPatternEvidencePathRow] = Field(default_factory=list)


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
