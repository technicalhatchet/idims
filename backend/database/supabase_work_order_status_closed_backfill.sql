-- STEP 3 of 3 — Run only after:
--   1) supabase_work_order_add_closed_status_enum.sql  (adds 'closed' to work_order_status_enum)
--   2) supabase_work_order_close_redo.sql              (adds is_closed column + redo columns)
--
-- Syncs legacy rows that were administratively closed (is_closed=TRUE) to status='closed'.
-- On a fresh prod with no prior closes, this updates 0 rows — that is expected.

UPDATE work_orders
SET status = 'closed'
WHERE is_closed = TRUE
  AND status::text = 'completed';
