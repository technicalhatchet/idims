"""lowercase_enum_values

Revision ID: d482c20a72ce
Revises: e27a8a767fce
Create Date: 2025-04-14 15:55:03.013566

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd482c20a72ce'
down_revision: Union[str, None] = 'e27a8a767fce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fix servicetype enum
    # It already exists with the correct lowercase values
    op.execute("DROP TYPE IF EXISTS servicetype_old")
    
    # Add 'microwave' to equipmenttype enum
    op.execute("ALTER TYPE equipmenttype RENAME TO equipmenttype_old")
    op.execute("CREATE TYPE equipmenttype AS ENUM ('TV', 'REFRIGERATOR', 'WASHER', 'DRYER', 'DISHWASHER', 'RANGE', 'MICROWAVE', 'WALL_OVEN', 'NETWORK', 'STACKED_LAUNDRY', 'AIO_LAUNDRY', 'OTHER')")
    op.execute("ALTER TABLE services ALTER COLUMN equipment_type TYPE equipmenttype USING equipment_type::text::equipmenttype")
    op.execute("DROP TYPE equipmenttype_old")
    
    # Add 'expert' to serviceskilllevel enum
    op.execute("ALTER TYPE serviceskilllevel RENAME TO serviceskilllevel_old")
    op.execute("CREATE TYPE serviceskilllevel AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')")
    op.execute("ALTER TABLE services ALTER COLUMN skill_level TYPE serviceskilllevel USING skill_level::text::serviceskilllevel")
    op.execute("DROP TYPE serviceskilllevel_old")
    
    # Create lowercase equipment_type and serviceskill_level types if needed
    op.execute("DROP TYPE IF EXISTS equipment_type")
    op.execute("CREATE TYPE equipment_type AS ENUM ('washer', 'dryer', 'stacked_laundry', 'aio_laundry', 'refrigerator', 'dishwasher', 'range', 'wall_oven', 'microwave', 'tv', 'network', 'other')")
    
    op.execute("DROP TYPE IF EXISTS serviceskill_level")
    op.execute("CREATE TYPE serviceskill_level AS ENUM ('basic', 'intermediate', 'advanced', 'expert')")
    
    # Create service_type if it doesn't exist
    op.execute("DROP TYPE IF EXISTS service_type")
    op.execute("CREATE TYPE service_type AS ENUM ('diagnostic', 'repair', 'installation', 'custom', 'additional_time', 'remote', 'network')")


def downgrade() -> None:
    # No need to revert since we're keeping all existing enums
    pass
