from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, Text, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class User(Base):
    """User model for authentication and user management"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id = Column(String(255), unique=True, nullable=True, index=True)  # External auth provider ID
    email = Column(String(255), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for social auth
    role = Column(Enum("admin", "manager", "technician", "client", name="user_role_enum"), default="client")
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    last_login = Column(DateTime, nullable=True)
    preferences = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    client = relationship("Client", foreign_keys="[Client.user_id]", back_populates="user", uselist=False)
    technician = relationship("Technician", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.id}: {self.email}>"
    
    @property
    def full_name(self):
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def is_admin(self):
        """Check if the user is an admin"""
        return self.role == "admin"
    
    @property
    def is_manager(self):
        """Check if the user is a manager"""
        return self.role == "manager"
    
    @property
    def is_technician(self):
        """Check if the user is a technician"""
        return self.role == "technician"
    
    @property
    def is_client(self):
        """Check if the user is a client"""
        return self.role == "client"
