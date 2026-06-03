-- Per-technician calendar blocks (lunch, meeting, shop, PTO, etc.)
-- Run in Supabase SQL Editor

DO $$ BEGIN
  CREATE TYPE technician_calendar_block_type_enum AS ENUM (
    'lunch', 'meeting', 'shop', 'pto', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technician_calendar_block_status_enum AS ENUM ('active', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS technician_calendar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  block_type technician_calendar_block_type_enum NOT NULL DEFAULT 'other',
  title VARCHAR(120),
  notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status technician_calendar_block_status_enum NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT technician_calendar_blocks_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS ix_technician_calendar_blocks_technician_id
  ON technician_calendar_blocks (technician_id);

CREATE INDEX IF NOT EXISTS ix_technician_calendar_blocks_start_at
  ON technician_calendar_blocks (start_at);

CREATE INDEX IF NOT EXISTS ix_technician_calendar_blocks_active_range
  ON technician_calendar_blocks (technician_id, start_at, end_at)
  WHERE status = 'active';
