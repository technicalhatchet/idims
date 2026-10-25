-- Maintenance reminder catalog + per-appliance schedules + client email prefs

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS maintenance_emails_opt_out BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_maintenance_email_at TIMESTAMP WITHOUT TIME ZONE;

CREATE TABLE IF NOT EXISTS maintenance_task_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_type VARCHAR(50) NOT NULL,
    equipment_subtype VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    interval_months INTEGER NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('diy', 'service')),
    how_to_text TEXT,
    parts_search_term VARCHAR(120),
    bookable_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_appliance_maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appliance_id UUID NOT NULL REFERENCES client_appliances(id) ON DELETE CASCADE,
    task_definition_id UUID NOT NULL REFERENCES maintenance_task_definitions(id) ON DELETE CASCADE,
    last_done_at TIMESTAMP WITHOUT TIME ZONE,
    next_due_at DATE NOT NULL,
    snoozed_until DATE,
    disabled_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (appliance_id, task_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_camt_appliance_id ON client_appliance_maintenance_tasks(appliance_id);
CREATE INDEX IF NOT EXISTS idx_camt_next_due ON client_appliance_maintenance_tasks(next_due_at);

INSERT INTO maintenance_task_definitions (
    id, equipment_type, equipment_subtype, name, interval_months, kind, how_to_text, parts_search_term, sort_order
) VALUES
    (
        'a1000001-0000-4000-8000-000000000001',
        'appliance', 'refrigerator',
        'Replace water filter', 6, 'diy',
        'Turn off water supply if needed, twist out the old filter, install the OEM replacement, and run a few gallons to clear air.',
        'water filter', 10
    ),
    (
        'a1000001-0000-4000-8000-000000000002',
        'appliance', 'refrigerator',
        'Clean condenser coils', 12, 'diy',
        'Unplug the unit, pull it forward safely, vacuum dust from the coils at the rear or behind the toe grille, and restore airflow clearance.',
        NULL, 20
    ),
    (
        'a1000001-0000-4000-8000-000000000003',
        'appliance', 'dryer',
        'Dryer vent cleaning', 12, 'service',
        'Professional vent cleaning reduces fire risk and improves drying performance. Book a service visit when due.',
        NULL, 30
    ),
    (
        'a1000001-0000-4000-8000-000000000004',
        'appliance', 'dishwasher',
        'Clean dishwasher filter', 3, 'diy',
        'Remove and rinse the filter assembly under warm water; clear debris from the sump area before reinstalling.',
        NULL, 40
    ),
    (
        'a1000001-0000-4000-8000-000000000005',
        'appliance', 'washing_machine',
        'Washer tub clean + door gasket care', 3, 'diy',
        'Run a tub clean cycle with washer cleaner, then wipe the door gasket and leave the door open to dry.',
        NULL, 50
    ),
    (
        'a1000001-0000-4000-8000-000000000006',
        'appliance', 'range_hood',
        'Clean or replace range hood filter', 6, 'diy',
        'Remove metal mesh or charcoal filters; wash mesh filters with degreaser or replace disposable filters.',
        'range hood filter', 60
    )
ON CONFLICT (id) DO NOTHING;
