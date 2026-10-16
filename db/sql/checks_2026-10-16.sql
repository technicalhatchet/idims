-- Read-only checks for portal account linking (run in Supabase SQL editor).
-- Date: 2026-10-16

-- (c) Confirm auth0_user_id column exists on clients (information_schema).
SELECT
  column_name,
  data_type,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name IN ('auth0_user_id', 'email', 'phone', 'mobile')
ORDER BY column_name;

-- (a) Every client with Auth0 link (verify email_verified in Auth0 dashboard per auth0_user_id).
SELECT
  id,
  first_name || ' ' || last_name AS name,
  email,
  auth0_user_id
FROM clients
WHERE auth0_user_id IS NOT NULL
  AND TRIM(auth0_user_id) <> ''
ORDER BY updated_at DESC NULLS LAST;

-- (b) Emails shared by more than one client.
SELECT
  LOWER(TRIM(email)) AS email,
  COUNT(*) AS client_count,
  ARRAY_AGG(id ORDER BY created_at) AS client_ids
FROM clients
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1
ORDER BY client_count DESC;

-- (b) Placeholder or fake-looking booking emails.
SELECT
  id,
  first_name || ' ' || last_name AS name,
  email,
  auth0_user_id,
  created_at
FROM clients
WHERE LOWER(email) LIKE '%@noreply.atomicrepair419.com'
   OR LOWER(email) LIKE 'bookings+%'
   OR LOWER(email) LIKE '%noemail%'
   OR LOWER(email) LIKE '%fake%'
ORDER BY created_at DESC;
