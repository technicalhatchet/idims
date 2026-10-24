import uuid

from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class ApplianceLifespanRange(Base):
    __tablename__ = "appliance_lifespan_ranges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_type = Column(String(50), nullable=False)
    equipment_subtype = Column(String(50), nullable=True)
    typical_min_years = Column(Integer, nullable=False)
    typical_max_years = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
