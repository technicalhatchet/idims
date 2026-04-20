"""merge_heads

Revision ID: 448252fbd0e4
Revises: 7b458ed510d2, add_unit_to_services
Create Date: 2025-03-28 23:08:48.607443

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '448252fbd0e4'
down_revision: Union[str, None] = ('7b458ed510d2', 'add_unit_to_services')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
