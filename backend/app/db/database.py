from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
import os

from app.config import settings
from app.db.base import Base
from app.models import *  # Import all models

# Get DATABASE_URL - Railway injects this as an env var directly
database_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)

# Create SQLAlchemy engine
engine = create_engine(
    database_url,
    pool_pre_ping=True,  # Check connection health before each use
    pool_size=5,  # Smaller pool to reduce stale connections
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=60,  # Recycle connections every 60 seconds (was 300)
    pool_reset_on_return='rollback',
    connect_args={
        'keepalives': 1,
        'keepalives_idle': 10,  # Start keepalive after 10s idle (was 30)
        'keepalives_interval': 5,  # Send keepalive every 5s (was 10)
        'keepalives_count': 3,  # Fail after 3 missed keepalives (was 5)
        'connect_timeout': 10,
    },
    echo=False  # Never log SQL queries in production — causes massive overhead
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables
Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# Context manager for DB operations outside of API requests
@contextmanager
def get_db_context():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
