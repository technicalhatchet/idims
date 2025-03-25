from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from app.models.audit import AuditAction, AuditEntityType

class AuditLogBase(BaseModel):
    entity_type: AuditEntityType
    entity_id: uuid.UUID
    action: AuditAction
    changes: Optional[Dict[str, Any]] = None
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    performed_by: uuid.UUID

class AuditLogResponse(AuditLogBase):
    id: uuid.UUID
    performed_by: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogListResponse(BaseModel):
    total: int
    audit_logs: list[AuditLogResponse]
    page: int
    pages: int

class AuditLogFilter(BaseModel):
    entity_type: Optional[AuditEntityType] = None
    entity_id: Optional[uuid.UUID] = None
    action: Optional[AuditAction] = None
    performed_by: Optional[uuid.UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None 