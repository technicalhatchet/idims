-- Manufacture decode columns + typical lifespan reference table

ALTER TABLE client_appliances
    ADD COLUMN IF NOT EXISTS manufacture_year INTEGER,
    ADD COLUMN IF NOT EXISTS manufacture_month INTEGER,
    ADD COLUMN IF NOT EXISTS manufacture_decode_rule VARCHAR(40),
    ADD COLUMN IF NOT EXISTS manufacture_decode_confidence VARCHAR(10),
    ADD COLUMN IF NOT EXISTS manufacture_decoded_at TIMESTAMP WITHOUT TIME ZONE;

CREATE TABLE IF NOT EXISTS appliance_lifespan_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_type VARCHAR(50) NOT NULL,
    equipment_subtype VARCHAR(50),
    typical_min_years INTEGER NOT NULL,
    typical_max_years INTEGER NOT NULL,
    notes TEXT,
    UNIQUE (equipment_type, equipment_subtype)
);

INSERT INTO appliance_lifespan_ranges (equipment_type, equipment_subtype, typical_min_years, typical_max_years, notes)
VALUES
    ('appliance', 'refrigerator', 10, 18, 'Varies with maintenance and usage'),
    ('appliance', 'washing_machine', 8, 12, NULL),
    ('appliance', 'dryer', 10, 13, NULL),
    ('appliance', 'electric_dryer', 10, 13, NULL),
    ('appliance', 'gas_dryer', 10, 13, NULL),
    ('appliance', 'dishwasher', 8, 12, NULL),
    ('appliance', 'electric_range', 12, 15, NULL),
    ('appliance', 'gas_range', 12, 15, NULL),
    ('appliance', 'oven', 12, 15, NULL),
    ('appliance', 'microwave', 7, 10, NULL),
    ('appliance', 'freezer', 10, 15, NULL),
    ('appliance', NULL, 8, 15, 'Generic appliance fallback')
ON CONFLICT DO NOTHING;
