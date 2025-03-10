from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, DateTime, Float, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid

from app.db.database import Base

class Invoice(Base):
    """Invoice model for storing invoice information"""
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=True)
    status = Column(Enum("draft", "sent", "paid", "partially_paid", "overdue", "cancelled", 
                         name="invoice_status_enum"), default="draft")
    issue_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    due_date = Column(DateTime, nullable=False)
    subtotal = Column(Float, nullable=False, default=0)
    tax = Column(Float, nullable=False, default=0)
    discount = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    amount_paid = Column(Float, nullable=False, default=0)
    balance = Column(Float, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    metadata = Column(JSONB, nullable=True)
    payment_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    client = relationship("Client", back_populates="invoices")
    work_order = relationship("WorkOrder", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self):
        return f"<Invoice {self.invoice_number}: ${self.total:.2f}>"
    
    @property
    def is_paid(self):
        """Check if invoice is fully paid"""
        return self.amount_paid >= self.total
    
    @property
    def is_overdue(self):
        """Check if invoice is overdue"""
        return self.due_date < datetime.utcnow() and not self.is_paid
    
    def update_balance(self):
        """Update the invoice balance"""
        self.balance = self.total - self.amount_paid
        if self.balance <= 0:
            self.status = "paid"
        elif self.amount_paid > 0:
            self.status = "partially_paid"
        elif self.due_date < datetime.utcnow():
            self.status = "overdue"


class InvoiceItem(Base):
    """Invoice item model for storing line items"""
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0)
    tax_rate = Column(Float, nullable=False, default=0)
    discount = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    work_order_service_id = Column(UUID(as_uuid=True), ForeignKey("work_order_services.id"), nullable=True)
    work_order_item_id = Column(UUID(as_uuid=True), ForeignKey("work_order_items.id"), nullable=True)
    metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    
    def __repr__(self):
        return f"<InvoiceItem {self.id}: {self.description}, ${self.total:.2f}>"
    
    def calculate_total(self):
        """Calculate the total price for this line item"""
        subtotal = self.quantity * self.unit_price
        discount_amount = subtotal * (self.discount / 100) if self.discount else 0
        tax_amount = (subtotal - discount_amount) * (self.tax_rate / 100) if self.tax_rate else 0
        self.total = subtotal - discount_amount + tax_amount
        return self.total
