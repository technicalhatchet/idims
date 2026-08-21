-- Run in Supabase SQL Editor
-- Solomon standalone: dma_standalone_diagnostics + dma_repair_records extensions
-- Matches backend models on feature/solomon-standalone (Alembic f7a8b9c0d1e2)

-- ---------------------------------------------------------------------------
-- Extend dma_repair_records (standalone outcomes / training / DIY)
-- ---------------------------------------------------------------------------

ALTER TABLE dma_repair_records
  ADD COLUMN IF NOT EXISTS title VARCHAR(200);

ALTER TABLE dma_repair_records
  ADD COLUMN IF NOT EXISTS equipment_serial VARCHAR(120);

ALTER TABLE dma_repair_records
  ADD COLUMN IF NOT EXISTS context VARCHAR(20) NOT NULL DEFAULT 'tech';

ALTER TABLE dma_repair_records
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) NOT NULL DEFAULT 'private';

ALTER TABLE dma_repair_records
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved';

ALTER TABLE dma_repair_records
  ADD COLUMN IF NOT EXISTS imported_work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;

-- Backfill existing field records (internal tech entries created before this migration)
UPDATE dma_repair_records
SET
  context = COALESCE(NULLIF(TRIM(context), ''), 'tech'),
  visibility = COALESCE(NULLIF(TRIM(visibility), ''), 'private'),
  moderation_status = COALESCE(NULLIF(TRIM(moderation_status), ''), 'approved')
WHERE context IS NULL
   OR visibility IS NULL
   OR moderation_status IS NULL;

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_context
  ON dma_repair_records (context);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_visibility
  ON dma_repair_records (visibility);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_moderation_status
  ON dma_repair_records (moderation_status);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_imported_work_order_id
  ON dma_repair_records (imported_work_order_id);

-- ---------------------------------------------------------------------------
-- Standalone Solomon diagnostic runs (no work order)
-- payload JSON matches frontend serializeDiagnosticNotePayload()
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dma_standalone_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id UUID REFERENCES dma_repair_records(id) ON DELETE SET NULL,
  equipment_make VARCHAR(120),
  equipment_model VARCHAR(120),
  equipment_type VARCHAR(50),
  equipment_subtype VARCHAR(80),
  equipment_serial VARCHAR(120),
  customer_complaint TEXT,
  payload JSONB NOT NULL,
  context VARCHAR(20) NOT NULL DEFAULT 'tech',
  visibility VARCHAR(32) NOT NULL DEFAULT 'private',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  imported_work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_outcome_id
  ON dma_standalone_diagnostics (outcome_id);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_equipment_make
  ON dma_standalone_diagnostics (equipment_make);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_equipment_subtype
  ON dma_standalone_diagnostics (equipment_subtype);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_context
  ON dma_standalone_diagnostics (context);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_created_by
  ON dma_standalone_diagnostics (created_by);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_imported_work_order_id
  ON dma_standalone_diagnostics (imported_work_order_id);

CREATE INDEX IF NOT EXISTS ix_dma_standalone_diagnostics_updated_at
  ON dma_standalone_diagnostics (updated_at DESC);

-- ---------------------------------------------------------------------------
-- Rollback (manual — run only if you need to undo)
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS dma_standalone_diagnostics;
-- ALTER TABLE dma_repair_records DROP COLUMN IF EXISTS imported_work_order_id;
-- ALTER TABLE dma_repair_records DROP COLUMN IF EXISTS moderation_status;
-- ALTER TABLE dma_repair_records DROP COLUMN IF EXISTS visibility;
-- ALTER TABLE dma_repair_records DROP COLUMN IF EXISTS context;
-- ALTER TABLE dma_repair_records DROP COLUMN IF EXISTS equipment_serial;
-- ALTER TABLE dma_repair_records DROP COLUMN IF EXISTS title;
