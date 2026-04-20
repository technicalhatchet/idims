"""consolidate_enum_types

Revision ID: 8be98447a4d0
Revises: d482c20a72ce
Create Date: 2025-04-14 23:30:33.238555

"""
from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8be98447a4d0'
down_revision: Union[str, None] = 'd482c20a72ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Set up logger
logger = logging.getLogger('alembic.runtime.migration')

def upgrade() -> None:
    # Drop uppercase equipmenttype if not in use
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'equipmenttype'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE udt_name = 'equipmenttype'
            ) THEN
                DROP TYPE equipmenttype;
                RAISE NOTICE 'Dropped unused uppercase equipmenttype enum';
            ELSE
                RAISE NOTICE 'Cannot drop uppercase equipmenttype enum as it is still in use';
            END IF;
        END IF;
    END $$;
    """)
    
    # Drop uppercase serviceskilllevel if not in use
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'serviceskilllevel'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE udt_name = 'serviceskilllevel'
            ) THEN
                DROP TYPE serviceskilllevel;
                RAISE NOTICE 'Dropped unused uppercase serviceskilllevel enum';
            ELSE
                RAISE NOTICE 'Cannot drop uppercase serviceskilllevel enum as it is still in use';
            END IF;
        END IF;
    END $$;
    """)
    
    # Drop duplicate service_type enum if not in use
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'service_type'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE udt_name = 'service_type'
            ) THEN
                DROP TYPE service_type;
                RAISE NOTICE 'Dropped unused service_type enum';
            END IF;
        END IF;
    END $$;
    """)


def downgrade() -> None:
    # No downgrade path provided as this is a consolidation migration
    pass
