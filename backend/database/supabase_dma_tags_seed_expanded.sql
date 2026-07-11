-- Expanded DMA repair tag catalog (run in Supabase SQL Editor)
-- Requires: supabase_dma_tags.sql (creates dma_tags table)
-- Safe to re-run: upserts by slug

ALTER TABLE dma_tags ADD COLUMN IF NOT EXISTS category VARCHAR(32);

CREATE INDEX IF NOT EXISTS ix_dma_tags_category ON dma_tags (category);

-- ── 1. System tags (component / subsystem) ─────────────────────────────────────
INSERT INTO dma_tags (slug, label, category) VALUES
  ('low_charge', 'Low charge', 'system'),
  ('refrigerant_leak', 'Refrigerant leak', 'system'),
  ('evaporator', 'Evaporator', 'system'),
  ('condenser', 'Condenser', 'system'),
  ('cap_tube', 'Cap tube', 'system'),
  ('filter_drier', 'Filter drier', 'system'),
  ('frost_pattern', 'Frost pattern', 'system'),
  ('no_frost_pattern', 'No frost pattern', 'system'),
  ('partial_frost', 'Partial frost', 'system'),
  ('condenser_fan', 'Condenser fan', 'system'),
  ('damper', 'Damper', 'system'),
  ('air_tower', 'Air tower', 'system'),
  ('restricted_airflow', 'Restricted airflow', 'system'),
  ('defrost_timer', 'Defrost timer', 'system'),
  ('defrost_heater', 'Defrost heater', 'system'),
  ('defrost_thermostat', 'Defrost thermostat', 'system'),
  ('defrost_sensor', 'Defrost sensor', 'system'),
  ('adaptive_defrost', 'Adaptive defrost', 'system'),
  ('ice_buildup', 'Ice buildup', 'system'),
  ('evap_iced_over', 'Evap iced over', 'system'),
  ('dispenser', 'Dispenser', 'system'),
  ('fill_tube', 'Fill tube', 'system'),
  ('overflow', 'Overflow', 'system'),
  ('control_board', 'Control board', 'system'),
  ('ui_board', 'UI board', 'system'),
  ('main_control', 'Main control', 'system'),
  ('sensor', 'Sensor', 'system'),
  ('voltage_issue', 'Voltage issue', 'system'),
  ('power_supply', 'Power supply', 'system'),
  ('bearing', 'Bearing', 'system'),
  ('suspension', 'Suspension', 'system'),
  ('gearcase', 'Gearcase', 'system'),
  ('clutch', 'Clutch', 'system'),
  ('belt', 'Belt', 'system'),
  ('idler', 'Idler', 'system'),
  ('pulley', 'Pulley', 'system'),
  ('blower_wheel', 'Blower wheel', 'system'),
  ('motor', 'Motor', 'system'),
  -- Legacy system tags (kept for existing records)
  ('drain', 'Drain', 'system'),
  ('drain_pump', 'Drain pump', 'system'),
  ('compressor', 'Compressor', 'system'),
  ('frost', 'Frost / defrost', 'system'),
  ('evap_fan', 'Evap fan', 'system'),
  ('pressure_hose', 'Pressure hose', 'system'),
  ('thermistor', 'Thermistor', 'system'),
  ('inlet_valve', 'Inlet valve', 'system'),
  ('door_latch', 'Door latch', 'system'),
  ('heating_element', 'Heating element', 'system'),
  ('igniter', 'Igniter', 'system'),
  ('inverter_board', 'Inverter board', 'system'),
  ('wiring', 'Wiring / harness', 'system'),
  ('capacitor', 'Capacitor', 'system'),
  ('fan_motor', 'Fan motor', 'system'),
  ('ice_maker', 'Ice maker', 'system'),
  ('pump', 'Pump', 'system'),
  ('filter', 'Filter', 'system'),
  ('detergent', 'Detergent / suds', 'system'),
  ('sealed_system', 'Sealed system', 'system'),
  ('relay', 'Relay / overload', 'system'),
  ('airflow', 'Airflow', 'system')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;

