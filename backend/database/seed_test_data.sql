-- Create sequences if they don't exist
CREATE SEQUENCE IF NOT EXISTS work_order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Clear existing data
TRUNCATE users, clients, technicians, work_orders, invoices CASCADE;

-- Insert test users
INSERT INTO users (id, email, auth_id, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin2@example.com', 'auth0|admin2', 'admin', 'Admin', 'User', '555-0001', true, NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222', 'manager2@example.com', 'auth0|manager2', 'manager', 'Manager', 'User', '555-0002', true, NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333', 'tech3@example.com', 'auth0|tech3', 'technician', 'Tech', 'Three', '555-0003', true, NOW(), NOW()),
    ('44444444-4444-4444-4444-444444444444', 'tech4@example.com', 'auth0|tech4', 'technician', 'Tech', 'Four', '555-0004', true, NOW(), NOW()),
    ('55555555-5555-5555-5555-555555555555', 'client3@example.com', 'auth0|client3', 'client', 'Client', 'Three', '555-0005', true, NOW(), NOW()),
    ('66666666-6666-6666-6666-666666666666', 'client4@example.com', 'auth0|client4', 'client', 'Client', 'Four', '555-0006', true, NOW(), NOW());

-- Insert test clients
INSERT INTO clients (
    id, user_id, company_name, first_name, last_name, email, phone, mobile,
    address, billing_address, shipping_address, notes, status, source,
    tags, custom_fields, tax_id, payment_terms, credit_limit,
    created_at, updated_at, created_by
)
SELECT 
    gen_random_uuid(),
    id,
    CASE 
        WHEN email = 'client3@example.com' THEN 'ABC Company'
        ELSE 'XYZ Corporation'
    END,
    first_name,
    last_name,
    email,
    '555-0001',
    '555-0002',
    jsonb_build_object(
        'street', CASE WHEN email = 'client3@example.com' THEN '123 Main St' ELSE '456 Oak Ave' END,
        'city', CASE WHEN email = 'client3@example.com' THEN 'Los Angeles' ELSE 'San Francisco' END,
        'state', 'CA',
        'postal_code', CASE WHEN email = 'client3@example.com' THEN '90001' ELSE '94105' END,
        'country', 'USA',
        'latitude', CASE WHEN email = 'client3@example.com' THEN 34.0522 ELSE 37.7749 END,
        'longitude', CASE WHEN email = 'client3@example.com' THEN -118.2437 ELSE -122.4194 END
    ),
    NULL,
    NULL,
    'Test client notes',
    'active',
    'direct',
    '[]'::jsonb,
    '{}'::jsonb,
    'TAX123',
    30,
    10000.00,
    NOW(),
    NOW(),
    '11111111-1111-1111-1111-111111111111'
FROM users WHERE role = 'client';

-- Insert test technicians
INSERT INTO technicians (
    id, user_id, employee_id, skills, certifications, hourly_rate,
    availability, max_daily_jobs, notes, status, service_radius,
    location, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    id,
    'EMP' || SUBSTRING(email FROM 5 FOR 1),
    ARRAY['HVAC', 'Electrical'],
    jsonb_build_object(
        'hvac', ARRAY['CERT001', 'CERT002'],
        'electrical', ARRAY['CERT003']
    ),
    75.00,
    jsonb_build_object(
        'schedule', jsonb_build_object(
            'monday', ARRAY['09:00-17:00'],
            'tuesday', ARRAY['09:00-17:00'],
            'wednesday', ARRAY['09:00-17:00'],
            'thursday', ARRAY['09:00-17:00'],
            'friday', ARRAY['09:00-17:00']
        )
    ),
    6,
    'Test technician notes',
    'active',
    50.0,
    jsonb_build_object(
        'latitude', 34.0522,
        'longitude', -118.2437,
        'last_update', NOW()
    ),
    NOW(),
    NOW()
FROM users WHERE role = 'technician';

-- Insert test work orders
WITH client_data AS (
    SELECT c.id as client_id
    FROM clients c
    JOIN users u ON c.user_id = u.id
    WHERE u.email = 'client3@example.com'
),
tech_data AS (
    SELECT t.id as tech_id
    FROM technicians t
    JOIN users u ON t.user_id = u.id
    WHERE u.email = 'tech3@example.com'
)
INSERT INTO work_orders (
    id, order_number, client_id, title, description, priority,
    status, service_location, scheduled_start, scheduled_end,
    assigned_technician_id, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    'WO-' || nextval('work_order_number_seq'),
    client_id,
    'Test Work Order',
    'This is a test work order description',
    'medium',
    'pending',
    jsonb_build_object(
        'address', '123 Main St',
        'city', 'Los Angeles',
        'state', 'CA',
        'postal_code', '90001'
    ),
    NOW() + interval '1 day',
    NOW() + interval '1 day' + interval '2 hours',
    tech_id,
    '11111111-1111-1111-1111-111111111111',
    NOW(),
    NOW()
FROM client_data, tech_data;

-- Insert test invoices
WITH client_data AS (
    SELECT c.id as client_id
    FROM clients c
    JOIN users u ON c.user_id = u.id
    WHERE u.email = 'client3@example.com'
),
work_order_data AS (
    SELECT id as work_order_id
    FROM work_orders
    WHERE client_id = (SELECT client_id FROM client_data)
    LIMIT 1
)
INSERT INTO invoices (
    id, invoice_number, client_id, work_order_id, status,
    issue_date, due_date, subtotal, tax, discount,
    total, amount_paid, balance, notes, terms,
    metadata_json, payment_instructions, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    'INV-' || nextval('invoice_number_seq'),
    client_id,
    work_order_id,
    'draft',
    NOW(),
    NOW() + interval '30 days',
    1000.00,
    80.00,
    50.00,
    1030.00,
    0.00,
    1030.00,
    'Test invoice notes',
    'Net 30',
    '{}'::jsonb,
    'Please pay by bank transfer',
    '11111111-1111-1111-1111-111111111111',
    NOW(),
    NOW()
FROM client_data, work_order_data;