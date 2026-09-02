from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class LogitProject(Base):
    __tablename__ = "logit_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    context = Column(Text, nullable=True)
    icon = Column(String(16), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    entries = relationship("LogitEntry", back_populates="project", cascade="all, delete-orphan")
    user = relationship("User", backref="logit_projects")


class LogitEntry(Base):
    __tablename__ = "logit_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("logit_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    type = Column(String(32), nullable=True)
    category = Column(String(32), nullable=True)
    severity = Column(String(32), nullable=True)
    frequency = Column(String(32), nullable=True)

    title = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    impact = Column(Text, nullable=True)
    suggested_fix = Column(Text, nullable=True)

    original_transcript = Column(Text, nullable=False)

    ai_title = Column(Text, nullable=True)
    ai_description = Column(Text, nullable=True)
    ai_impact = Column(Text, nullable=True)
    ai_suggested_fix = Column(Text, nullable=True)

    ai_confidence = Column(Numeric(4, 3), nullable=True)
    ai_model = Column(String(120), nullable=True)

    status = Column(String(32), nullable=False, default="draft")

    project = relationship("LogitProject", back_populates="entries")
    user = relationship("User", backref="logit_entries")
