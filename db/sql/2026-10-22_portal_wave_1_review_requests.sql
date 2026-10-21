-- Portal Wave 1B: Google review request tracking on work orders.

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz NULL;

COMMENT ON COLUMN work_orders.review_requested_at IS
  'When a portal/Google review request email+notification was sent for this work order.';

COMMIT;
