DROP TABLE IF EXISTS appliance_lifespan_ranges;

ALTER TABLE client_appliances
    DROP COLUMN IF EXISTS manufacture_year,
    DROP COLUMN IF EXISTS manufacture_month,
    DROP COLUMN IF EXISTS manufacture_decode_rule,
    DROP COLUMN IF EXISTS manufacture_decode_confidence,
    DROP COLUMN IF EXISTS manufacture_decoded_at;
