from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base_class import Base

class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    STATUS_CHANGE = "status_change"
    SEND = "send"
    CONVERT = "convert"

class AuditEntityType(str, enum.Enum):
    QUOTE = "quote"
    INVOICE = "invoice"
    WORK_ORDER = "work_order"
    CLIENT = "client"
    USER = "user"
    OTHER = "other"

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(Enum(AuditEntityType), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(Enum(AuditAction), nullable=False)
    changes = Column(JSON, nullable=True)  # Store the changes made
    previous_state = Column(JSON, nullable=True)  # Store the previous state
    new_state = Column(JSON, nullable=True)  # Store the new state
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    # Indexes
    __table_args__ = (
        Index('idx_audit_logs_entity', 'entity_type', 'entity_id'),
    )