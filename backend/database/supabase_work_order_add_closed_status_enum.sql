-- STEP 1 of 3 — Run this query ALONE in Supabase (click Run once; wait for success).
-- Next: supabase_work_order_close_redo.sql, then supabase_work_order_status_closed_backfill.sql
-- Do NOT include the backfill UPDATE in the same run (Postgres 55P04 / rolled-back enum).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'work_order_status_enum' AND e.enumlabel = 'closed'
  ) THEN
    ALTER TYPE work_order_status_enum ADD VALUE 'closed';
  END IF;
END$$;

-- Confirm (optional):
-- SELECT e.enumlabel FROM pg_enum e
-- JOIN pg_type t ON e.enumtypid = t.oid
-- WHERE t.typname = 'work_order_status_enum'
-- ORDER BY e.enumsortorder;
