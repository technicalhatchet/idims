-- Phase 2e: set clients.user_id from users.auth_id = clients.auth0_user_id (null user_id),
-- and repoint clients stuck on staff placeholder users (auth_id 'client|...').
-- Run after deploying API that sets user_id on new links. Review preview script first.

CREATE SCHEMA IF NOT EXISTS backups;
REVOKE ALL ON SCHEMA backups FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA backups FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA backups REVOKE ALL ON TABLES FROM anon, authenticated;

CREATE TABLE backups.clients_user_id_2026_10_18 AS
SELECT c.id, c.user_id, c.auth0_user_id
FROM clients c
INNER JOIN users u ON u.auth_id = c.auth0_user_id
WHERE c.auth0_user_id IS NOT NULL
  AND c.user_id IS NULL;

CREATE TABLE backups.clients_user_id_placeholder_repoint_2026_10_18 AS
SELECT
  c.id AS client_id,
  c.user_id AS old_user_id,
  real_u.id AS new_user_id,
  c.auth0_user_id
FROM clients c
INNER JOIN users placeholder ON placeholder.id = c.user_id
  AND placeholder.auth_id LIKE 'client|%'
INNER JOIN users real_u ON real_u.auth_id = c.auth0_user_id
WHERE c.auth0_user_id IS NOT NULL;

CREATE TABLE backups.notifications_user_id_placeholder_repoint_2026_10_18 AS
SELECT n.id AS row_id, n.user_id AS old_user_id, b.client_id
FROM notifications n
INNER JOIN backups.clients_user_id_placeholder_repoint_2026_10_18 b
  ON n.user_id = b.old_user_id;

CREATE TABLE backups.push_subscriptions_user_id_placeholder_repoint_2026_10_18 AS
SELECT ps.id AS row_id, ps.user_id AS old_user_id, b.client_id
FROM push_subscriptions ps
INNER JOIN backups.clients_user_id_placeholder_repoint_2026_10_18 b
  ON ps.user_id = b.old_user_id;

CREATE TABLE backups.documents_user_id_placeholder_repoint_2026_10_18 AS
SELECT d.id AS row_id, d.user_id AS old_user_id, b.client_id
FROM documents d
INNER JOIN backups.clients_user_id_placeholder_repoint_2026_10_18 b
  ON d.user_id = b.old_user_id;

UPDATE notifications n
SET user_id = b.new_user_id
FROM backups.clients_user_id_placeholder_repoint_2026_10_18 b
WHERE n.user_id = b.old_user_id;

UPDATE push_subscriptions ps
SET user_id = b.new_user_id
FROM backups.clients_user_id_placeholder_repoint_2026_10_18 b
WHERE ps.user_id = b.old_user_id;

UPDATE documents d
SET user_id = b.new_user_id
FROM backups.clients_user_id_placeholder_repoint_2026_10_18 b
WHERE d.user_id = b.old_user_id;

UPDATE clients c
SET user_id = b.new_user_id
FROM backups.clients_user_id_placeholder_repoint_2026_10_18 b
WHERE c.id = b.client_id;

UPDATE clients c
SET user_id = u.id
FROM users u
WHERE u.auth_id = c.auth0_user_id
  AND c.auth0_user_id IS NOT NULL
  AND c.user_id IS NULL;

SELECT COUNT(*) AS linked_clients_with_user_id
FROM clients
WHERE auth0_user_id IS NOT NULL
  AND user_id IS NOT NULL;
