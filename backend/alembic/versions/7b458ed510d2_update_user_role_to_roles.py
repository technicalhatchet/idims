"""update_user_role_to_roles

Revision ID: 7b458ed510d2
Revises: previous_revision
Create Date: 2024-03-28 23:06:01.534

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '7b458ed510d2'
down_revision = None  # Update this with your previous migration ID
branch_labels = None
depends_on = None

def upgrade():
    # Create a temporary column to store the role values
    op.add_column('users', sa.Column('roles', postgresql.JSON(), nullable=True))
    
    # Update the roles column with arrays containing the old role values
    op.execute("""
        UPDATE users 
        SET roles = jsonb_build_array(role)
        WHERE role IS NOT NULL
    """)
    
    # Drop the old role column
    op.drop_column('users', 'role')
    
    # Make the roles column non-nullable with a default empty array
    op.alter_column('users', 'roles',
                    existing_type=postgresql.JSON(),
                    nullable=False,
                    server_default='[]')

def downgrade():
    # Add back the role column
    op.add_column('users', sa.Column('role', sa.String(length=50), nullable=True))
    
    # Convert the first role from the roles array back to the role column
    op.execute("""
        UPDATE users 
        SET role = (roles->>0)::text
        WHERE roles IS NOT NULL AND jsonb_array_length(roles) > 0
    """)
    
    # Drop the roles column
    op.drop_column('users', 'roles')
    
    # Make the role column non-nullable with a default value
    op.alter_column('users', 'role',
                    existing_type=sa.String(length=50),
                    nullable=False,
                    server_default='client')
