from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DiagnosticComponentState(BaseModel):
    label: str
    state: str


class DiagnosticConfidenceFacts(BaseModel):
    tier: Optional[str] = None
    percent: Optional[int] = None
    explanation: Optional[str] = None


class GenerateDiagnosticNotesRequest(BaseModel):
    """Structured diagnostic facts — no customer PII."""

    template_label: str = Field(..., alias="templateLabel")
    equipment_subtype: Optional[str] = Field(None, alias="equipmentSubtype")
    complaint_chips: List[str] = Field(default_factory=list, alias="complaintChips")
    complaint_text: Optional[str] = Field(None, alias="complaintText")
    measurements: List[str] = Field(default_factory=list)
    observations: List[str] = Field(default_factory=list)
    component_states: List[DiagnosticComponentState] = Field(
        default_factory=list, alias="componentStates"
    )
    evidence_lines: List[str] = Field(default_factory=list, alias="evidenceLines")
    confidence: Optional[DiagnosticConfidenceFacts] = None
    deterministic_bullets: List[str] = Field(
        default_factory=list, alias="deterministicBullets"
    )

    class Config:
        populate_by_name = True


class GenerateDiagnosticNotesResponse(BaseModel):
    root_cause_summary: str = Field(..., alias="rootCauseSummary")
    technician_note: str = Field(..., alias="technicianNote")
    customer_explanation: str = Field(..., alias="customerExplanation")
    source: str = "gemini"
    model: Optional[str] = None
    fallback_reason: Optional[str] = Field(None, alias="fallbackReason")

    class Config:
        populate_by_name = True
