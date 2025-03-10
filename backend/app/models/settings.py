from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class Settings(Base):
    """Application settings model"""
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<Settings {self.key}>"


class SystemLog(Base):
    """System log model for tracking important system events"""
    __tablename__ = "system_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String(100), nullable=False, index=True)
    details = Column(JSONB, nullable=False)
    severity = Column(String(20), nullable=False, default="info")  # info, warning, error, critical
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    def __repr__(self):
        return f"<SystemLog {self.id}: {self.event_type}>"
    
    @classmethod
    def log_event(cls, db, event_type, details, severity="info"):
        """Create a new system log entry"""
        log = cls(
            event_type=event_type,
            details=details,
            severity=severity
        )
        db.add(log)
        db.commit()
        return log
