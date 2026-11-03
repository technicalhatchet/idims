-- Adds the "parts_received" work order status (parts are in; book the return visit).
-- Run in Supabase (test DB first, then prod) BEFORE deploying the code that uses it.
-- Date: 2026-11-03
--
-- Postgres can't add an enum value inside a transaction block on older versions,
-- so run this statement on its own.

ALTER TYPE work_order_status_enum ADD VALUE IF NOT EXISTS 'parts_received';

-- Optional, after reviewing 2026-11-03_work_order_parts_received_preview.sql:
-- jobs saved as "Parts on Order" whose parts have actually arrived can be moved over.
-- Replace the id list with the ones you confirm.
--
-- UPDATE work_orders
--    SET status = 'parts_received', updated_at = now()
--  WHERE status = 'parts_on_order'
--    AND id IN ('00000000-0000-0000-0000-000000000000');
