-- Undo: property nickname column (redeploy app without nickname support first).
-- Date: 2026-10-18

BEGIN;

ALTER TABLE properties
  DROP COLUMN IF EXISTS nickname;

COMMIT;
