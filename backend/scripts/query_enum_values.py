"""
A script to query and print all distinct enum values currently in use in the database.
This will help us determine the complete set of values needed for our enum types.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection string - adjust as needed
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/idims")

def query_distinct_values():
    """Query distinct values for enum columns in the database."""
    engine = create_engine(DATABASE_URL)
    
    try:
        # Connect to the database
        with engine.connect() as conn:
            # Query distinct service_type values
            logger.info("Querying distinct service_type values:")
            result = conn.execute(text("SELECT DISTINCT service_type FROM services"))
            service_types = [row[0] for row in result]
            logger.info(f"service_type values: {service_types}")
            
            # Query distinct equipment_type values
            logger.info("\nQuerying distinct equipment_type values:")
            result = conn.execute(text("SELECT DISTINCT equipment_type FROM services"))
            equipment_types = [row[0] for row in result]
            logger.info(f"equipment_type values: {equipment_types}")
            
            # Query distinct skill_level values
            logger.info("\nQuerying distinct skill_level values:")
            result = conn.execute(text("SELECT DISTINCT skill_level FROM services"))
            skill_levels = [row[0] for row in result]
            logger.info(f"skill_level values: {skill_levels}")
            
            # Generate SQL statements for creating new enums
            logger.info("\nGenerated SQL statements for migration:")
            
            # Service Type enum
            service_type_values = ", ".join(f"'{val.lower()}'" for val in service_types if val)
            logger.info(f"CREATE TYPE servicetype AS ENUM ({service_type_values});")
            
            # Equipment Type enum
            equipment_type_values = ", ".join(f"'{val.lower()}'" for val in equipment_types if val)
            logger.info(f"CREATE TYPE equipmenttype AS ENUM ({equipment_type_values});")
            
            # Skill Level enum
            skill_level_values = ", ".join(f"'{val.lower()}'" for val in skill_levels if val)
            logger.info(f"CREATE TYPE serviceskillevel AS ENUM ({skill_level_values});")
            
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")

if __name__ == "__main__":
    query_distinct_values() 