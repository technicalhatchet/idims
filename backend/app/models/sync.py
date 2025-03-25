from sqlalchemy import Column, String, ForeignKey, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base

class OfflineSyncQueue(Base):
    __tablename__ = "offline_sync_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    action = Column(String(20), nullable=False)
    data = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    error_message = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    synced_at = Column(TIMESTAMP(timezone=True))

    # Relationships
    user = relationship("User")