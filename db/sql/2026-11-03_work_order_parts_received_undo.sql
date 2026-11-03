-- Undo for 2026-11-03_work_order_parts_received.sql
-- Postgres can't drop a single enum value, so the value stays in the type.
-- This moves any jobs off it so the old code never sees it. Date: 2026-11-03

UPDATE work_orders
   SET status = 'waiting_on_parts', updated_at = now()
 WHERE status = 'parts_received';
