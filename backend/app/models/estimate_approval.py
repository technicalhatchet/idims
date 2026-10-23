"""Portal estimate approval records (Wave 1A)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class EstimateApproval(Base):
    __tablename__ = "estimate_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_login_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_logins.id", ondelete="SET NULL"),
        nullable=True,
    )
    decision = Column(String(20), nullable=False)
    signer_name = Column(Text, nullable=True)
    signature_drive_file_id = Column(Text, nullable=True)
    estimate_total = Column(Numeric(12, 2), nullable=False)
    estimate_content_hash = Column(String(64), nullable=False)
    estimate_pdf_drive_file_id = Column(Text, nullable=True)
    decline_reason = Column(Text, nullable=True)
    decision_source = Column(String(32), nullable=False, default="customer")
    staff_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    staff_user_name = Column(Text, nullable=True)
    staff_note = Column(Text, nullable=True)
    ip = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
