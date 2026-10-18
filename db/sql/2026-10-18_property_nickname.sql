-- Optional display nickname for service properties (portal + staff UI).
-- Run BEFORE deploying API that reads properties.nickname.
-- Date: 2026-10-18

BEGIN;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS nickname varchar(60) NULL;

COMMENT ON COLUMN properties.nickname IS
  'Customer-facing label only; scheduling and invoices use address.';

COMMIT;
