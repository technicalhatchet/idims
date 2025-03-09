from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import logging
from contextlib import contextmanager
from sqlalchemy.pool import QueuePool

logger = logging.getLogger(__name__)

# Create SQLAlchemy engine with optimized connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    **settings.get_database_connection_args(),
    poolclass=QueuePool,
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Database dependency
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Context manager for database sessions"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# For background tasks that need DB access
def get_db_session():
    """Get a database session for background tasks"""
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        logger.error(f"Error getting DB session: {str(e)}")
        if db:
            db.close()
        raise