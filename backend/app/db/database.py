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
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    pool_timeout=30,
    pool_recycle=60,
    pool_reset_on_return='commit',
    connect_args={
        'keepalives': 1,
        'keepalives_idle': 30,
        'keepalives_interval': 10,
        'keepalives_count': 5,
        'connect_timeout': 10,
    },
    echo=settings.DEBUG
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
    finally:
        db.close()

# Context manager for DB operations outside of API requests
@contextmanager
def get_db_context():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
