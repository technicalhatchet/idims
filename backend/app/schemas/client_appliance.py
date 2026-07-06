from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class ClientApplianceBase(BaseModel):
    property_id: Optional[UUID] = None
    nickname: Optional[str] = None
    equipment_type: str
    equipment_subtype: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    equipment_version: Optional[str] = None
    is_wall_mounted: bool = False
    notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None


class ClientApplianceCreate(ClientApplianceBase):
    pass


class ClientApplianceUpdate(BaseModel):
    property_id: Optional[UUID] = None
    nickname: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    equipment_version: Optional[str] = None
    is_wall_mounted: Optional[bool] = None
    notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ClientApplianceResponse(ClientApplianceBase):
    id: UUID
    client_id: UUID
    source: str
    is_active: bool
    merged_into_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ImportCandidateProperty(BaseModel):
    id: Optional[str] = None
    address: Optional[str] = None
    unit_number: Optional[str] = None


class ImportCandidateResponse(BaseModel):
    candidate_id: str
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    equipment_version: Optional[str] = None
    is_wall_mounted: bool = False
    property: Optional[ImportCandidateProperty] = None
    work_order_ids: List[str] = Field(default_factory=list)
    service_count: int = 0
    last_service_date: Optional[str] = None
    merge_group_hint: Optional[str] = None


class ImportConfirmItem(BaseModel):
    candidate_id: Optional[str] = None
    property_id: Optional[UUID] = None
    nickname: Optional[str] = None
    equipment_type: str
    equipment_subtype: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    equipment_version: Optional[str] = None
    is_wall_mounted: bool = False
    notes: Optional[str] = None
    work_order_ids: List[str] = Field(default_factory=list)


class ImportConfirmRequest(BaseModel):
    appliances: List[ImportConfirmItem]


class MergeAppliancesRequest(BaseModel):
    keep_id: UUID
    merge_ids: List[UUID] = Field(..., min_length=1)
