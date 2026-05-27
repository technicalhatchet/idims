from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base


class WorkOrderPayment(Base):
    """Field-recorded payment for a work order (cash, check, etc.) with tax breakdown."""
    __tablename__ = "work_order_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_number = Column(String(50), unique=True, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    subtotal_amount = Column(Numeric(10, 2), nullable=True)
    tax_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    tax_rate_snapshot = Column(Numeric(5, 4), nullable=True)
    payment_method = Column(
        Enum(
            "credit_card",
            "cash",
            "check",
            "bank_transfer",
            "paypal",
            "stripe",
            "other",
            name="payment_method_enum",
            create_type=False,
        ),
        nullable=False,
    )
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="field_payments")
    recorder = relationship("User", foreign_keys=[recorded_by])

    def __repr__(self):
        return f"<WorkOrderPayment {self.payment_number}: ${self.amount}>"
