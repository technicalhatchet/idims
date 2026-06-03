from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

BLOCK_TYPES = ("lunch", "meeting", "shop", "pto", "other")


class CalendarBlockBase(BaseModel):
    technician_id: UUID
    block_type: str = "other"
    title: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = None
    start_at: datetime
    end_at: datetime

    @validator("block_type")
    def validate_block_type(cls, v):
        if v not in BLOCK_TYPES:
            raise ValueError(f"block_type must be one of {BLOCK_TYPES}")
        return v

    @validator("end_at")
    def validate_end_after_start(cls, v, values):
        if "start_at" in values and v <= values["start_at"]:
            raise ValueError("end_at must be after start_at")
        return v


class CalendarBlockCreate(CalendarBlockBase):
    pass


class CalendarBlockUpdate(BaseModel):
    block_type: Optional[str] = None
    title: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    status: Optional[str] = None

    @validator("block_type")
    def validate_block_type(cls, v):
        if v is not None and v not in BLOCK_TYPES:
            raise ValueError(f"block_type must be one of {BLOCK_TYPES}")
        return v

    @validator("status")
    def validate_status(cls, v):
        if v is not None and v not in ("active", "canceled"):
            raise ValueError("status must be active or canceled")
        return v


class CalendarBlockResponse(BaseModel):
    id: str
    technician_id: str
    technician_name: Optional[str] = None
    block_type: str
    title: Optional[str] = None
    notes: Optional[str] = None
    start_at: str
    end_at: str
    status: str
    source: str = "calendar_block"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class CalendarBlockListResponse(BaseModel):
    items: List[CalendarBlockResponse]
    date_range: dict
