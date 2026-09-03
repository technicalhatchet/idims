from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

LogitType = Literal["problem", "idea", "blocker", "positive"]
LogitCategory = Literal[
    "scheduling",
    "job_details",
    "diagnostics",
    "parts",
    "documentation",
    "photos",
    "customer",
    "performance",
    "ui_ux",
    "other",
]
LogitSeverity = Literal["minor", "moderate", "major", "critical", "not_applicable"]
LogitFrequency = Literal["once", "occasional", "frequent", "every_time", "unknown", "not_applicable"]
LogitStatus = Literal["draft", "logged"]


class LogitClassification(BaseModel):
    type: LogitType
    category: LogitCategory
    severity: LogitSeverity
    frequency: LogitFrequency
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1, max_length=4000)
    impact: str = Field(min_length=1, max_length=2000)
    suggested_fix: str = Field(max_length=2000, default="")
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("title", "description", "impact", "suggested_fix")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return (value or "").strip()


class LogitClassifyRequest(BaseModel):
    project_id: UUID
    transcript: str = Field(min_length=1, max_length=8000)
    observation_type: LogitType


class LogitClassifyResponse(BaseModel):
    classification: LogitClassification
    model: Optional[str] = None
    source: str = "gemini"


class LogitProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    context: str = Field(default="", max_length=4000)
    icon: str = Field(default="📝", max_length=16)


class LogitProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    context: Optional[str] = Field(default=None, max_length=4000)
    icon: Optional[str] = Field(default=None, max_length=16)


class LogitProjectResponse(BaseModel):
    id: UUID
    name: str
    context: Optional[str] = None
    icon: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    entry_count: int = 0
    unreviewed_count: int = 0

    model_config = {"from_attributes": True}


class LogitEntryCreate(BaseModel):
    project_id: UUID
    original_transcript: str = Field(min_length=1, max_length=8000)
    status: LogitStatus = "logged"
    type: Optional[LogitType] = None
    category: Optional[LogitCategory] = None
    severity: Optional[LogitSeverity] = None
    frequency: Optional[LogitFrequency] = None
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=4000)
    impact: Optional[str] = Field(default=None, max_length=2000)
    suggested_fix: Optional[str] = Field(default=None, max_length=2000)
    ai_title: Optional[str] = Field(default=None, max_length=300)
    ai_description: Optional[str] = Field(default=None, max_length=4000)
    ai_impact: Optional[str] = Field(default=None, max_length=2000)
    ai_suggested_fix: Optional[str] = Field(default=None, max_length=2000)
    ai_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    ai_model: Optional[str] = Field(default=None, max_length=120)


class LogitEntryUpdate(BaseModel):
    status: Optional[LogitStatus] = None
    type: Optional[LogitType] = None
    category: Optional[LogitCategory] = None
    severity: Optional[LogitSeverity] = None
    frequency: Optional[LogitFrequency] = None
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=4000)
    impact: Optional[str] = Field(default=None, max_length=2000)
    suggested_fix: Optional[str] = Field(default=None, max_length=2000)


class LogitEntryResponse(BaseModel):
    id: UUID
    project_id: UUID
    created_at: datetime
    type: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    frequency: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    impact: Optional[str] = None
    suggested_fix: Optional[str] = None
    original_transcript: str
    ai_title: Optional[str] = None
    ai_description: Optional[str] = None
    ai_impact: Optional[str] = None
    ai_suggested_fix: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_model: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}
