ALTER TABLE work_order_appointments DROP COLUMN IF EXISTS appointment_reminder_sent_at;
ALTER TABLE work_orders DROP COLUMN IF EXISTS review_due_at;
ALTER TABLE clients DROP COLUMN IF EXISTS is_test_client;
DELETE FROM settings WHERE key IN ('customer_outreach_test_mode', 'worker_feature_flags');
