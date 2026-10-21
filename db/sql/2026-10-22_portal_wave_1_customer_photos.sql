-- Portal Wave 1C: customer-uploaded work order media.

BEGIN;

ALTER TABLE work_order_photos
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff'
    CHECK (source IN ('staff', 'customer'));

ALTER TABLE work_order_photos
  ADD COLUMN IF NOT EXISTS client_login_id uuid NULL
    REFERENCES client_logins(id) ON DELETE SET NULL;

COMMENT ON COLUMN work_order_photos.source IS 'staff = TechDeck upload; customer = portal upload.';

COMMIT;
