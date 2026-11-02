"""Property scope rows for tenant portal logins."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class ClientLoginPropertyAccess(Base):
    __tablename__ = "client_login_property_access"

    client_login_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_logins.id", ondelete="CASCADE"),
        primary_key=True,
    )
    property_id = Column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    login = relationship("ClientLogin", back_populates="property_access_rows")
    property_ref = relationship("Property")
