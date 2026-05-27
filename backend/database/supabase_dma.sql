-- Run in Supabase SQL Editor
-- DMA (Diagnostic Memory Amplifier): one repair outcome per work order

CREATE TABLE IF NOT EXISTS dma_repair_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL UNIQUE REFERENCES work_orders(id) ON DELETE CASCADE,
  source_note_id UUID REFERENCES work_order_notes(id) ON DELETE SET NULL,
  customer_complaint TEXT,
  problem_code VARCHAR(80),
  resolution_code VARCHAR(80),
  confirmed_fix TEXT NOT NULL,
  error_code_text VARCHAR(80),
  replaced_parts TEXT,
  repair_successful BOOLEAN NOT NULL DEFAULT TRUE,
  callback_required BOOLEAN NOT NULL DEFAULT FALSE,
  technician_summary TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_dma_repair_outcomes_problem_code
  ON dma_repair_outcomes (problem_code);

CREATE INDEX IF NOT EXISTS ix_dma_repair_outcomes_resolution_code
  ON dma_repair_outcomes (resolution_code);

CREATE INDEX IF NOT EXISTS ix_dma_repair_outcomes_error_code_text
  ON dma_repair_outcomes (error_code_text);

CREATE INDEX IF NOT EXISTS ix_dma_repair_outcomes_repair_successful
  ON dma_repair_outcomes (repair_successful);

CREATE INDEX IF NOT EXISTS ix_dma_repair_outcomes_updated_at
  ON dma_repair_outcomes (updated_at DESC);
