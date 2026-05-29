-- Run in Supabase SQL Editor (after supabase_dma_tags.sql)
-- Phase 2c.1: add categories + confidence tags

ALTER TABLE dma_tags ADD COLUMN IF NOT EXISTS category VARCHAR(32);

DELETE FROM dma_tags WHERE slug IN ('heater', 'valve', 'vent');

UPDATE dma_tags SET category = 'system' WHERE slug IN (
  'drain', 'drain_pump', 'compressor', 'frost', 'evap_fan', 'control_board',
  'pressure_hose', 'thermistor', 'inlet_valve', 'door_latch', 'heating_element',
  'igniter', 'belt', 'motor', 'inverter_board', 'wiring', 'capacitor', 'fan_motor',
  'ice_maker', 'sensor', 'pump', 'filter', 'detergent', 'sealed_system',
  'defrost_timer', 'relay', 'airflow'
);

UPDATE dma_tags SET category = 'symptom' WHERE slug IN (
  'leak', 'no_cool', 'not_draining', 'not_heating', 'not_spinning', 'intermittent',
  'noisy', 'dead', 'restriction'
);

UPDATE dma_tags SET category = 'failure' WHERE slug IN ('clogged');

UPDATE dma_tags SET category = 'action' WHERE slug IN ('replaced', 'cleaned', 'cleared');

INSERT INTO dma_tags (slug, label, category) VALUES
  ('confirmed_failure', 'Confirmed failure', 'confidence'),
  ('suspected_failure', 'Suspected failure', 'confidence'),
  ('repeat_failure', 'Repeat failure', 'confidence'),
  ('callback', 'Callback', 'confidence'),
  ('verified_repair', 'Verified repair', 'confidence'),
  ('temporary_fix', 'Temporary fix', 'confidence')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;

UPDATE dma_tags SET category = 'system' WHERE category IS NULL;

CREATE INDEX IF NOT EXISTS ix_dma_tags_category ON dma_tags (category);
