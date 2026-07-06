-- Run in Supabase SQL Editor (or psql)
-- Phase 1: client household appliances registry + portal scheduling flags
-- Safe to re-run: uses IF NOT EXISTS / conditional column adds

BEGIN;

-- ---------------------------------------------------------------------------
-- client_appliances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_appliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  nickname VARCHAR(120),
  equipment_type VARCHAR(50) NOT NULL,
  equipment_subtype VARCHAR(50),
  make VARCHAR(100),
  model VARCHAR(100),
  serial VARCHAR(100),
  equipment_version VARCHAR(100),
  is_wall_mounted BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  photo_urls JSONB,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  merged_into_id UUID REFERENCES client_appliances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_client_appliances_client_id
  ON client_appliances (client_id);

CREATE INDEX IF NOT EXISTS ix_client_appliances_property_id
  ON client_appliances (property_id);

CREATE INDEX IF NOT EXISTS ix_client_appliances_client_active
  ON client_appliances (client_id)
  WHERE is_active = TRUE AND merged_into_id IS NULL;

-- ---------------------------------------------------------------------------
-- work_orders.appliance_id
-- ---------------------------------------------------------------------------
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS appliance_id UUID REFERENCES client_appliances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_work_orders_appliance_id
  ON work_orders (appliance_id);

-- ---------------------------------------------------------------------------
-- clients: portal flags
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS self_scheduling_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS appliances_import_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run manually if you need to undo)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE clients DROP COLUMN IF EXISTS appliances_import_completed;
-- ALTER TABLE clients DROP COLUMN IF EXISTS self_scheduling_blocked;
-- DROP INDEX IF EXISTS ix_work_orders_appliance_id;
-- ALTER TABLE work_orders DROP COLUMN IF EXISTS appliance_id;
-- DROP INDEX IF EXISTS ix_client_appliances_client_active;
-- DROP INDEX IF EXISTS ix_client_appliances_property_id;
-- DROP INDEX IF EXISTS ix_client_appliances_client_id;
-- DROP TABLE IF EXISTS client_appliances;
-- COMMIT;
