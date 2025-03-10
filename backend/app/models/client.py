from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, DateTime, Text, Enum, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class Client(Base):
    """Client model for storing client information"""
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    company_name = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    address = Column(JSONB, nullable=True)
    billing_address = Column(JSONB, nullable=True)
    shipping_address = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Enum("active", "inactive", "lead", name="client_status_enum"), default="active")
    source = Column(String(50), nullable=True)
    tags = Column(JSONB, nullable=True, default=list)
    custom_fields = Column(JSONB, nullable=True, default=dict)
    tax_id = Column(String(50), nullable=True)
    payment_terms = Column(Integer, default=30)
    credit_limit = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="client")
    creator = relationship("User", foreign_keys=[created_by])
    work_orders = relationship("WorkOrder", back_populates="client", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="client")
    
    def __repr__(self):
        return f"<Client {self.id}: {self.company_name or f'{self.first_name} {self.last_name}'}>"
    
    @property
    def full_name(self):
        """Get client's full name"""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def display_name(self):
        """Get the display name (company name or full name)"""
        return self.company_name or self.full_name
