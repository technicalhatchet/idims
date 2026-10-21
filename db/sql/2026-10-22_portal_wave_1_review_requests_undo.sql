BEGIN;

ALTER TABLE work_orders DROP COLUMN IF EXISTS review_requested_at;

COMMIT;
