from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base_class import Base

class MediaType(str, enum.Enum):
    """Enum for media types"""
    QUOTE = "quote"
    INVOICE = "invoice"
    WORK_ORDER = "work_order"
    CLIENT = "client"
    TECHNICIAN = "technician"
    OTHER = "other"

class Media(Base):
    """Media model for storing file attachments"""
    __tablename__ = "media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    media_type = Column(Enum(MediaType), nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=True)  # ID of the related entity (quote, invoice, etc.)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    uploader = relationship("User", back_populates="media")
    quote = relationship("Quote", back_populates="attachments", foreign_keys=[reference_id])
    invoice = relationship("Invoice", back_populates="attachments", foreign_keys=[reference_id])
    work_order = relationship("WorkOrder", back_populates="attachments", foreign_keys=[reference_id])
    client = relationship("Client", back_populates="attachments", foreign_keys=[reference_id]) 