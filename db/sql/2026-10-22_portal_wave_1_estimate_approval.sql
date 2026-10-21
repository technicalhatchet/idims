-- Portal Wave 1A: client estimate approvals (signature + snapshot on Drive).

BEGIN;

CREATE TABLE IF NOT EXISTS estimate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_login_id uuid NULL REFERENCES client_logins(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'declined')),
  signer_name text NULL,
  signature_drive_file_id text NULL,
  estimate_total numeric(12, 2) NOT NULL,
  estimate_content_hash text NOT NULL,
  estimate_pdf_drive_file_id text NULL,
  decline_reason text NULL,
  ip text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimate_approvals_work_order_id_idx
  ON estimate_approvals (work_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS estimate_approvals_client_id_idx
  ON estimate_approvals (client_id);

COMMENT ON TABLE estimate_approvals IS
  'Portal estimate approve/decline audit; multiple rows per WO when estimate hash changes or decline then approve.';

COMMIT;
