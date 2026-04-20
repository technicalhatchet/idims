"""add unit to services

Revision ID: add_unit_to_services
Revises: 0a6b389f5f59
Create Date: 2024-03-28 12:59:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_unit_to_services'
down_revision = '0a6b389f5f59'
branch_labels = None
depends_on = None

def upgrade():
    # Add unit column to services table with default value 'hour'
    op.add_column('services', sa.Column('unit', sa.String(50), nullable=False, server_default='hour'))

def downgrade():
    # Remove unit column from services table
    op.drop_column('services', 'unit') 