BEGIN;

ALTER TABLE work_order_photos DROP COLUMN IF EXISTS client_login_id;
ALTER TABLE work_order_photos DROP COLUMN IF EXISTS source;

COMMIT;
