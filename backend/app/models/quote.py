from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Float, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid

from app.db.database import Base

class Quote(Base):
    """Quote model for storing service quotes/estimates"""
    __tablename__ = "quotes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="draft")  # draft, sent, accepted, rejected, expired
    subtotal = Column(Float, nullable=False, default=0)
    tax = Column(Float, nullable=False, default=0)
    discount = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    valid_until = Column(DateTime, nullable=True)
    terms = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    meta_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    client = relationship("Client")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="quote")
    
    def __repr__(self):
        return f"<Quote {self.quote_number}: ${self.total:.2f}>"
    
    @property
    def is_expired(self):
        """Check if quote is expired"""
        if self.valid_until:
            return datetime.utcnow() > self.valid_until
        return False


class QuoteItem(Base):
    """Quote item model for storing line items in a quote"""
    __tablename__ = "quote_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    tax_rate = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=True)
    meta_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    quote = relationship("Quote", back_populates="items")
    service = relationship("Service", foreign_keys=[service_id])
    
    def __repr__(self):
        return f"<QuoteItem {self.id}: {self.description}, ${self.total:.2f}>"
    
    def calculate_total(self):
        """Calculate the total price for this line item"""
        subtotal = self.quantity * self.unit_price
        discount_amount = subtotal * (self.discount / 100) if self.discount else 0
        tax_amount = (subtotal - discount_amount) * (self.tax_rate / 100) if self.tax_rate else 0
        self.total = subtotal - discount_amount + tax_amount
        return self.total