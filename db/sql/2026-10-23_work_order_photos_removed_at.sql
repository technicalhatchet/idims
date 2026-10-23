-- Soft-delete customer portal media (exclude from limits and lists).

BEGIN;

ALTER TABLE work_order_photos
  ADD COLUMN IF NOT EXISTS removed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_work_order_photos_active_customer
  ON work_order_photos (work_order_id, source)
  WHERE removed_at IS NULL AND source = 'customer';

COMMIT;
