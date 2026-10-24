-- Customer outreach test mode + worker scheduling columns

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS is_test_client BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE work_orders
    ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE work_order_appointments
    ADD COLUMN IF NOT EXISTS appointment_reminder_sent_at TIMESTAMP WITHOUT TIME ZONE;

INSERT INTO settings (key, value, description, updated_at)
VALUES (
    'customer_outreach_test_mode',
    '{"enabled": true}'::jsonb,
    'When enabled, automatic customer outreach only goes to clients marked as test clients',
    NOW()
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description, updated_at)
VALUES (
    'worker_feature_flags',
    '{}'::jsonb,
    'Celery worker job toggles (all default off when unset)',
    NOW()
)
ON CONFLICT (key) DO NOTHING;
