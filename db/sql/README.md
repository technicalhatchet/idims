# Database schema changes (Supabase)

IDIMS does **not** use Alembic for production schema. Every intentional change to the live database is recorded here as SQL you review and run manually in the Supabase SQL editor.

## Conventions

| Rule | Detail |
|------|--------|
| Forward script | `YYYY-MM-DD_short_description.sql` (date = day you intend to run it) |
| Undo script | Same basename + `_undo.sql` |
| Reports / audits | `reports/` or `*_audit.sql` — **read-only**, safe to run anytime |
| Table names | Use underscores only (no hyphens) |
| Legacy columns | Forward scripts must not rename or drop existing columns unless explicitly approved |
| **Backup tables** | Always in schema `backups`, never `public` (keeps them off Supabase Data API). Create schema once per migration script if needed, then `REVOKE ALL ON SCHEMA backups FROM anon, authenticated` (and revoke on tables / default privileges). Backup table names must be unique; use plain `CREATE TABLE` (no `DROP`) so a re-run fails instead of overwriting. |

## Workflow

1. **Read-only first** — Run report/audit SQL (`reports/`, `*_audit.sql`, `*_preview.sql`) to see baseline and bad rows.
2. **Additive schema** — Run forward SQL that adds columns or tables (with defaults so existing rows are valid).
3. **Deploy application code** that depends on new columns — only **after** step 2 succeeds.
4. **Data migration** — Normalize or backfill data (often after code that writes canonical formats is live).
5. **Verify** — Re-run report SQL.

Supabase SQL editor shows **only the last statement’s result** in a multi-statement script. Use one combined `SELECT` per report file, or separate files for preview vs migrate.

## Deploy order (contact data — Step 1)

| Step | Action | Notes |
|------|--------|--------|
| 1 | `reports/2026-10-17_contact_data_readiness.sql` | Baseline (single result set) |
| 2 | `2026-10-17_normalize_phones_audit.sql` | Unnormalizable values |
| 3 | **`2026-10-17_client_sms_consent.sql`** | **Required before app deploy** — ORM will map `sms_consent*` columns |
| 4 | Deploy backend + frontend (contact-data feature) | |
| 5 | Fix rows flagged in step 2 manually | |
| 6 | `2026-10-17_normalize_phones_preview.sql` | Review before/after (read-only) |
| 7 | `2026-10-17_normalize_phones.sql` | `backups.clients_phone_backup_20261017` + UPDATE + counts |
| 8 | Re-run readiness report | |

Optional: `reports/2026-10-17_public_schema_backup_tables.sql` to find legacy `public.*backup*` tables.

## Deploy order (portal accounts — Step 2)

| Step | Action | Notes |
|------|--------|--------|
| 1 | `2026-10-17_client_portal_booking_payment_waived.sql` | If not already run — before app reads `portal_booking_payment_waived` |
| 2 | Deploy **phase 2.0** (auth hardening) | Merged via PR #34 |
| 3 | `2026-10-17_client_appliance_verified_preview.sql` | Counts / backfill scope (read-only) |
| 4 | **`2026-10-17_client_appliance_verified.sql`** | **Before phase 2a app deploy** — columns + `staff`/`manual` backfill |
| 5 | Deploy backend + frontend (phase 2a) | Verify API + portal badges |

| 6 | **`2026-10-17_client_portal_claims.sql`** | **Before phase 2b app deploy** — claim tokens for portal invites |
| 7 | Deploy backend + frontend (phase 2b) | |
| 8 | **`2026-10-17_portal_self_signup.sql`** | **Before phase 2c app deploy** — `portal_profile_completed_at` |
| 9 | Deploy backend + frontend (phase 2c) | Open sign-up + finish-profile |

### Rollback (portal 2c self-signup)

1. Redeploy the **previous** application build.
2. Run `2026-10-17_portal_self_signup_undo.sql`.

### Rollback (portal 2b claims)

1. Redeploy the **previous** application build.
2. Run `2026-10-17_client_portal_claims_undo.sql`.

### Rollback (portal 2a appliance verification)

1. Redeploy the **previous** application build.
2. Run `2026-10-17_client_appliance_verified_undo.sql`.

### Rollback (contact data)

1. Redeploy the **previous** application build (code must not reference removed columns).
2. Run `2026-10-17_client_sms_consent_undo.sql` and/or `2026-10-17_normalize_phones_undo.sql` as needed.
3. Do **not** run `_undo` while new code is still live.

## Undo scripts

- `_undo` for **new** columns: `ALTER TABLE ... DROP COLUMN` for columns introduced in the matching forward script.
- `_undo` for phone normalization: restore from `backups.clients_phone_backup_20261017` only when live values still match post-migration normalized form; skipped rows are listed in the undo script’s final `SELECT`.

## Checking live `clients` columns

```sql
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients'
ORDER BY ordinal_position;
```
