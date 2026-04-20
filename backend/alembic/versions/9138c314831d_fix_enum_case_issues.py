"""fix_enum_case_issues

Revision ID: 9138c314831d
Revises: 3954195c963c
Create Date: 2025-04-14 23:36:35.452989

"""
from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9138c314831d'
down_revision: Union[str, None] = '3954195c963c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set up logger
logger = logging.getLogger('alembic.runtime.migration')

def upgrade() -> None:
    # First, ensure lowercase enum types exist
    # 1. Create/check lowercase enum types
    op.execute("""
    DO $$
    BEGIN
        -- Check/create lowercase equipment_type enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_type') THEN
            CREATE TYPE equipment_type AS ENUM (
                'washer', 'dryer', 'stacked_laundry', 'aio_laundry', 
                'refrigerator', 'dishwasher', 'range', 'wall_oven', 
                'tv', 'network', 'other'
            );
            RAISE NOTICE 'Created lowercase equipment_type enum';
        END IF;
        
        -- Check/create lowercase serviceskill_level enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'serviceskill_level') THEN
            CREATE TYPE serviceskill_level AS ENUM (
                'basic', 'intermediate', 'advanced'
            );
            RAISE NOTICE 'Created lowercase serviceskill_level enum';
        END IF;
        
        -- Check/create lowercase servicetype enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'servicetype') THEN
            CREATE TYPE servicetype AS ENUM (
                'diagnostic', 'repair', 'installation', 'additional_time',
                'network', 'remote', 'custom'
            );
            RAISE NOTICE 'Created lowercase servicetype enum';
        END IF;
    END $$;
    """)
    
    # 2. Fix the equipment_type column
    op.execute("""
    DO $$
    BEGIN
        -- Convert to text first to handle any case issues
        ALTER TABLE services ALTER COLUMN equipment_type TYPE text;
        
        -- Update to ensure all values are lowercase
        UPDATE services
        SET equipment_type = LOWER(equipment_type)
        WHERE equipment_type IS NOT NULL;
        
        -- Convert back to proper type
        ALTER TABLE services ALTER COLUMN equipment_type TYPE equipment_type USING equipment_type::equipment_type;
        
        RAISE NOTICE 'Fixed equipment_type column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing equipment_type: %', SQLERRM;
    END $$;
    """)
    
    # 3. Fix the skill_level column
    op.execute("""
    DO $$
    BEGIN
        -- Convert to text first to handle any case issues
        ALTER TABLE services ALTER COLUMN skill_level TYPE text;
        
        -- Update to ensure all values are lowercase
        UPDATE services
        SET skill_level = LOWER(skill_level)
        WHERE skill_level IS NOT NULL;
        
        -- Convert back to proper type
        ALTER TABLE services ALTER COLUMN skill_level TYPE serviceskill_level USING skill_level::serviceskill_level;
        
        RAISE NOTICE 'Fixed skill_level column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing skill_level: %', SQLERRM;
    END $$;
    """)
    
    # 4. Fix the service_type column
    op.execute("""
    DO $$
    BEGIN
        -- Convert to text first to handle any case issues
        ALTER TABLE services ALTER COLUMN service_type TYPE text;
        
        -- Update to ensure all values are lowercase
        UPDATE services
        SET service_type = LOWER(service_type)
        WHERE service_type IS NOT NULL;
        
        -- Convert back to proper type
        ALTER TABLE services ALTER COLUMN service_type TYPE servicetype USING service_type::servicetype;
        
        RAISE NOTICE 'Fixed service_type column';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing service_type: %', SQLERRM;
    END $$;
    """)
    
    # 5. Drop unused uppercase enum types if they exist and aren't being used
    op.execute("""
    DO $$
    BEGIN
        -- Try to drop equipmenttype (uppercase) if not in use
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipmenttype') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE udt_name = 'equipmenttype') THEN
            DROP TYPE equipmenttype;
            RAISE NOTICE 'Dropped uppercase equipmenttype enum';
        END IF;
        
        -- Try to drop serviceskilllevel (uppercase) if not in use
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'serviceskilllevel') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE udt_name = 'serviceskilllevel') THEN
            DROP TYPE serviceskilllevel;
            RAISE NOTICE 'Dropped uppercase serviceskilllevel enum';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping enum types: %', SQLERRM;
    END $$;
    """)


def downgrade() -> None:
    # No downgrade path
    pass
