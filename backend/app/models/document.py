from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum

class DocumentType(str, enum.Enum):
    """Document types for categorization"""
    WORK_ORDER = "work_order"
    INVOICE = "invoice"
    REPORT = "report"
    CONTRACT = "contract"
    CERTIFICATION = "certification"
    INSURANCE = "insurance"
    TEMPLATE = "template"
    OTHER = "other"

class Document(Base):
    """Document model for storing file metadata and relationships"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50))
    file_size = Column(Integer)  # Size in bytes
    mime_type = Column(String(100))
    
    # Document metadata
    document_type = Column(Enum(DocumentType), nullable=False, default=DocumentType.OTHER)
    version = Column(Integer, default=1)
    is_public = Column(Boolean, default=False)
    doc_metadata = Column(JSON)  # For additional metadata like tags, categories, etc.
    
    # Relationships
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="documents")
    
    # Optional relationships (depending on document type)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    work_order = relationship("WorkOrder", back_populates="documents")
    
    client_id = Column(Integer, ForeignKey("clients.id"))
    client = relationship("Client", back_populates="documents")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        """Convert document to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "document_type": self.document_type,
            "version": self.version,
            "is_public": self.is_public,
            "doc_metadata": self.doc_metadata or {},
            "user_id": str(self.user_id),
            "work_order_id": str(self.work_order_id) if self.work_order_id else None,
            "client_id": str(self.client_id) if self.client_id else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None
        } 