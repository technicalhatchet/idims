-- Staff-on-behalf estimate decisions (admin portal preview, unlocked)
ALTER TABLE estimate_approvals
  ADD COLUMN IF NOT EXISTS decision_source VARCHAR(32) NOT NULL DEFAULT 'customer';

ALTER TABLE estimate_approvals
  ADD COLUMN IF NOT EXISTS staff_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE estimate_approvals
  ADD COLUMN IF NOT EXISTS staff_user_name TEXT NULL;

ALTER TABLE estimate_approvals
  ADD COLUMN IF NOT EXISTS staff_note TEXT NULL;
