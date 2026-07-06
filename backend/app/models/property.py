from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base

class Property(Base):
    __tablename__ = "properties"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey('clients.id', ondelete='CASCADE'), nullable=False)
    address = Column(Text, nullable=False)
    unit_number = Column(String(50), nullable=True)
    property_type = Column(String(50), nullable=True)  # residential, commercial, rental, flip
    notes = Column(Text, nullable=True)
    gate_code = Column(String(50), nullable=True)
    access_instructions = Column(Text, nullable=True)
    tenant_name = Column(String(255), nullable=True)
    tenant_phone = Column(String(50), nullable=True)
    tenant_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    client = relationship("Client", back_populates="properties")
    work_orders = relationship("WorkOrder", back_populates="property_ref")
    appliances = relationship("ClientAppliance", back_populates="property_ref")