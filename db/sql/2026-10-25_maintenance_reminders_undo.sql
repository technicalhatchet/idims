DROP TABLE IF EXISTS client_appliance_maintenance_tasks;
DROP TABLE IF EXISTS maintenance_task_definitions;

ALTER TABLE clients
    DROP COLUMN IF EXISTS last_maintenance_email_at,
    DROP COLUMN IF EXISTS maintenance_emails_opt_out;
