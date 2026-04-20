"""add_sku_system

Revision ID: 3b2a7ec52f1c
Revises: 053df206a265
Create Date: 2025-04-16 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = '3b2a7ec52f1c'
down_revision = '053df206a265'  # Assuming this is the latest migration
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()
    
    # Create enum types if they don't exist
    # Check if the enum types exist before creating them
    for enum_type, enum_values in [
        ('serviceskill_level', ['basic', 'intermediate', 'advanced']),
        ('service_type', ['diagnostic', 'repair', 'installation', 'additional_time', 'network', 'remote', 'custom']),
        ('equipment_type', ['washer', 'dryer', 'stacked_laundry', 'aio_laundry', 'refrigerator', 'dishwasher', 'range', 'wall_oven', 'tv', 'network', 'other'])
    ]:
        try:
            # Try to create the enum
            if enum_type == 'serviceskill_level':
                service_skill_level = sa.Enum('basic', 'intermediate', 'advanced', name='serviceskill_level')
                service_skill_level.create(op.get_bind(), checkfirst=True)
            elif enum_type == 'service_type':
                service_type = sa.Enum('diagnostic', 'repair', 'installation', 'additional_time', 'network', 'remote', 'custom', name='service_type')
                service_type.create(op.get_bind(), checkfirst=True)
            elif enum_type == 'equipment_type':
                equipment_type = sa.Enum('washer', 'dryer', 'stacked_laundry', 'aio_laundry', 'refrigerator', 'dishwasher', 'range', 'wall_oven', 'tv', 'network', 'other', name='equipment_type')
                equipment_type.create(op.get_bind(), checkfirst=True)
        except Exception as e:
            print(f"Enum {enum_type} probably already exists: {e}")
    
    # Alter services table to add SKU fields if they don't exist
    if 'services' in tables:
        columns = [c['name'] for c in inspector.get_columns('services')]
        
        # Add columns that don't exist yet
        column_definitions = [
            ('sku_code', sa.String(50), True, True, True),
            ('service_type', service_type, True, False, False),
            ('equipment_type', equipment_type, True, False, False),
            ('skill_level', service_skill_level, True, False, False),
            ('duration_minutes', sa.Integer(), True, False, False),
            ('is_bundle', sa.Boolean(), False, False, False),
            ('is_custom_price', sa.Boolean(), False, False, False),
            ('requires_diagnostic', sa.Boolean(), False, False, False),
            ('prerequisites', postgresql.JSON(astext_type=sa.Text()), True, False, False),
            ('common_parts', postgresql.JSON(astext_type=sa.Text()), True, False, False),
            ('equipment_compatibility', postgresql.JSON(astext_type=sa.Text()), True, False, False)
        ]
        
        for name, type_, nullable, unique, index in column_definitions:
            if name not in columns:
                try:
                    if name in ['is_bundle', 'is_custom_price', 'requires_diagnostic']:
                        op.add_column('services', sa.Column(name, type_, nullable=nullable, server_default='false'))
                    else:
                        op.add_column('services', sa.Column(name, type_, nullable=nullable, unique=unique, index=index))
                except Exception as e:
                    print(f"Column {name} probably already exists: {e}")
        
        # Set temporary SKU codes for existing services if sku_code exists but some values are NULL
        try:
            op.execute("""
            UPDATE services
            SET sku_code = 'SVC-' || UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 8))
            WHERE sku_code IS NULL
            """)
            
            # Make sku_code not nullable after setting values if it's not already
            op.alter_column('services', 'sku_code', nullable=False)
        except Exception as e:
            print(f"Error updating or altering sku_code: {e}")
    
    # Create service_bundles table if it doesn't exist
    if 'service_bundles' not in tables:
        try:
            op.create_table('service_bundles',
                sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
                sa.Column('bundle_service_id', postgresql.UUID(as_uuid=True), nullable=False),
                sa.Column('included_service_id', postgresql.UUID(as_uuid=True), nullable=False),
                sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
                sa.Column('discount_percent', sa.Float(), server_default='0', nullable=False),
                sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
                sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
                sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
                sa.ForeignKeyConstraint(['bundle_service_id'], ['services.id'], ),
                sa.ForeignKeyConstraint(['included_service_id'], ['services.id'], ),
                sa.PrimaryKeyConstraint('id')
            )
        except Exception as e:
            print(f"Table service_bundles probably already exists: {e}")
    
    # Create service_surcharges table if it doesn't exist
    if 'service_surcharges' not in tables:
        try:
            op.create_table('service_surcharges',
                sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
                sa.Column('name', sa.String(100), nullable=False),
                sa.Column('description', sa.Text(), nullable=True),
                sa.Column('surcharge_type', sa.String(50), nullable=False),
                sa.Column('amount', sa.Float(), nullable=False),
                sa.Column('is_percentage', sa.Boolean(), server_default='false', nullable=False),
                sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
                sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
                sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
                sa.PrimaryKeyConstraint('id')
            )
        except Exception as e:
            print(f"Table service_surcharges probably already exists: {e}")
    
    # Create indices if they don't exist
    try:
        op.create_index(op.f('ix_service_bundles_bundle_service_id'), 'service_bundles', ['bundle_service_id'], unique=False)
    except Exception as e:
        print(f"Index ix_service_bundles_bundle_service_id probably already exists: {e}")
        
    try:
        op.create_index(op.f('ix_service_bundles_included_service_id'), 'service_bundles', ['included_service_id'], unique=False)
    except Exception as e:
        print(f"Index ix_service_bundles_included_service_id probably already exists: {e}")
        
    try:
        op.create_index(op.f('ix_service_surcharges_surcharge_type'), 'service_surcharges', ['surcharge_type'], unique=False)
    except Exception as e:
        print(f"Index ix_service_surcharges_surcharge_type probably already exists: {e}")


def downgrade():
    # Drop indices
    try:
        op.drop_index(op.f('ix_service_surcharges_surcharge_type'), table_name='service_surcharges')
    except Exception:
        pass
        
    try:
        op.drop_index(op.f('ix_service_bundles_included_service_id'), table_name='service_bundles')
    except Exception:
        pass
        
    try:
        op.drop_index(op.f('ix_service_bundles_bundle_service_id'), table_name='service_bundles')
    except Exception:
        pass
    
    # Drop tables
    try:
        op.drop_table('service_surcharges')
    except Exception:
        pass
        
    try:
        op.drop_table('service_bundles')
    except Exception:
        pass
    
    # Remove columns from services table
    try:
        op.drop_column('services', 'equipment_compatibility')
        op.drop_column('services', 'common_parts')
        op.drop_column('services', 'prerequisites')
        op.drop_column('services', 'requires_diagnostic')
        op.drop_column('services', 'is_custom_price')
        op.drop_column('services', 'is_bundle')
        op.drop_column('services', 'duration_minutes')
        op.drop_column('services', 'skill_level')
        op.drop_column('services', 'equipment_type')
        op.drop_column('services', 'service_type')
        op.drop_column('services', 'sku_code')
    except Exception:
        pass
    
    # Drop enum types
    try:
        op.execute('DROP TYPE equipment_type')
    except Exception:
        pass
        
    try:
        op.execute('DROP TYPE service_type')
    except Exception:
        pass
        
    try:
        op.execute('DROP TYPE serviceskill_level')
    except Exception:
        pass 