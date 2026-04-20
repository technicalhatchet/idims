"""
A script to query the PostgreSQL system catalog to find all enum types.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection string - adjust as needed
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/idims")

def query_enum_types():
    """Query the PostgreSQL system catalog to find all enum types."""
    engine = create_engine(DATABASE_URL)
    
    try:
        # Connect to the database
        with engine.connect() as conn:
            # Query for all enum types
            logger.info("Querying all enum types in the database:")
            query = text("""
                SELECT 
                    t.typname AS enum_name,
                    array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
                FROM 
                    pg_type t
                JOIN 
                    pg_enum e ON t.oid = e.enumtypid
                JOIN 
                    pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                GROUP BY 
                    t.typname, n.nspname
                ORDER BY 
                    t.typname;
            """)
            
            result = conn.execute(query)
            for row in result:
                logger.info(f"Enum Type: {row[0]}")
                logger.info(f"Values: {row[1]}")
                logger.info("---")
            
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")

if __name__ == "__main__":
    query_enum_types() 