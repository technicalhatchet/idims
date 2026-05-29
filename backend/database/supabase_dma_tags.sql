-- Run in Supabase SQL Editor
-- DMA repair tags (manual tagging for outcomes + field records)

CREATE TABLE IF NOT EXISTS dma_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dma_outcome_tags (
  outcome_id UUID NOT NULL REFERENCES dma_repair_outcomes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES dma_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (outcome_id, tag_id)
);

CREATE TABLE IF NOT EXISTS dma_record_tags (
  record_id UUID NOT NULL REFERENCES dma_repair_records(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES dma_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);

CREATE INDEX IF NOT EXISTS ix_dma_outcome_tags_tag_id ON dma_outcome_tags (tag_id);
CREATE INDEX IF NOT EXISTS ix_dma_record_tags_tag_id ON dma_record_tags (tag_id);

INSERT INTO dma_tags (slug, label) VALUES
  ('drain', 'Drain'),
  ('drain_pump', 'Drain pump'),
  ('compressor', 'Compressor'),
  ('frost', 'Frost / defrost'),
  ('evap_fan', 'Evap fan'),
  ('control_board', 'Control board'),
  ('pressure_hose', 'Pressure hose'),
  ('thermistor', 'Thermistor'),
  ('inlet_valve', 'Inlet valve'),
  ('door_latch', 'Door latch'),
  ('heating_element', 'Heating element'),
  ('igniter', 'Igniter'),
  ('belt', 'Belt'),
  ('motor', 'Motor'),
  ('inverter_board', 'Inverter board'),
  ('wiring', 'Wiring / harness'),
  ('capacitor', 'Capacitor'),
  ('fan_motor', 'Fan motor'),
  ('ice_maker', 'Ice maker'),
  ('sensor', 'Sensor'),
  ('pump', 'Pump'),
  ('filter', 'Filter'),
  ('detergent', 'Detergent / suds'),
  ('sealed_system', 'Sealed system'),
  ('defrost_timer', 'Defrost timer'),
  ('relay', 'Relay / overload'),
  ('airflow', 'Airflow'),
  ('leak', 'Leak'),
  ('no_cool', 'No cool'),
  ('not_draining', 'Not draining'),
  ('not_heating', 'Not heating'),
  ('not_spinning', 'Not spinning'),
  ('intermittent', 'Intermittent'),
  ('noisy', 'Noisy'),
  ('dead', 'Dead / no power'),
  ('restriction', 'Restriction'),
  ('clogged', 'Clogged'),
  ('replaced', 'Replaced'),
  ('cleaned', 'Cleaned'),
  ('cleared', 'Cleared')
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label;
