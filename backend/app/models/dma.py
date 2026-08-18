from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Date, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


dma_outcome_tags = Table(
    "dma_outcome_tags",
    Base.metadata,
    Column(
        "outcome_id",
        UUID(as_uuid=True),
        ForeignKey("dma_repair_outcomes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        UUID(as_uuid=True),
        ForeignKey("dma_tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

dma_record_tags = Table(
    "dma_record_tags",
    Base.metadata,
    Column(
        "record_id",
        UUID(as_uuid=True),
        ForeignKey("dma_repair_records.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        UUID(as_uuid=True),
        ForeignKey("dma_tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class DmaTag(Base):
    __tablename__ = "dma_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(80), nullable=False, unique=True, index=True)
    label = Column(String(120), nullable=False)
    category = Column(String(32), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<DmaTag {self.slug}>"


class DmaRepairRecord(Base):
    """Standalone repair memory entry — no work order or client (field / training corpus)."""
    __tablename__ = "dma_repair_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_make = Column(String(120), nullable=True, index=True)
    equipment_model = Column(String(120), nullable=True)
    equipment_type = Column(String(50), nullable=True)
    equipment_subtype = Column(String(80), nullable=True, index=True)
    customer_complaint = Column(Text, nullable=True)
    problem_code = Column(String(80), nullable=True, index=True)
    resolution_code = Column(String(80), nullable=True, index=True)
    confirmed_fix = Column(Text, nullable=False)
    error_code_text = Column(String(80), nullable=True, index=True)
    replaced_parts = Column(Text, nullable=True)
    repair_successful = Column(Boolean, default=True, nullable=False, index=True)
    callback_required = Column(Boolean, default=False, nullable=False)
    technician_summary = Column(Text, nullable=True)
    performed_on = Column(Date, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    creator = relationship("User", foreign_keys=[created_by])
    tags = relationship("DmaTag", secondary=dma_record_tags, lazy="selectin")

    def __repr__(self):
        return f"<DmaRepairRecord {self.id} fix={self.confirmed_fix[:40]!r}>"


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
    repair_memory_match = Column(String(20), nullable=True, index=True)
    callback_required = Column(Boolean, default=False, nullable=False)
    technician_summary = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="dma_outcome")
    source_note = relationship("WorkOrderNote", foreign_keys=[source_note_id])
    tags = relationship("DmaTag", secondary=dma_outcome_tags, lazy="selectin")

    def __repr__(self):
        return f"<DmaRepairOutcome wo={self.work_order_id} fix={self.confirmed_fix[:40]!r}>"


class DmaErrorCodeReference(Base):
    """Read-only manufacturer error code reference (seeded from field docs)."""
    __tablename__ = "dma_error_code_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manufacturer = Column(String(80), nullable=False, index=True)
    equipment_subtype = Column(String(80), nullable=False, index=True)
    code = Column(String(40), nullable=False)
    code_normalized = Column(String(40), nullable=False, index=True)
    meaning = Column(Text, nullable=False)
    common_causes = Column(Text, nullable=True)
    recommended_fix = Column(Text, nullable=True)
    alias_group_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<DmaErrorCodeReference {self.manufacturer} {self.code_normalized}>"
