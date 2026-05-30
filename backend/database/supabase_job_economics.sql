-- Job economics: expenses, receipts, mileage, vendors
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS expense_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  vendor_id UUID REFERENCES expense_vendors(id) ON DELETE SET NULL,
  vendor_name VARCHAR(120),
  description VARCHAR(500),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES work_order_expenses(id) ON DELETE SET NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  storage_backend VARCHAR(20) NOT NULL DEFAULT 'local',
  local_path VARCHAR(512),
  drive_file_id VARCHAR(128),
  drive_web_view_link VARCHAR(512),
  drive_folder_id VARCHAR(128),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointment_mileage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES work_order_appointments(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL DEFAULT 'estimated',
  miles NUMERIC(8, 2) NOT NULL DEFAULT 0,
  odometer_start NUMERIC(10, 1),
  odometer_end NUMERIC(10, 1),
  notes VARCHAR(500),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_work_order_expenses_work_order_id ON work_order_expenses (work_order_id);
CREATE INDEX IF NOT EXISTS ix_work_order_expenses_category ON work_order_expenses (category);
CREATE INDEX IF NOT EXISTS ix_expense_receipts_work_order_id ON expense_receipts (work_order_id);
CREATE INDEX IF NOT EXISTS ix_appointment_mileage_work_order_id ON appointment_mileage (work_order_id);

INSERT INTO expense_vendors (slug, name) VALUES
  ('marcone', 'Marcone'),
  ('dey', 'Dey'),
  ('encompass', 'Encompass'),
  ('amazon', 'Amazon'),
  ('home_depot', 'Home Depot'),
  ('tribles', 'Tribles'),
  ('shop_jimmy', 'ShopJimmy'),
  ('sears', 'Sears'),
  ('parts_select', 'PartsSelect'),
  ('other', 'Other')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;
