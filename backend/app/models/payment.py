from sqlalchemy import Column, String, ForeignKey, DateTime, Float, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class Payment(Base):
    """Payment model for storing payment information"""
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    payment_number = Column(String(50), unique=True, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    payment_method = Column(Enum("credit_card", "cash", "check", "bank_transfer", "paypal", "stripe", "other", 
                                name="payment_method_enum"), nullable=False)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Enum("success", "pending", "failed", "refunded", name="payment_status_enum"), 
                   default="success")
    transaction_id = Column(String(255), nullable=True)
    processor_response = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self):
        return f"<Payment {self.payment_number}: ${self.amount:.2f}>"
    
    def apply_to_invoice(self):
        """Apply this payment to its invoice"""
        if self.invoice and self.status == "success":
            self.invoice.amount_paid += self.amount
            self.invoice.update_balance()
            
    def refund(self, amount=None, reason=None):
        """Process a refund for this payment"""
        if self.status != "success":
            return False
            
        refund_amount = amount if amount and amount <= self.amount else self.amount
        
        if self.invoice:
            self.invoice.amount_paid -= refund_amount
            self.invoice.update_balance()
            
        self.status = "refunded"
        return True


class PaymentMethod(Base):
    """Payment method model for storing customer payment methods"""
    __tablename__ = "payment_methods"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    type = Column(Enum("credit_card", "bank_account", "paypal", "other", 
                      name="payment_method_type_enum"), nullable=False)
    token = Column(String(255), nullable=True)  # Token from payment processor
    last_four = Column(String(4), nullable=True)  # Last 4 digits of card/account
    expiry_date = Column(String(7), nullable=True)  # Format: MM/YYYY
    is_default = Column(bool, default=False)
    nickname = Column(String(50), nullable=True)
    metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    client = relationship("Client")
    
    def __repr__(self):
        return f"<PaymentMethod {self.id}: {self.type}, {self.last_four}>"
    
    @property
    def display_name(self):
        """Get a display name for this payment method"""
        if self.nickname:
            return self.nickname
        
        if self.type == "credit_card" and self.last_four:
            return f"Card ending in {self.last_four}"
        elif self.type == "bank_account" and self.last_four:
            return f"Bank account ending in {self.last_four}"
        else:
            return self.type.replace('_', ' ').title()
