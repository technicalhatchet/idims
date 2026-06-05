from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base

class TechnicianSkill(Base):
    """Association table for technician-skills relationship"""
    __tablename__ = "technician_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    proficiency_level = Column(Enum("beginner", "intermediate", "advanced", "expert", name="proficiency_level_enum"), nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    technician = relationship("Technician", back_populates="technician_skills", lazy="select")
    skill = relationship("Skill", back_populates="technician_skills", lazy="select")

    def to_dict(self) -> dict:
        """Convert technician skill to dictionary"""
        return {
            "id": str(self.id),
            "technician_id": str(self.technician_id),
            "skill_id": str(self.skill_id),
            "proficiency_level": self.proficiency_level,
            "is_primary": self.is_primary,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        } 