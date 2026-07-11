-- Optional visit link on work-order notes (Diagnostic Results, etc.)
ALTER TABLE work_order_notes
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES work_order_appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_work_order_notes_appointment_id
  ON work_order_notes (appointment_id);
