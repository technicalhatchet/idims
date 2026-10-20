"""Portal login rows (Auth0 sub → client)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base

ADDED_VIA_INVITE = "invite"
ADDED_VIA_EMAIL_MATCH = "email_match"
ADDED_VIA_SELF_SIGNUP = "self_signup"
ADDED_VIA_MIGRATED = "migrated"


class ClientLogin(Base):
    __tablename__ = "client_logins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    auth0_user_id = Column(Text, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    display_name = Column(Text, nullable=True)
    invited_email = Column(Text, nullable=True)
    invited_phone = Column(Text, nullable=True)
    added_via = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="portal_logins")
    user = relationship("User", foreign_keys=[user_id])
