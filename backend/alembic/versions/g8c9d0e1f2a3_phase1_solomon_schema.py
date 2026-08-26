"""Phase 1 Solomon: diagnostic status + outcome confidence

Revision ID: g8c9d0e1f2a3
Revises: f7a8b9c0d1e2
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "g8c9d0e1f2a3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dma_standalone_diagnostics",
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
    )
    op.create_index(
        "ix_dma_standalone_diagnostics_status",
        "dma_standalone_diagnostics",
        ["status"],
    )

    op.add_column(
        "dma_repair_records",
        sa.Column("outcome_confidence", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_dma_repair_records_outcome_confidence",
        "dma_repair_records",
        ["outcome_confidence"],
    )

    op.add_column(
        "dma_repair_outcomes",
        sa.Column("outcome_confidence", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_dma_repair_outcomes_outcome_confidence",
        "dma_repair_outcomes",
        ["outcome_confidence"],
    )

    # Backfill: saved diagnostics without outcome → in_progress; with outcome → completed
    op.execute(
        """
        UPDATE dma_standalone_diagnostics
        SET status = CASE
            WHEN outcome_id IS NOT NULL THEN 'completed'
            ELSE 'in_progress'
        END
        """
    )


def downgrade():
    op.drop_index("ix_dma_repair_outcomes_outcome_confidence", table_name="dma_repair_outcomes")
    op.drop_column("dma_repair_outcomes", "outcome_confidence")
    op.drop_index("ix_dma_repair_records_outcome_confidence", table_name="dma_repair_records")
    op.drop_column("dma_repair_records", "outcome_confidence")
    op.drop_index("ix_dma_standalone_diagnostics_status", table_name="dma_standalone_diagnostics")
    op.drop_column("dma_standalone_diagnostics", "status")
