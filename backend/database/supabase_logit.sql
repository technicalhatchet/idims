-- LoGiT — multi-project field feedback capture
-- Run in Supabase SQL Editor (or psql). Safe to re-run where noted.

BEGIN;

CREATE TABLE IF NOT EXISTS logit_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_logit_projects_user_id ON logit_projects (user_id);
CREATE INDEX IF NOT EXISTS ix_logit_projects_created_at ON logit_projects (created_at DESC);

CREATE TABLE IF NOT EXISTS logit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES logit_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  type TEXT,
  category TEXT,
  severity TEXT,
  frequency TEXT,

  title TEXT,
  description TEXT,
  impact TEXT,
  suggested_fix TEXT,

  original_transcript TEXT NOT NULL,

  ai_title TEXT,
  ai_description TEXT,
  ai_impact TEXT,
  ai_suggested_fix TEXT,

  ai_confidence NUMERIC(4, 3),
  ai_model TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE INDEX IF NOT EXISTS ix_logit_entries_user_id ON logit_entries (user_id);
CREATE INDEX IF NOT EXISTS ix_logit_entries_project_id ON logit_entries (project_id);
CREATE INDEX IF NOT EXISTS ix_logit_entries_created_at ON logit_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_logit_entries_project_status ON logit_entries (project_id, status);

ALTER TABLE logit_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE logit_entries ENABLE ROW LEVEL SECURITY;

-- Direct PostgREST/anon access is blocked; FastAPI uses service role with per-user checks.
DROP POLICY IF EXISTS logit_projects_deny_public ON logit_projects;
CREATE POLICY logit_projects_deny_public ON logit_projects
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS logit_entries_deny_public ON logit_entries;
CREATE POLICY logit_entries_deny_public ON logit_entries
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
