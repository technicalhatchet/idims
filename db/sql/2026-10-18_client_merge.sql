-- Phase 2f: admin client merge metadata (run before deploying merge API).
-- Date: 2026-10-18

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS merged_into_client_id uuid NULL
    REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS clients_merged_into_client_id_idx
  ON clients (merged_into_client_id)
  WHERE merged_into_client_id IS NOT NULL;

COMMENT ON COLUMN clients.merged_into_client_id IS
  'When set, this client row was merged into the survivor; excluded from search and portal linking.';
COMMENT ON COLUMN clients.merged_at IS
  'When the merge into merged_into_client_id was completed.';

CREATE TABLE IF NOT EXISTS client_merge_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keep_client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  merge_client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  merged_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  merged_at timestamptz NOT NULL DEFAULT now(),
  field_choices jsonb NOT NULL DEFAULT '{}'::jsonb,
  moved jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS client_merge_audits_keep_client_id_idx
  ON client_merge_audits (keep_client_id);
CREATE INDEX IF NOT EXISTS client_merge_audits_merge_client_id_idx
  ON client_merge_audits (merge_client_id);

COMMENT ON TABLE client_merge_audits IS
  'Immutable record of admin client merges (repointed row ids in moved).';

COMMIT;
