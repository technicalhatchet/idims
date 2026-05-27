from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class DmaRepairOutcome(Base):
    """One confirmed repair outcome per work order (indexed for DMA search)."""
    __tablename__ = "dma_repair_outcomes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    source_note_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_order_notes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_complaint = Column(Text, nullable=True)
    problem_code = Column(String(80), nullable=True, index=True)
    resolution_code = Column(String(80), nullable=True, index=True)
    confirmed_fix = Column(Text, nullable=False)
    error_code_text = Column(String(80), nullable=True, index=True)
    replaced_parts = Column(Text, nullable=True)
    repair_successful = Column(Boolean, default=True, nullable=False, index=True)
    callback_required = Column(Boolean, default=False, nullable=False)
    technician_summary = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="dma_outcome")
    source_note = relationship("WorkOrderNote", foreign_keys=[source_note_id])

    def __repr__(self):
        return f"<DmaRepairOutcome wo={self.work_order_id} fix={self.confirmed_fix[:40]!r}>"
