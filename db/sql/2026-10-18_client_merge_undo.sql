-- Undo phase 2f client merge schema (does not reverse data merges).

BEGIN;

DROP TABLE IF EXISTS client_merge_audits;

DROP INDEX IF EXISTS clients_merged_into_client_id_idx;

ALTER TABLE clients
  DROP COLUMN IF EXISTS merged_at,
  DROP COLUMN IF EXISTS merged_into_client_id;

COMMIT;
