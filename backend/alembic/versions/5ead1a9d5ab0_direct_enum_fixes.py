"""direct_enum_fixes

Revision ID: 5ead1a9d5ab0
Revises: 9138c314831d
Create Date: 2025-04-14 23:38:46.196908

"""
from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '5ead1a9d5ab0'
down_revision: Union[str, None] = '9138c314831d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set up logger
logger = logging.getLogger('alembic.runtime.migration')

def upgrade() -> None:
    # Direct fixes for enum issues using raw SQL
    # This approach avoids the complex upgrade path issues
    
    connection = op.get_bind()
    
    # 1. Get the current state of columns to understand what we're working with
    result = connection.execute(text("""
    SELECT
        column_name, 
        data_type, 
        udt_name 
    FROM 
        information_schema.columns 
    WHERE 
        table_name = 'services' 
        AND column_name IN ('service_type', 'equipment_type', 'skill_level')
    """))
    
    column_info = {}
    for row in result:
        column_info[row[0]] = {'data_type': row[1], 'udt_name': row[2]}
    
    logger.info(f"Current column info: {column_info}")
    
    # 2. Handle service_type
    try:
        # If using a different enum type, convert to text
        if column_info.get('service_type', {}).get('udt_name') != 'servicetype':
            connection.execute(text("ALTER TABLE services ALTER COLUMN service_type TYPE text"))
            
            # Convert values to lowercase
            connection.execute(text("UPDATE services SET service_type = LOWER(service_type) WHERE service_type IS NOT NULL"))
            
            # Create servicetype enum if it doesn't exist
            connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'servicetype') THEN
                    CREATE TYPE servicetype AS ENUM (
                        'diagnostic', 'repair', 'installation', 'additional_time',
                        'network', 'remote', 'custom'
                    );
                END IF;
            END $$;
            """))
            
            # Convert to proper enum
            connection.execute(text("ALTER TABLE services ALTER COLUMN service_type TYPE servicetype USING service_type::servicetype"))
            logger.info("Fixed service_type column to use lowercase servicetype enum")
    except Exception as e:
        logger.error(f"Error fixing service_type: {str(e)}")
    
    # 3. Handle equipment_type
    try:
        # If using a different enum type, convert to text
        if column_info.get('equipment_type', {}).get('udt_name') != 'equipment_type':
            connection.execute(text("ALTER TABLE services ALTER COLUMN equipment_type TYPE text"))
            
            # Convert values to lowercase
            connection.execute(text("UPDATE services SET equipment_type = LOWER(equipment_type) WHERE equipment_type IS NOT NULL"))
            
            # Create equipment_type enum if it doesn't exist
            connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_type') THEN
                    CREATE TYPE equipment_type AS ENUM (
                        'washer', 'dryer', 'stacked_laundry', 'aio_laundry', 
                        'refrigerator', 'dishwasher', 'range', 'wall_oven', 
                        'tv', 'network', 'other'
                    );
                END IF;
            END $$;
            """))
            
            # Convert to proper enum
            connection.execute(text("ALTER TABLE services ALTER COLUMN equipment_type TYPE equipment_type USING equipment_type::equipment_type"))
            logger.info("Fixed equipment_type column to use lowercase equipment_type enum")
    except Exception as e:
        logger.error(f"Error fixing equipment_type: {str(e)}")
    
    # 4. Handle skill_level
    try:
        # If using a different enum type, convert to text
        if column_info.get('skill_level', {}).get('udt_name') != 'serviceskill_level':
            connection.execute(text("ALTER TABLE services ALTER COLUMN skill_level TYPE text"))
            
            # Convert values to lowercase
            connection.execute(text("UPDATE services SET skill_level = LOWER(skill_level) WHERE skill_level IS NOT NULL"))
            
            # Create serviceskill_level enum if it doesn't exist
            connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'serviceskill_level') THEN
                    CREATE TYPE serviceskill_level AS ENUM (
                        'basic', 'intermediate', 'advanced'
                    );
                END IF;
            END $$;
            """))
            
            # Convert to proper enum
            connection.execute(text("ALTER TABLE services ALTER COLUMN skill_level TYPE serviceskill_level USING skill_level::serviceskill_level"))
            logger.info("Fixed skill_level column to use lowercase serviceskill_level enum")
    except Exception as e:
        logger.error(f"Error fixing skill_level: {str(e)}")
    
    # 5. Try to drop unused uppercase enum types
    try:
        connection.execute(text("""
        DO $$
        BEGIN
            -- Drop equipmenttype (uppercase) if not in use
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipmenttype') 
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE udt_name = 'equipmenttype') THEN
                DROP TYPE equipmenttype;
            END IF;
            
            -- Drop serviceskilllevel (uppercase) if not in use
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'serviceskilllevel') 
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE udt_name = 'serviceskilllevel') THEN
                DROP TYPE serviceskilllevel;
            END IF;
        END $$;
        """))
        logger.info("Attempted to drop unused uppercase enum types")
    except Exception as e:
        logger.error(f"Error dropping unused enum types: {str(e)}")


def downgrade() -> None:
    # No downgrade path
    pass
