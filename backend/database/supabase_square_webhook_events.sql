-- Square webhook dedupe (Tap to Pay safety net), 2026-11-05.
-- Run in Supabase (test DB, then prod) before deploying the webhook route.

CREATE TABLE IF NOT EXISTS square_webhook_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
