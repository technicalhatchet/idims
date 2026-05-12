from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import datetime

class PropertyBase(BaseModel):
    address: str
    unit_number: Optional[str] = None
    property_type: Optional[str] = None
    notes: Optional[str] = None
    gate_code: Optional[str] = None
    access_instructions: Optional[str] = None

class PropertyCreate(PropertyBase):
    client_id: UUID4

class PropertyUpdate(BaseModel):
    address: Optional[str] = None
    unit_number: Optional[str] = None
    property_type: Optional[str] = None
    notes: Optional[str] = None
    gate_code: Optional[str] = None
    access_instructions: Optional[str] = None

class PropertyResponse(PropertyBase):
    id: UUID4
    client_id: UUID4
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True