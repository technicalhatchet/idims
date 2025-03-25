from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, JSON, Text
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum

class AuditAction(str, enum.Enum):
    """Audit log action types"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    UPLOAD = "upload"
    DOWNLOAD = "download"
    APPROVE = "approve"
    REJECT = "reject"
    ASSIGN = "assign"
    UNASSIGN = "unassign"
    STATUS_CHANGE = "status_change"
    PERMISSION_CHANGE = "permission_change"
    OTHER = "other"

class AuditEntity(str, enum.Enum):
    """Audit log entity types"""
    USER = "user"
    CLIENT = "client"
    WORK_ORDER = "work_order"
    INVOICE = "invoice"
    DOCUMENT = "document"
    NOTIFICATION = "notification"
    SYSTEM = "system"
    OTHER = "other"

class AuditLog(Base):
    """Audit log model for tracking user actions"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(AuditAction), nullable=False)
    entity_type = Column(Enum(AuditEntity), nullable=False)
    entity_id = Column(String(255), nullable=True)  # ID of the affected entity
    details = Column(Text, nullable=True)  # Detailed description of the action
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6 address
    user_agent = Column(String(255), nullable=True)  # Browser/device information
    audit_metadata = Column(JSON, nullable=True)  # Additional context data
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs", lazy="joined")

    def to_dict(self) -> dict:
        """Convert audit log to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "audit_metadata": self.audit_metadata or {},
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def log_action(cls, db, user_id: int, action: AuditAction, entity_type: AuditEntity, 
                  entity_id: Optional[str] = None, details: Optional[str] = None,
                  ip_address: Optional[str] = None, user_agent: Optional[str] = None,
                  audit_metadata: Optional[dict] = None) -> 'AuditLog':
        """Helper method to create an audit log entry"""
        audit_log = cls(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            audit_metadata=audit_metadata
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log 