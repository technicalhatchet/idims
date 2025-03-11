from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Float, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class Service(Base):
    """Service model for storing available services"""
    __tablename__ = "services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    base_price = Column(Float, nullable=False, default=0.0)
    duration = Column(Integer, nullable=True)  # Expected duration in minutes
    is_active = Column(Boolean, default=True)
    requires_parts = Column(Boolean, default=False)
    requires_technician = Column(Boolean, default=True)
    meta_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<Service {self.id}: {self.name} (${self.base_price})>"

class ServiceCategory(Base):
    """Service category model for organizing services"""
    __tablename__ = "service_categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("service_categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Self-referential relationship for hierarchical categories
    parent = relationship("ServiceCategory", remote_side=[id], backref="subcategories")
    
    def __repr__(self):
        return f"<ServiceCategory {self.id}: {self.name}>"