"""Admin client merge audit trail (phase 2f)."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.base import Base


class ClientMergeAudit(Base):
    __tablename__ = "client_merge_audits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    keep_client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    merge_client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    merged_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    merged_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    field_choices = Column(JSONB, nullable=False, default=dict)
    moved = Column(JSONB, nullable=False, default=dict)
    warnings = Column(JSONB, nullable=False, default=list)
