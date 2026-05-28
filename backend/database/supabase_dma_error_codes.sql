-- Run in Supabase SQL Editor
-- DMA error code reference library (read-only seed data)

CREATE TABLE IF NOT EXISTS dma_error_code_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer VARCHAR(80) NOT NULL,
  equipment_subtype VARCHAR(80) NOT NULL,
  code VARCHAR(40) NOT NULL,
  code_normalized VARCHAR(40) NOT NULL,
  meaning TEXT NOT NULL,
  common_causes TEXT,
  recommended_fix TEXT,
  alias_group_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_dma_error_code_refs_manufacturer
  ON dma_error_code_references (manufacturer);

CREATE INDEX IF NOT EXISTS ix_dma_error_code_refs_subtype
  ON dma_error_code_references (equipment_subtype);

CREATE INDEX IF NOT EXISTS ix_dma_error_code_refs_code_normalized
  ON dma_error_code_references (code_normalized);

CREATE INDEX IF NOT EXISTS ix_dma_error_code_refs_alias_group
  ON dma_error_code_references (alias_group_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dma_error_code_refs_unique
  ON dma_error_code_references (manufacturer, equipment_subtype, code_normalized);

-- After creating the table, run: supabase_dma_error_codes_seed.sql
