-- Run in Supabase SQL Editor
-- Standalone DMA field records (no work order / client / PII)

CREATE TABLE IF NOT EXISTS dma_repair_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_make VARCHAR(120),
  equipment_model VARCHAR(120),
  equipment_type VARCHAR(50),
  equipment_subtype VARCHAR(80),
  customer_complaint TEXT,
  problem_code VARCHAR(80),
  resolution_code VARCHAR(80),
  confirmed_fix TEXT NOT NULL,
  error_code_text VARCHAR(80),
  replaced_parts TEXT,
  repair_successful BOOLEAN NOT NULL DEFAULT TRUE,
  callback_required BOOLEAN NOT NULL DEFAULT FALSE,
  technician_summary TEXT,
  performed_on DATE,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_equipment_make
  ON dma_repair_records (equipment_make);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_equipment_subtype
  ON dma_repair_records (equipment_subtype);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_problem_code
  ON dma_repair_records (problem_code);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_resolution_code
  ON dma_repair_records (resolution_code);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_error_code_text
  ON dma_repair_records (error_code_text);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_repair_successful
  ON dma_repair_records (repair_successful);

CREATE INDEX IF NOT EXISTS ix_dma_repair_records_updated_at
  ON dma_repair_records (updated_at DESC);
