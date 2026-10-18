"""Portal property create/update payloads (allowlisted fields only)."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PortalPropertyWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: str = Field(..., min_length=1)
    nickname: Optional[str] = None
    unit_number: Optional[str] = None
    property_type: Optional[Literal["residential", "rental", "commercial"]] = "residential"
    gate_code: Optional[str] = None
    access_instructions: Optional[str] = None
    tenant_name: Optional[str] = None
    tenant_phone: Optional[str] = None
    tenant_email: Optional[str] = None


class PortalPropertyUpdate(PortalPropertyWrite):
    address: Optional[str] = None
