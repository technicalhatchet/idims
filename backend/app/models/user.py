from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from typing import Optional, List

from app.db.database import Base

class User(Base):
    """User model with enhanced Auth0 integration"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    roles = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    avatar_url = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    preferences = Column(JSON, nullable=True, default=dict)
    permissions = Column(JSON, nullable=True, default=list)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    client = relationship("Client", back_populates="user", uselist=False, foreign_keys="[Client.user_id]")
    technician = relationship("Technician", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    documents = relationship("Document", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

    @property
    def full_name(self) -> str:
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}"

    @property
    def is_admin(self) -> bool:
        """Check if user has admin role"""
        return "admin" in (self.roles or [])

    @property
    def is_manager(self) -> bool:
        """Check if user has manager role"""
        return "manager" in (self.roles or [])

    @property
    def is_technician(self) -> bool:
        """Check if user has technician role"""
        return "technician" in (self.roles or [])

    @property
    def is_client(self) -> bool:
        """Check if user has client role"""
        return "client" in (self.roles or [])

    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        return permission in (self.permissions or [])

    def has_permissions(self, required_permissions: list) -> bool:
        """Check if user has all required permissions"""
        user_permissions = set(self.permissions or [])
        return all(perm in user_permissions for perm in required_permissions)

    def to_dict(self) -> dict:
        """Convert user to dictionary"""
        return {
            "id": str(self.id),
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "phone": self.phone,
            "roles": self.roles,
            "is_active": self.is_active,
            "email_verified": self.email_verified,
            "avatar_url": self.avatar_url,
            "company": self.company,
            "preferences": self.preferences,
            "permissions": self.permissions,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    def __repr__(self):
        return f"<User {self.email}>"
