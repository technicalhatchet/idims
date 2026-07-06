from sqlalchemy import Column, String, Integer, ForeignKey, Boolean, DateTime, Float, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid

from app.db.database import Base

class Invoice(Base):
    """Invoice model for storing invoice information"""
    __tablename__ = "invoices"

   # This code snippet defines a SQLAlchemy model class named `Invoice` with various columns
   # representing different attributes of an invoice. Here is a breakdown of what each column
   # represents:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id"), nullable=True)
    status = Column(
        Enum(
            "draft",
            "sent",
            "paid",
            "partially_paid",
            "overdue",
            "canceled",
            name="invoice_status_enum"
    ),
    default="draft"
    )
    issue_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    due_date = Column(DateTime, nullable=False)
    subtotal = Column(Float, nullable=False, default=0)
    tax = Column(Float, nullable=False, default=0)
    discount_amount = Column(Float, nullable=False, default=0)
    total_amount = Column(Float, nullable=False, default=0)
    amount_paid = Column(Float, nullable=False, default=0)
    balance = Column(Float, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
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
        return f"<Invoice {self.invoice_number}: ${self.total_amount:.2f}>"
    
    @property
    def is_paid(self):
        """Check if invoice is fully paid"""
        return self.amount_paid >= self.total_amount
    
    @property
    def is_overdue(self):
        """Check if invoice is overdue (only after it has been issued)."""
        if self.status == "draft" or self.is_paid:
            return False
        return self.due_date < datetime.utcnow() and self.status in ("sent", "partially_paid", "overdue")
    
    def _repair_legacy_overdue_draft(self):
        """Revert draft invoices that were auto-marked overdue at creation."""
        if self.status != "overdue" or float(self.amount_paid or 0) > 0:
            return
        if abs((self.due_date - self.issue_date).total_seconds()) < 120:
            self.status = "draft"

    def update_balance(self):
        """Update the invoice balance and payment status."""
        self._repair_legacy_overdue_draft()
        self.balance = self.total_amount - self.amount_paid
        if self.balance <= 0:
            self.status = "paid"
        elif self.amount_paid > 0:
            self.status = "partially_paid"
        elif self.status in ("sent", "partially_paid") and self.due_date < datetime.utcnow():
            self.status = "overdue"
        # Draft invoices stay draft until explicitly sent.

    @property
    def total(self):
        """For backward compatibility, return total_amount"""
        return self.total_amount
    
    @total.setter
    def total(self, value):
        """For backward compatibility, set total_amount"""
        self.total_amount = value


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
    work_order_service_id = Column(UUID(as_uuid=True), ForeignKey("work_order_service.id"), nullable=True)
    work_order_item_id = Column(UUID(as_uuid=True), ForeignKey("work_order_items.id"), nullable=True)
    metadata_json = Column(JSONB, nullable=True)
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
