"""add repair_memory_match to dma_repair_outcomes

Revision ID: c9d4e5f6a7b8
Revises: b7e4c2a91f05
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa

revision = "c9d4e5f6a7b8"
down_revision = "b7e4c2a91f05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dma_repair_outcomes",
        sa.Column("repair_memory_match", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_dma_repair_outcomes_repair_memory_match",
        "dma_repair_outcomes",
        ["repair_memory_match"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_dma_repair_outcomes_repair_memory_match", table_name="dma_repair_outcomes")
    op.drop_column("dma_repair_outcomes", "repair_memory_match")
