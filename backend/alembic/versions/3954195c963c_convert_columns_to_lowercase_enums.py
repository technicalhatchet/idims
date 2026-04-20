"""convert_columns_to_lowercase_enums

Revision ID: 3954195c963c
Revises: 8be98447a4d0
Create Date: 2025-04-14 23:34:07.473773

"""
from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3954195c963c'
down_revision: Union[str, None] = '8be98447a4d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set up logger
logger = logging.getLogger('alembic.runtime.migration')

def upgrade() -> None:
    # Convert services.equipment_type to use lowercase equipment_type enum if it's not already
    op.execute("""
    DO $$
    DECLARE
        current_type text;
    BEGIN
        SELECT udt_name INTO current_type FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'equipment_type';
        
        IF current_type = 'equipmenttype' THEN
            -- Create a temporary column
            ALTER TABLE services ADD COLUMN equipment_type_temp text;
            
            -- Copy data with lowercase conversion
            UPDATE services 
            SET equipment_type_temp = LOWER(equipment_type::text);
            
            -- Drop the original column
            ALTER TABLE services DROP COLUMN equipment_type;
            
            -- Add back the column with correct type
            ALTER TABLE services ADD COLUMN equipment_type equipment_type;
            
            -- Convert and update the data
            UPDATE services 
            SET equipment_type = equipment_type_temp::equipment_type
            WHERE equipment_type_temp IS NOT NULL;
            
            -- Drop the temporary column
            ALTER TABLE services DROP COLUMN equipment_type_temp;
            
            RAISE NOTICE 'Converted services.equipment_type from uppercase to lowercase enum';
        ELSE
            RAISE NOTICE 'services.equipment_type already using lowercase enum type: %', current_type;
        END IF;
    END $$;
    """)
    
    # Convert services.skill_level to use lowercase serviceskill_level enum if it's not already
    op.execute("""
    DO $$
    DECLARE
        current_type text;
    BEGIN
        SELECT udt_name INTO current_type FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'skill_level';
        
        IF current_type = 'serviceskilllevel' THEN
            -- Create a temporary column
            ALTER TABLE services ADD COLUMN skill_level_temp text;
            
            -- Copy data with lowercase conversion
            UPDATE services 
            SET skill_level_temp = LOWER(skill_level::text);
            
            -- Drop the original column
            ALTER TABLE services DROP COLUMN skill_level;
            
            -- Add back the column with correct type
            ALTER TABLE services ADD COLUMN skill_level serviceskill_level;
            
            -- Convert and update the data
            UPDATE services 
            SET skill_level = skill_level_temp::serviceskill_level
            WHERE skill_level_temp IS NOT NULL;
            
            -- Drop the temporary column
            ALTER TABLE services DROP COLUMN skill_level_temp;
            
            RAISE NOTICE 'Converted services.skill_level from uppercase to lowercase enum';
        ELSE
            RAISE NOTICE 'services.skill_level already using lowercase enum type: %', current_type;
        END IF;
    END $$;
    """)
    
    # Verify that service_type is using the correct enum
    op.execute("""
    DO $$
    DECLARE
        current_type text;
    BEGIN
        SELECT udt_name INTO current_type FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'service_type';
        
        IF current_type = 'servicetype' THEN
            RAISE NOTICE 'services.service_type is using correct lowercase enum: %', current_type;
        ELSE
            RAISE NOTICE 'WARNING: services.service_type using unexpected enum type: %', current_type;
        END IF;
    END $$;
    """)


def downgrade() -> None:
    # No downgrade path provided
    pass
