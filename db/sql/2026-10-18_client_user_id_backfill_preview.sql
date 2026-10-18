-- Phase 2e: read-only preview for clients.user_id backfill (run in Supabase SQL editor).
-- Supabase shows only the last statement result — this file ends with one combined report.

SELECT *
FROM (
  SELECT
    'backfill_candidate'::text AS report_section,
    c.id AS client_id,
    c.auth0_user_id,
    c.user_id AS client_user_id,
    u.id AS matching_users_id,
    u.auth_id AS matching_users_auth_id,
    NULL::text AS conflict_note
  FROM clients c
  INNER JOIN users u ON u.auth_id = c.auth0_user_id
  WHERE c.auth0_user_id IS NOT NULL
    AND c.user_id IS NULL

  UNION ALL

  SELECT
    'placeholder_repoint_candidate'::text AS report_section,
    c.id AS client_id,
    c.auth0_user_id,
    c.user_id AS client_user_id,
    real_u.id AS matching_users_id,
    real_u.auth_id AS matching_users_auth_id,
    ('placeholder auth_id=' || placeholder.auth_id)::text AS conflict_note
  FROM clients c
  INNER JOIN users placeholder ON placeholder.id = c.user_id
    AND placeholder.auth_id LIKE 'client|%'
  INNER JOIN users real_u ON real_u.auth_id = c.auth0_user_id
  WHERE c.auth0_user_id IS NOT NULL

  UNION ALL

  SELECT
    'user_id_conflict'::text AS report_section,
    c.id AS client_id,
    c.auth0_user_id,
    c.user_id AS client_user_id,
    u.id AS matching_users_id,
    u.auth_id AS matching_users_auth_id,
    'clients.user_id points at users row whose auth_id differs from clients.auth0_user_id (non-placeholder)'::text AS conflict_note
  FROM clients c
  INNER JOIN users u ON u.id = c.user_id
  WHERE c.auth0_user_id IS NOT NULL
    AND c.user_id IS NOT NULL
    AND (u.auth_id IS DISTINCT FROM c.auth0_user_id)
    AND u.auth_id NOT LIKE 'client|%'
) report
ORDER BY report_section, client_id;
