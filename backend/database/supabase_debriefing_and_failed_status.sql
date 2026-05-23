-- Run in Supabase SQL Editor
-- Adds appointment status `failed` + work_order_activity_log (Debriefing)

-- 1) Appointment status: failed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'appointment_status_enum'
      AND e.enumlabel = 'failed'
  ) THEN
    ALTER TYPE appointment_status_enum ADD VALUE 'failed';
  END IF;
END $$;

-- 2) Debriefing / activity log table
CREATE TABLE IF NOT EXISTS work_order_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(80) NOT NULL,
  headline VARCHAR(500) NOT NULL,
  actor_label VARCHAR(50) NOT NULL,
  event_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_work_order_activity_log_work_order_id
  ON work_order_activity_log (work_order_id);

CREATE INDEX IF NOT EXISTS ix_work_order_activity_log_created_at
  ON work_order_activity_log (work_order_id, created_at DESC);
