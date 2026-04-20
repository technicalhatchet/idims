"""update_service_type_enum

Revision ID: e27a8a767fce
Revises: 3b2a7ec52f1c
Create Date: 2025-04-14 00:32:32.607214

"""
from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e27a8a767fce'
down_revision: Union[str, None] = '3b2a7ec52f1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set up logger
logger = logging.getLogger('alembic.runtime.migration')

def upgrade() -> None:
    # Fix the servicetype enum to match with Python enum
    try:
        # First, rename the existing type
        op.execute("ALTER TYPE servicetype RENAME TO servicetype_old")
        
        # Create a new type with correct values (lowercase)
        op.execute("CREATE TYPE servicetype AS ENUM ('diagnostic', 'repair', 'installation', 'additional_time', 'network', 'remote', 'custom')")
        
        # Create a temporary table to update the values
        op.execute("""
        ALTER TABLE services 
        ALTER COLUMN service_type TYPE servicetype 
        USING LOWER(service_type::text)::servicetype
        """)
        
        # Drop the old type
        op.execute("DROP TYPE servicetype_old")
        
        # Do the same for equipment_type
        op.execute("ALTER TYPE equipmenttype RENAME TO equipmenttype_old")
        op.execute("CREATE TYPE equipmenttype AS ENUM ('washer', 'dryer', 'stacked_laundry', 'aio_laundry', 'refrigerator', 'dishwasher', 'range', 'wall_oven', 'tv', 'network', 'other')")
        op.execute("""
        ALTER TABLE services 
        ALTER COLUMN equipment_type TYPE equipmenttype 
        USING LOWER(equipment_type::text)::equipmenttype
        """)
        op.execute("DROP TYPE equipmenttype_old")
        
        # And service skill level
        op.execute("ALTER TYPE serviceskilllevel RENAME TO serviceskilllevel_old")
        op.execute("CREATE TYPE serviceskilllevel AS ENUM ('basic', 'intermediate', 'advanced')")
        op.execute("""
        ALTER TABLE services 
        ALTER COLUMN skill_level TYPE serviceskilllevel 
        USING LOWER(skill_level::text)::serviceskilllevel
        """)
        op.execute("DROP TYPE serviceskilllevel_old")
        
        logger.info("Successfully updated all service-related enums to use lowercase values")
    except Exception as e:
        logger.error(f"Error updating service enums: {str(e)}")
        raise


def downgrade() -> None:
    # This is a corrective migration, downgrade is not needed
    logger.info("Downgrade operation not needed for this migration")
    pass
