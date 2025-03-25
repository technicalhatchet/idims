-- Initial settings data
INSERT INTO settings (key, value, description, created_at, updated_at)
VALUES 
('company_info', '{"name": "Your Service Company", "address": "123 Main St", "city": "Anytown", "state": "CA", "postal_code": "12345", "phone": "555-123-4567", "email": "contact@yourcompany.com", "website": "yourcompany.com", "tax_id": "12-3456789"}', 'Company information for documents and client portal', NOW(), NOW()),
('tax_rates', '[{"name": "Sales Tax", "rate": 8.25, "default": true}, {"name": "No Tax", "rate": 0, "default": false}]', 'Available tax rates', NOW(), NOW()),
('work_order_settings', '{"auto_number_prefix": "WO-", "auto_number_start": 1001}', 'Work order numbering settings', NOW(), NOW()),
('invoice_settings', '{"auto_number_prefix": "INV-", "auto_number_start": 1001, "payment_terms": "Net 30", "late_fee_percentage": 1.5}', 'Invoice numbering and terms', NOW(), NOW()),
('quote_settings', '{"auto_number_prefix": "QT-", "auto_number_start": 1001, "valid_days": 30, "terms": "Terms and conditions..."}', 'Quote numbering and terms', NOW(), NOW()),
('notification_settings', '{"appointment_reminder_hours": 24, "follow_up_days": 3}', 'Default notification timings', NOW(), NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();