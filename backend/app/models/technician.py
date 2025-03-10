from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Enum, Integer, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class Technician(Base):
    """Technician model for storing information about service technicians"""
    __tablename__ = "technicians"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    employee_id = Column(String(50), nullable=True, unique=True)
    skills = Column(ARRAY(String), nullable=True)
    certifications = Column(JSONB, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    availability = Column(JSONB, nullable=True, default=dict)  # Store weekly availability
    max_daily_jobs = Column(Integer, nullable=True, default=8)
    notes = Column(Text, nullable=True)
    status = Column(Enum("active", "inactive", "on_leave", name="technician_status_enum"), default="active")
    service_radius = Column(Float, nullable=True)  # Miles or KM
    location = Column(JSONB, nullable=True)  # Store lat/long
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="technician")
    work_orders = relationship("WorkOrder", back_populates="technician", foreign_keys="[WorkOrder.assigned_technician_id]")
    
    def __repr__(self):
        return f"<Technician {self.id}: {self.user.full_name if self.user else 'Unknown'}>"
    
    @property
    def name(self):
        """Get technician name"""
        if self.user:
            return self.user.full_name
        return "Unknown Technician"
    
    @property
    def email(self):
        """Get technician email"""
        if self.user:
            return self.user.email
        return None
    
    @property
    def phone(self):
        """Get technician phone"""
        if self.user:
            return self.user.phone
        return None
    
    @property
    def is_available(self):
        """Check if technician is generally available"""
        return self.status == "active"
