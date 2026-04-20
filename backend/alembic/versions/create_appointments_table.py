"""Create work_order_appointments table

Revision ID: create_appointments_table
Revises: update_work_order_status_enum
Create Date: 2023-03-07 10:11:26.177532

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'create_appointments_table'
down_revision = 'update_work_order_status_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create table with plain VARCHAR and then cast to enum
    op.create_table(
        'work_order_appointments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_order_id', sa.Integer(), nullable=False),
        sa.Column('appointment_type', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='scheduled'),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('scheduled_time', sa.Time(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_work_order_appointments_work_order_id'), 'work_order_appointments', ['work_order_id'], unique=False)
    op.create_index(op.f('ix_work_order_appointments_scheduled_date'), 'work_order_appointments', ['scheduled_date'], unique=False)
    
    # Add enum type constraint to the status column
    op.execute(
        "ALTER TABLE work_order_appointments ALTER COLUMN status TYPE appointment_status_enum USING status::appointment_status_enum"
    )
    
    # Create index on status after type conversion
    op.create_index(op.f('ix_work_order_appointments_status'), 'work_order_appointments', ['status'], unique=False)
    
    # Create trigger to update the updated_at timestamp
    op.execute(
        """
        CREATE TRIGGER update_work_order_appointments_updated_at
        BEFORE UPDATE ON work_order_appointments
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        """
    )


def downgrade() -> None:
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS update_work_order_appointments_updated_at ON work_order_appointments")
    
    # Drop table
    op.drop_table('work_order_appointments')
    
    # Note: We're not dropping the enum as it might be used by other tables 