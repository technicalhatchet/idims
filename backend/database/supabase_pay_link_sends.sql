-- Pay link send log (Awaiting Pay list: "Texted 3d ago"), 2026-11-06.
-- Run in Supabase before deploying the backend. Safe to re-run.

CREATE TABLE IF NOT EXISTS pay_link_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('text', 'email', 'copy', 'qr')),
  sent_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_link_sends_wo_sent
  ON pay_link_sends (work_order_id, sent_at DESC);
