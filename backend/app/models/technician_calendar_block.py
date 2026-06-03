from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base


class TechnicianCalendarBlock(Base):
    """Non-job time blocks on a technician's calendar (schedule views)."""
    __tablename__ = "technician_calendar_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id", ondelete="CASCADE"), nullable=False)
    block_type = Column(
        Enum("lunch", "meeting", "shop", "pto", "other", name="technician_calendar_block_type_enum"),
        nullable=False,
        default="other",
    )
    title = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    status = Column(
        Enum("active", "canceled", name="technician_calendar_block_status_enum"),
        nullable=False,
        default="active",
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    technician = relationship("Technician", foreign_keys=[technician_id])

    def __repr__(self):
        return f"<TechnicianCalendarBlock {self.id}: {self.block_type} {self.start_at}>"
