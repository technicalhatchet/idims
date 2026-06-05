-- Work order administrative close + redo (run on dev/staging before prod; snapshot DB first).
-- Adds is_closed layer (separate from status=completed), redo lineage, and enum values.

-- ---------------------------------------------------------------------------
-- work_orders: close + redo lineage
-- ---------------------------------------------------------------------------
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS parent_work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_redo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS redo_source_appointment_id UUID REFERENCES work_order_appointments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_redo_source_appointment
  ON work_orders (redo_source_appointment_id)
  WHERE redo_source_appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_work_orders_parent_work_order_id
  ON work_orders (parent_work_order_id);

CREATE INDEX IF NOT EXISTS ix_work_orders_is_closed
  ON work_orders (is_closed);

-- ---------------------------------------------------------------------------
-- appointment_status_enum: add redo (idempotent pattern)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'appointment_status_enum' AND e.enumlabel = 'redo'
  ) THEN
    ALTER TYPE appointment_status_enum ADD VALUE 'redo';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- work_order_status_enum: add refunded (idempotent pattern)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'work_order_status_enum' AND e.enumlabel = 'refunded'
  ) THEN
    ALTER TYPE work_order_status_enum ADD VALUE 'refunded';
  END IF;
END$$;

-- Prod order: (1) supabase_work_order_add_closed_status_enum.sql
--             (2) this file
--             (3) supabase_work_order_status_closed_backfill.sql
