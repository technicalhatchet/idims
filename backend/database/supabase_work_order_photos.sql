-- Work order field photos (Notes tab)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS work_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  description VARCHAR(500),
  is_model_sn_tag BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS ix_work_order_photos_work_order_id ON work_order_photos (work_order_id);
CREATE INDEX IF NOT EXISTS ix_work_order_photos_created_at ON work_order_photos (created_at DESC);