-- ── 2. Symptom tags ───────────────────────────────────────────────────────────
INSERT INTO dma_tags (slug, label, category) VALUES
  ('no_cool', 'No cool', 'symptom'),
  ('not_drying', 'Not drying', 'symptom'),
  ('tripping_breaker', 'Tripping breaker', 'symptom'),
  ('display_issue', 'Display issue', 'symptom'),
  ('odor', 'Odor', 'symptom'),
  ('vibration', 'Vibration', 'symptom'),
  ('frost_buildup', 'Frost buildup', 'symptom'),
  ('long_cycle', 'Long cycle', 'symptom'),
  ('slow_ice_production', 'Slow ice production', 'symptom'),
  -- Legacy symptom tags
  ('leak', 'Leak', 'symptom'),
  ('not_draining', 'Not draining', 'symptom'),
  ('not_heating', 'Not heating', 'symptom'),
  ('not_spinning', 'Not spinning', 'symptom'),
  ('wont_stop_spinning', 'Won''t stop spinning', 'symptom'),
  ('intermittent', 'Intermittent', 'symptom'),
  ('noisy', 'Noisy', 'symptom'),
  ('dead', 'Dead / no power', 'symptom'),
  ('restriction', 'Restriction', 'symptom')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;

-- ── 3. Failure type tags ──────────────────────────────────────────────────────
INSERT INTO dma_tags (slug, label, category) VALUES
  ('open', 'Open', 'failure'),
  ('shorted', 'Shorted', 'failure'),
  ('grounded', 'Grounded', 'failure'),
  ('restricted', 'Restricted', 'failure'),
  ('broken', 'Broken', 'failure'),
  ('burnt', 'Burnt', 'failure'),
  ('loose', 'Loose', 'failure'),
  ('corroded', 'Corroded', 'failure'),
  ('miswired', 'Miswired', 'failure'),
  ('out_of_range', 'Out of range', 'failure'),
  ('locked', 'Locked', 'failure'),
  ('seized', 'Seized', 'failure'),
  ('weak', 'Weak', 'failure'),
  ('intermittent_failure', 'Intermittent failure', 'failure'),
  ('communication_failure', 'Communication failure', 'failure'),
  -- Legacy failure tags
  ('clogged', 'Clogged', 'failure')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;

-- ── 4. Repair action tags ─────────────────────────────────────────────────────
INSERT INTO dma_tags (slug, label, category) VALUES
  ('adjusted', 'Adjusted', 'action'),
  ('repaired_wiring', 'Repaired wiring', 'action'),
  ('reprogrammed', 'Reprogrammed', 'action'),
  ('updated_firmware', 'Updated firmware', 'action'),
  ('defrosted', 'Defrosted', 'action'),
  ('vacuumed', 'Vacuumed', 'action'),
  ('leveled', 'Leveled', 'action'),
  ('lubricated', 'Lubricated', 'action'),
  -- Legacy action tags
  ('replaced', 'Replaced', 'action'),
  ('cleaned', 'Cleaned', 'action'),
  ('cleared', 'Cleared', 'action')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;

-- ── 5. Diagnostic confidence tags ─────────────────────────────────────────────
INSERT INTO dma_tags (slug, label, category) VALUES
  ('unable_to_duplicate', 'Unable to duplicate', 'confidence'),
  ('confirmed_failure', 'Confirmed failure', 'confidence'),
  ('suspected_failure', 'Suspected failure', 'confidence'),
  ('repeat_failure', 'Repeat failure', 'confidence'),
  ('callback', 'Callback', 'confidence'),
  ('verified_repair', 'Verified repair', 'confidence'),
  ('temporary_fix', 'Temporary fix', 'confidence')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category;
