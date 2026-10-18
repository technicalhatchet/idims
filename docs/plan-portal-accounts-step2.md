# Portal accounts — Step 2 plan

**Date:** 2026-10-17  
**Status:** In progress — phases **2.0**–**2d** shipped; **2e (3a)** implemented in code; **2f** pending  
**Base audit:** [`docs/audit-portal-accounts.md`](./audit-portal-accounts.md) (2026-03-16)  
**Rules:** No Alembic; DB changes via `db/sql/*.sql` + matching `*_undo.sql` (run in Supabase). Do **not** change diagnostic discount or repair credit logic (`portal_scheduling_helpers.apply_tier_pricing`, public booking tier math, or related credit paths).

---

## What changed since the March 2026 audit

| March audit claim | Verified today (Oct 2026) |
|-------------------|---------------------------|
| `get_portal_client` auto-links by email on first API call | **False.** Client users resolve **only** via `clients.auth0_user_id` (`client_portal.py` ~404–412). Linking is explicit `POST /portal/link-account`. |
| `identify-user` sets `auth0_user_id` on client | **False.** `auth.py` ~549–591 returns role hints only; portal linking is **not** done here (`auth_identify.py` ~42–43). |
| Email link without verification | **False.** Verified Auth0 email required for email match; **403** with `EMAIL_VERIFICATION_REQUIRED_MESSAGE` (`client_portal.py` ~560–585, `portal_account_linking.py`). |
| `clients.email` NOT NULL in PostgreSQL | **Stale for planning.** Model has `email` **nullable** (`client.py` ~19). Booking still uses placeholder emails (`public.py` ~543). |
| No SMS consent columns | **False.** `sms_consent`, `sms_consent_at`, `sms_consent_source` on `Client` + SQL `db/sql/2026-10-17_client_sms_consent.sql`. |
| Admin preview allows all writes unchecked | **Partially false.** Mutating portal routes use `require_portal_write` → `assert_portal_write_allowed` (`portal_preview_guard.py`, `client_portal.py` ~174–191). Preview is **locked** unless `X-Portal-Preview-Unlock` JWT from `POST /portal/admin/preview-unlock` (~630+). **Payments always blocked** in preview. **GET** portal routes still work without unlock. |
| No tests for link-account / preview | **False.** `backend/tests/test_portal_security.py` covers linking, placeholder email, invite JWT, preview unlock. |
| Portal create appliance line **1500** | Line drift: portal create is ~1591–1599, `source="portal"`. |

**Still accurate from audit:** No open self-signup → `clients` with `source=self_signup`; single `auth0_user_id` per client; legacy `/api/clients` uses `user_id`; invite = 7-day JWT; portal **GET** properties only; no admin **client** merge; `ClientAppliance.source` exists but portal/staff UI does not label it.

**Shipped contact/booking context (relevant to Step 2):**

- `client_contact.py`, `us_phone.normalize_phone_field`, portal `PUT /portal/me` (~747–811).
- Public `/book` creates/updates clients and properties (`public.py` ~503–599); does not set `clients.source`.
- `portal_booking_payment_waived` column + SQL `db/sql/2026-10-17_client_portal_booking_payment_waived.sql`; staff toggle on `clients/[id]/mobile.js` ~1193–1213.
- Phone normalization SQL under `db/sql/2026-10-17_normalize_phones*.sql`.

---

## Recommended ship order (small phases)

| Phase | Goals | Rationale |
|-------|--------|-----------|
| **2.0** | **Security hardening** | Close account-takeover via email lookup; lock staff-only routers from `client`-role JWTs. **Shipped in code (Oct 2026).** |
| **2a** | **6** Appliance labels (Option B) | `verified_at` / `verified_by` columns; UI labels without overwriting `source`. **Shipped in code (Oct 2026).** |
| **2b** | **4** Claim links (dual JWT + DB) | Safer invites / email-change before scaling signup; old JWTs keep working. **Shipped in code (Oct 2026).** |
| **2c** | **1** Open sign-up + finish profile | Creates `self_signup` clients; still needs at least one property for appliances (2d). **Shipped in code (Oct 2026).** |
| **2d** | **2** Portal properties CRUD | Portal CRUD + nicknames + appliance/schedule flows. **Shipped in code (Oct 2026).** |
| **2e** | **3a** Link `user_id` + staff-only legacy APIs | **Shipped in code (Oct 2026).** **3b** `client_logins` deferred to **step 3 phone login**. |
| **2f** | **5** Admin client merge | Highest blast radius; needs stable linking + claim-link audit patterns. |

---

## Phase 2.0 — Security hardening (implemented)

### What shipped

1. **`AuthHandler.get_current_user`** (`backend/app/core/auth.py`):
   - Email fallback only when `email_verified` is true in the token payload.
   - If a row matches email but `users.auth_id` is set and ≠ token `sub`: **403** + warning log (no account takeover).
   - Adopt-by-email only when `auth_id` is null (then set `auth_id` on update path as today).
   - `HTTPException` (including 403) is no longer wrapped as 401.

2. **`get_staff_user` / `is_staff_user`** (`backend/app/core/dependencies.py`): requires `admin`, `manager`, or `technician`.

3. **Routers gated** (no deeper role checks found in services — guard is at router):

| Router | Prefix | Change |
|--------|--------|--------|
| `properties.py` | `/api/properties` | All routes → `get_staff_user` |
| `job_economics.py` | `/api/job-economics` | Staff routes → `get_staff_user`; monthly report routes unchanged (`get_admin_or_manager_user`) |
| `dma.py` | `/api/dma` | All routes → `get_staff_user` |
| `logit.py` | `/api/logit` | All routes → `get_staff_user` (per-user projects; still staff-only) |
| `diagnostics.py` | `/api/diagnostics` | → `get_staff_user` |
| `stripe.py` | `/api/stripe/stripe/*` | Checkout + session status → `get_staff_user`; webhook unauthenticated; `process-payment` still admin/manager |
| `calendar_blocks.py` | `/api/scheduling/calendar-blocks` | GET list → `get_staff_user`; mutate routes still manager/admin |
| `chat.py` | `/api/chat/chat/*` | HTTP routes → `get_staff_user`; WebSocket `/chat/ws/{user_id}` loads `users` by `auth_id=sub` and closes **1008** unless `is_staff_user` |

### Tests

```bash
cd backend
python -m pytest tests/test_auth_user_email_lookup.py tests/test_staff_api_guards.py tests/test_chat_websocket_staff.py tests/test_portal_security.py -q
```

### Manual checks

---

## Phase 2a — Appliance labels (Option B, implemented)

### What shipped

- SQL: `db/sql/2026-10-17_client_appliance_verified_preview.sql` (read-only), then `2026-10-17_client_appliance_verified.sql` (+ `_undo`) — `verified_by_staff_at`, `verified_by_user_id`; backfill `staff`/`manual` sources. Run order in `db/sql/README.md`.
- API: `customer_source_label` + fields on `serialize_appliance`; `POST /api/clients/{id}/appliances/{id}/verify`; staff create auto-verifies without changing `source`.
- Portal UI: `ApplianceSourceBadge` on list + detail; staff panel **Verify** for `source=portal` rows.

### Tests

```bash
cd backend && python -m pytest tests/test_client_appliance_verified.py -q
```

---

## Phase 2b — Claim links (implemented)

### What shipped

- SQL: `db/sql/2026-10-17_client_portal_claims.sql` (+ `_undo`) — `client_portal_claims` with hashed tokens.
- API: `POST /api/clients/{id}/portal-claims`, `POST /api/work-orders/{id}/portal-claims`, `GET /api/portal/validate-claim`, `link-account` accepts `claim_token` (legacy JWT `invite_token` still works).
- Staff: **Copy portal link** + invite email uses DB claims (`?claim=` on register).
- Register/validate: `claim` or `token` query param; Next `validate-invite` proxies claim validation to API.

### Deploy

Run `2026-10-17_client_portal_claims.sql` in Supabase before deploying API.

### Tests

```bash
cd backend && python -m pytest tests/test_portal_claim_service.py tests/test_portal_security.py -q
```

## Phase 2c — Open sign-up + finish profile (implemented)

### What shipped

- SQL: `db/sql/2026-10-17_portal_self_signup.sql` (+ `_undo`) — `clients.portal_profile_completed_at`.
- API: `link-account` creates `source=self_signup` when verified email has no match (no `client` role until profile done); `GET /portal/signup-status`, `POST /portal/complete-signup`.
- Frontend: `/cxdashboard/finish-profile`; dashboard redirects when `needs_profile`.

### Deploy

Run `2026-10-17_portal_self_signup.sql` in Supabase before deploying API.

### Tests

```bash
cd backend && python -m pytest tests/test_portal_signup.py tests/test_portal_security.py -q
```

### Manual checks (stop here before 2d)

1. New Auth0 user (verified email) → portal → finish profile → dashboard loads after re-login if needed.
2. Existing client / invite / claim paths unchanged.
3. Unverified email → 403 on link-account.

---

### Manual checks (stop here before 2c)

1. Staff → Copy portal link → open in private window → register → link succeeds.
2. Re-open same link → invalid / already used.
3. Legacy JWT `?token=` invite still validates and links until expiry.

---

### Manual checks (stop here before 2b)

1. Run SQL in Supabase, then deploy API + frontend.
2. Portal: customer-added appliance shows **Added by you**; after staff **Verify**, **Verified by Atomic Repair** (`source` still `portal`).
3. Staff-created appliance shows verified label; `source` remains `staff`.

---

### Manual checks (2.0 — after deploy)

1. **Google staff login:** Sign in to the staff app with your Google account → schedule, DMA, properties load as before.
2. **Portal client:** Auth0 user with only `client` role → `GET /api/dma/codes` and `GET /api/properties/client/{id}` return **403** (not 200).
3. **Email takeover regression:** Not practical in prod; covered by unit tests above.

---

Goals **1** and **2** can ship as one release if finish-profile routes users to “add address” before scheduling; splitting keeps rollback simpler.

---

## Goal 1 — Open sign-up

### Current state

**Auth / roles**

- Portal signup: `portalSignUpUrl` → Auth0 `screen_hint=signup` (`cxdashboard/login.js` ~41–43, `portalAuthUrls.js`).
- Auth0 callback assigns **only** staff roles (technician), never `client` (`[...auth0].js` ~23–27, ~139–147).
- `client` role is assigned in `_assign_client_role` during `POST /portal/link-account` (`client_portal.py` ~194–231).

**Linking (no net-new client)**

- `POST /portal/link-account` (`client_portal.py` ~501–626): existing `auth0_user_id` → invite JWT → verified email match (skips placeholder domain per `is_placeholder_client_email`). If no client: **404** “contact support” (~587–591).
- Dashboard auto-calls `postPortalLinkAccount` when user has `client` role or after invite (`cxdashboard/index.js` ~224–266). Users **without** `client` role stop after init (~310–312) — no data load, no forced link retry for signups.

**Profile / NOT NULL names**

- `Client.first_name` / `last_name` are **NOT NULL** (`client.py` ~17–18).
- Public booking supplies names at creation (`public.py` ~531–557); portal-linked staff clients already have names.
- `PUT /portal/me` can update name, phone, mobile, `sms_consent` (`client_portal.py` ~739–811); uses `set_sms_consent` + `normalize_phone_field`. Email is **not** writable here (comment ~754).

**`clients.user_id`**

- Link-account sets `auth0_user_id` only; **does not** set `client.user_id` or create `users` row (only syncs name if `users.auth_id` already exists, ~300–305).
- Portal notifications require `client.user_id` (`client_portal.py` ~839–850) → many portal-linked customers see **empty notifications** even when linked.

**Dependencies**

- `get_portal_client` (~374–418): all `/portal/*` data routes.
- `portalFetch` + `DashboardLayout` / `Topbar` assume `GET /portal/me` succeeds.
- Scheduling: `schedule_svc.*` + appliance `property_id` (`ApplianceFormModal.js` ~39–40 requires property when list non-empty).

**If we build open sign-up without care**

- Duplicate clients if verified email matches an existing row (today: links; new path must not create a second row).
- Auth0 users with unverified email: must not create client (align with `resolve_verified_link_email_from_profile`).
- Placeholder booking emails: must not auto-link new signup to wrong row (same rules as link-account).
- Users could reach portal with `client` role but placeholder names if client row created without finish-profile gate.

### Plan

**Product flow**

1. Auth0 signup/login (email connection today).
2. `POST /portal/link-account` extended **or** new `POST /portal/complete-signup`:
   - If verified email matches existing client → existing link rules (409 if other Auth0).
   - Else if no match → create `Client` with `source='self_signup'`, `auth0_user_id`, verified email, `status='active'`, names **temporary** not allowed — return `{ needs_profile: true }` without assigning `client` role **or** assign role but gate UI on profile flag (prefer **gate before role** to avoid 404 loops).
3. **Finish profile** page `/cxdashboard/finish-profile` (or modal): `first_name`, `last_name`, `mobile` (primary cell), optional “confirm email” read-only from Auth0, `sms_consent` checkbox (reuse `SMS_CONSENT_LABEL` copy from `settings.js` ~13–14).
4. On successful profile submit: persist via dedicated endpoint, set `portal_profile_completed_at` (new column or `custom_fields.portal_profile_completed_at`), assign `client` role, redirect `/cxdashboard`.

**Phone / SMS login readiness (step 3)**

- Add nullable `clients.primary_phone_e164` (or use `mobile` as canonical after normalization) documented as login key later.
- Do **not** key signup on email-only in business logic; encapsulate “resolve identity from Auth0 profile” in `portal_account_linking.py` (add `resolve_auth0_identity(profile) -> { kind: 'email'|'phone', value }`).
- Future: `client_logins` rows `(client_id, provider, subject)` — Goal 3.

**API sketch**

- `POST /portal/complete-signup` — create-or-link + profile in one transaction when body includes name/mobile/consent; idempotent for already-linked users.
- Reuse `PUT /portal/me` fields validation for profile portion after client exists.

**Files touched (expected)**

| Area | Files |
|------|--------|
| Backend | `client_portal.py`, `portal_account_linking.py`, `client_service.py` or small `portal_signup_service.py`, `schemas/client.py` |
| Frontend | `cxdashboard/finish-profile.js`, `cxdashboard/index.js` (redirect if incomplete), `login.js` copy, `portalLink.js`, `[...auth0].js` only if returnTo routing |
| Tests | `test_portal_security.py` + new cases for create self_signup, duplicate email, unverified 403 |

**SQL**

- `db/sql/2026-XX-XX_portal_self_signup.sql`: optional `portal_profile_completed_at timestamptz NULL`; index on `clients(source)` if reporting; comment on `source='self_signup'`.
- `_undo`: drop column.

**Risks**

- Race: two signups same email → DB unique constraint on normalized email **not** present today; use transaction + `SELECT FOR UPDATE` on email lookup or partial unique index (careful with NULL/placeholder emails).
- Marketing copy on `login.js` already promises email linking (~117–121); update when self-signup ships.

**Must ship first**

- Verified-email rules already in prod.
- For scheduling: **Goal 2** (property) or inline “add address” on finish-profile (minimal property create).

**How to test**

- New Auth0 user, verified email, no client → finish profile → `GET /portal/me`, role in token after refresh (`shouldRefreshPortalToken` in `portalLink.js`).
- Existing client same verified email → links, no duplicate row.
- Booking placeholder email client → signup with real email should **not** attach to placeholder row.
- Admin preview: finish-profile writes respect preview lock.
- Regression: invite JWT + verified-email link paths unchanged.

**Out of scope**

- Diagnostic discount / repair credit / `apply_tier_pricing` / priority fee math.

---

## Goal 2 — Properties (portal CRUD) — **Phase 2d shipped**

### What shipped

**SQL (run before deploy)**

- `db/sql/2026-10-18_property_nickname.sql` — `properties.nickname varchar(60)` (optional label; scheduling/invoices still use street address).
- Undo: `2026-10-18_property_nickname_undo.sql`.

**Portal API** (`client_portal.py`, `portal_property_service.py`)

- `GET /portal/properties` — list with stats, `has_service_history`, `address_editable`, `appliance_count`, optional `nickname`.
- `POST` / `PUT` / `DELETE /portal/properties/{id}` — client from `get_portal_client` only; `require_portal_write` on mutations.
- Allowlisted fields: address, unit, type (`residential` \| `rental` \| `commercial`), gate code, access instructions, tenant contact; phone normalized via `normalize_phone_field`. Staff-only `properties.notes` is not exposed or writable via portal.
- Service area: create + address change use `estimate_trip_charge` + `is_address_serviceable` (same as `/book`) → **403** with `OUT_OF_SERVICE_AREA_MESSAGE` when out of zone.
- Duplicate client+address+unit (case/space-insensitive) → **409**.
- Work order history blocks address/unit edits → **400**; delete blocked when WOs or active appliances → **409**.
- Portal appliance `POST`/`PUT`: foreign `property_id` → **404** (`client_appliance_service` ownership).

**UI**

- `/cxdashboard/properties` — list, add, edit, delete; `PropertyFormModal` (portal to `document.body`); service-area hint via public `booking-estimate`.
- Sidebar **My Properties**; dashboard empty-state card for zero properties.
- Appliance form: property picker with nicknames; zero properties → “Add an address first” opens property sheet; single property auto-selected.
- Schedule: missing service address → pick/add property instead of dead-end error.
- Admin preview: same UI; writes blocked until preview unlock (toast on 403).

**Staff / TechDeck**

- Nickname on staff client property forms; list + work order / TechDeck property lines show nickname with muted full address.

**Tests**

- `backend/tests/test_portal_properties.py` (service + route error mapping).
- `test_portal_security.py` — preview locked on `POST /portal/properties`.

### Deploy order (portal 2d)

| Step | Action |
|------|--------|
| 1 | Run `2026-10-18_property_nickname.sql` in Supabase |
| 2 | Deploy backend + frontend (phase 2d) |
| 3 | Smoke: portal create property → appliance → schedule; preview locked POST → 403 |

### Rollback (portal 2d)

1. Redeploy previous build.
2. Run `2026-10-18_property_nickname_undo.sql`.

### Still out of scope

- Staff `properties.py` auth hardening (separate PR).
- `properties.created_via` audit column.

---

## Phase 2e — Link `clients.user_id` + legacy API guards (shipped, Goal 3a)

### What shipped

**Link / signup (`portal_user_link.py`, `auth.ensure_db_user_from_token`, `client_portal.py`)**

- On every successful `link-account` path (existing, claim, invite, verified email, self-signup pending profile) and `complete-signup`: resolve the **`users` row for token `sub`** via the same logic as `get_current_user` (no second row for the same `sub`).
- When `clients.user_id` is null → set to that `users.id`.
- **`get_current_user` / `ensure_db_user_from_token`:** verified-email fallback **adopts** staff placeholders (`auth_id` `client|…`): sets `auth_id` to token `sub` on that row (no second `users` row). Staff-role candidates are never adopted; other `auth_id` mismatches stay **403** (this fixes first portal login for staff-created clients with email — previously 403).
- When `clients.user_id` already points at a placeholder but a **separate** `users` row exists for `auth0_user_id` → repoint `client.user_id` and move customer-owned rows (see `portal_user_link.py`); placeholder `users` row kept.
- When `clients.user_id` points at a **non-placeholder** different `users` row → **do not change**; log warning (2f merge).
- Link code does **not** assign staff roles on `users`.

**Portal notifications**

- `GET/PUT /api/portal/notifications*` unchanged; they work once `user_id` is set. Part/invoice notification writers already use `client.user_id`.

**Legacy staff APIs (no `resolve_client_for_auth` on routers)**

- Portal customers use **`/api/portal/*` only** (verified: no client-role call to `/api/clients` except **admin preview** on `cxdashboard/index.js`, which uses staff session).
- Routers gated with **`get_staff_user`**: `clients`, `work_orders`, `scheduling`, `invoices`, `payments`, `quotes`, `reports` (client-role JWT → **403**).
- **Excluded** (unchanged): `POST /api/payments/payments/process-stripe-webhook` (Stripe signature), `POST /api/stripe/stripe/webhook`, public `/book` and portal routes.

**SQL**

- `db/sql/2026-10-18_client_user_id_backfill_preview.sql` — candidates + `user_id`/`auth0` conflicts (read-only).
- `db/sql/2026-10-18_client_user_id_backfill.sql` — `backups.clients_user_id_2026_10_18` + UPDATE + final count.
- `db/sql/2026-10-18_client_user_id_backfill_undo.sql` — restore from backup.

### Deploy order (2e)

| Step | Action |
|------|--------|
| 1 | Deploy backend (phase 2e) — new links get `user_id` immediately |
| 2 | Run `2026-10-18_client_user_id_backfill_preview.sql` | Review conflicts |
| 3 | Run `2026-10-18_client_user_id_backfill.sql` | Existing Auth0-linked clients |
| 4 | Smoke: portal bell notifications; client JWT → 403 on `GET /api/clients` |

### Tests

```bash
cd backend && python -m pytest tests/test_portal_client_user_link.py tests/test_staff_api_guards.py tests/test_portal_security.py tests/test_portal_signup.py -q
```

### Deferred (3b)

- `client_logins` table + multi-identity — **step 3 phone login**, not 2e.

---

## Goal 3 — One link model (`auth0_user_id` vs `user_id`, multi-login later)

### Current state (pre-2e historical notes below; 3a shipped above)

**Two parallel links**

| Link | Column | Used by |
|------|--------|---------|
| Portal / Auth0 | `clients.auth0_user_id` | `get_portal_client` (~406–407), `link-account`, payments unlikely |
| Legacy app user | `clients.user_id` → `users.id` → `users.auth_id` | `clients.py` list/get for role `client` (~175, ~231), `payments.py`, `quotes.py`, `scheduling.py`, `invoices.py`, `reports.py`, `work_orders.py` (partial), `part_client_notification_service.py`, `invoice_service.py`, background `tasks/invoices.py`, `work_order_invoice_pdf_data.py` |

**Portal notifications**

- `GET/PUT /portal/notifications*` filter `Notification.user_id == client.user_id` (`client_portal.py` ~839–887). Portal-linked clients with `user_id=NULL` get empty list / early return.

**Link-account side effects**

- Sets `auth0_user_id`, Auth0 role, optional Auth0 name sync; updates existing `users` row by `auth_id` if present (~300–305); **never** creates `users` or sets `client.user_id`.

**Multi-login**

- Not supported: one `auth0_user_id` string; 409 if different sub links same client (~593–597).

**Dependencies**

- Auth0 RBAC `client` role in token for portal UI (`cxdashboard/index.js` ~202).
- `identify-user` returns `client` hint for verified email match but does not link (`auth_identify.py` ~67–69).

**If we unify incorrectly**

- Breaking staff flows that still use `current_user.id` → `Client.user_id`.
- Duplicate notifications users if two `users` rows created.
- Merge (Goal 5) becomes harder if two link columns diverge.

### Plan

**Target architecture (phased)**

**Phase 3a — behavioral unification (minimal schema)**

1. On successful `link-account` / `complete-signup`: resolve the **`users` row that already exists** for this Auth0 `sub` (created on first API call by `get_current_user` in `auth.py` — default role `client` until link assigns Auth0 RBAC).
   - Set `client.user_id = user.id` when null and `user.auth_id == auth0_sub`.
   - **Do not** create a second `users` row for the same `sub`.
   - If `client.user_id` is set to a different `users.id`, do not silently repoint — staff merge (Goal 5).
2. Add helper `resolve_client_for_auth(db, token_data)` used by legacy routers:
   - Prefer `Client.auth0_user_id == sub`, fallback `Client.user_id == current_user.id`.
3. Notifications: keep `Notification.user_id` but guarantee sync on link.

**Phase 3b — multi-login (step 3 phone)**

New table `client_logins` (name TBD):

```sql
-- conceptual
client_id UUID NOT NULL REFERENCES clients(id),
provider TEXT NOT NULL,  -- 'auth0_email', 'auth0_sms', ...
subject TEXT NOT NULL,   -- Auth0 sub or stable provider id
verified_at TIMESTAMPTZ,
UNIQUE(provider, subject)
```

- Migrate `clients.auth0_user_id` → primary row `provider='auth0'`.
- `get_portal_client`: join `client_logins` where `subject = token.sub`.
- Deprecate column `auth0_user_id` read path after backfill (keep column nullable for rollback).

**Inventory: `user_id` consumers to migrate**

| Location | Migration |
|----------|-----------|
| `clients.py` client-role scoping (~175, 231, 256, 284, 311) | `resolve_client_for_auth` |
| `payments.py`, `quotes.py`, `invoices.py`, `scheduling.py`, `reports.py` | same helper |
| `part_client_notification_service.py`, `invoice_service.py`, `tasks/invoices.py` | ensure `client.user_id` populated on link |
| `work_order_invoice_pdf_data.py` | read user via client helper |
| `user_service.py` ~109 | include auth0 path |
| Frontend legacy client APIs | Rare for portal users; document deprecation |

**Files touched**

- `client_portal.py` (`link-account`, `get_portal_client`), new `portal_client_resolve.py`, `user_service.py`, each legacy router (mechanical dependency injection), tests.

**SQL (3b)**

- `db/sql/2026-XX-XX_client_logins.sql` + backfill from `auth0_user_id` + `_undo`.

**Risks**

- Users with old `user_id` pointing at different Auth0 than `auth0_user_id` (data repair before merge).
- Creating `users` rows may interact with staff `User` table uniqueness on email.

**Must ship first**

- Goals **1** and **4** stable linking paths.

**How to test**

- Link account → notifications appear when background job creates notification for `user_id`.
- Legacy `GET /api/clients` as portal user returns self via auth0 path.
- Two Auth0 subs same client (3b only): second link after invite/claim, first revoked.

---

## Goal 4 — Claim links (DB-backed, single-use)

### Current state

**Invite today**

- Staff: `POST /api/clients/{id}/invite` (`clients.py` ~418–450): 7-day HS256 JWT, email via Resend, URL `/cxdashboard/register?token=…`.
- Pre-login validation: `frontend/pages/api/portal/validate-invite.js` decodes JWT with `PORTAL_INVITE_SECRET` / `SECRET_KEY`.
- Consume: `link-account` with `invite_token` body (`client_portal.py` ~536–558); does **not** require email match when invite succeeds.
- Staff UI: “Send Registration Email” on `clients/[id]/mobile.js` ~1249–1261 (desktop `clients/[id]/index.js` ~199 invite API). No copy-link button in repo; SMS prefilled pattern exists as `buildSmsUrl` in `utils/enRouteSms.js` (used on techboard).

**Email change**

- No dedicated flow; client email editable staff-side; portal email read-only.

**Dependencies**

- Shared secret on API + Next for JWT validation.
- Register page stores `portal_invite_token` in sessionStorage (`register.js` ~48–56).

**If we replace JWT outright**

- Breaks links already emailed until expiry — **must** dual-support decode order: DB token first, else JWT.

### Plan

**Schema**

`client_portal_claims` (name flexible):

| Column | Purpose |
|--------|---------|
| `id` UUID PK | |
| `client_id` FK | |
| `token_hash` | SHA-256 of raw token (never store raw) |
| `purpose` | `portal_invite`, `email_change`, … |
| `expires_at` | |
| `used_at` | NULL until consumed |
| `created_by` | staff `users.id` |
| `metadata` JSONB | e.g. `target_email` for email change |
| `revoked_at` | optional staff cancel |

**Token delivery**

- Raw token in URL query `?claim=` (or keep `token=` for register page compat). Length ≥ 32 bytes random.

**API**

- `POST /api/clients/{id}/portal-claims` (staff) → `{ url, expires_at }` + optional Resend email (reuse invite HTML).
- `POST /api/work-orders/{id}/portal-claims` (staff) → same client as WO.
- `GET /api/portal/validate-claim?token=` (Next or FastAPI) → non-sensitive client preview (like validate-invite).
- `link-account` accepts `claim_token` **or** legacy `invite_token` JWT.

**Consume rules**

- Single-use: set `used_at`, bind `auth0_user_id` on client.
- Email change purpose: after Auth0 verified email matches `metadata.target_email`, update `clients.email` then link.
- Rate-limit validate endpoint.

**Staff UX**

- “Copy portal link” + “Send email” on client mobile/desktop.
- Optional: generate SMS body with URL via `buildSmsUrl(client.mobile, body)` next to existing email button.

**Files touched**

| Area | Files |
|------|--------|
| Backend | `clients.py`, new `portal_claim_service.py`, `client_portal.py` (`link-account`), optional `work_orders.py` |
| Frontend | `validate-invite.js` → validate-claim or dual, `register.js`, staff client pages, `services/api/clientsApi.js` |
| Tests | extend `test_portal_security.py` for single-use, expired, wrong client |

**SQL**

- `db/sql/2026-XX-XX_client_portal_claims.sql` + indexes on `(token_hash)`, `(client_id, used_at)` + `_undo`.

**Risks**

- Secret leakage from logs if raw token logged — log only claim id.
- Clock skew on expiry.

**Must ship first**

- None; can ship before Goal 1.

**How to test**

- Create claim → validate → register → link → second use fails.
- Legacy JWT invite still works until `exp`.
- Email-change claim: updates email only when Auth0 verified.

---

## Goal 5 — Admin client merge

### Current state

**Not implemented** — no router/service for merging two `clients` rows.

**Reference patterns**

- Appliance merge: `POST /portal/appliances/merge`, staff `POST /clients/{id}/appliances/merge` (`client_appliance_service.py`).

**FK surfaces to rewire (survivor `client_id`)**

From models: `work_orders`, `invoices`, `payments`, `properties`, `client_appliances`, `quotes`, `documents`, `feedback`, `campaign` recipients, `chat` (nullable client).

**Auth / identity**

- `auth0_user_id` on loser vs winner — manual policy required.
- `user_id` on loser — may need detach or merge into survivor’s user.
- No `square_customer_id` on `Client` model in repo; Square ids live on payments/WO metadata — merge should reassign `payments.client_id` and audit WO payment rows, not invent new discount logic.

**Dependencies**

- Staff-only APIs (`get_admin_dependency` pattern from `clients.py` invite).
- Client notes field (`clients.notes`) for audit trail.

**If we build merge**

- Irreversible without restore; must preview counts and block concurrent edits.

### Plan

**API**

- `GET /api/clients/merge/preview?keep_id=&merge_id=` → counts per table, warnings (both have `auth0_user_id`, conflicting emails, etc.).
- `POST /api/clients/merge` body `{ keep_client_id, merge_client_id, resolutions }` — staff admin only.
- `resolutions`: e.g. `auth0_keep`, `email_keep`, `mobile_keep`, `square_keep_client` (if found in custom_fields later).

**Service**

- Single DB transaction:
  - `UPDATE … SET client_id = keep` for all dependent tables.
  - Merge `custom_fields`, `tags`, SMS consent (prefer survivor unless explicit).
  - Repoint `client_logins` (Goal 3b) or `auth0_user_id` per resolution.
  - Soft-inactivate loser: `status='inactive'` + note, or hard delete if no FK blockers (prefer inactive).
- Append audit note: timestamp, admin user, merge_id, summary.

**UI**

- Admin client search: “Merge duplicate” wizard with preview tables.

**Files touched**

- New `client_merge_service.py`, `routers/clients.py` or `admin_clients.py`, frontend admin page, tests with fixture DB.

**SQL**

- Optional `client_merge_audits` table for compliance (recommended) + `_undo` (drop table only; merges not auto-reversible).

**Risks**

- Missing FK in code → orphan rows.
- Duplicate appliances after merge — optional post-merge dedupe suggestion, not automatic.
- **Never** touch diagnostic discount / repair credit fields on work orders.

**Must ship first**

- Goal **3a** (consistent `user_id` / auth0).
- Claim links help staff fix mistaken duplicates before merge.

**How to test**

- Fixture two clients with WO + property + appliance + invoice + payment each → preview counts → merge → single client owns all.
- Portal login on loser auth0 after resolution “keep winner only” → winner data.
- Rollback: restore from backup (document operational runbook).

---

## Goal 6 — Appliance labels (`source`)

### Current state

**Data**

- `client_appliances.source` string, default `"manual"` (`client_appliance.py` ~38).
- Writers: `portal` (`client_portal.py` ~1599), `staff` (`clients.py` ~511), `work_order_sync` / `work_order_import` (`client_appliance_service.py` ~345, ~757), default `manual` on generic create (~658).

**API**

- `serialize_appliance` includes `"source"` (`client_appliance_service.py` ~581).

**UI**

- No display of `source` in `cxdashboard/appliances.js` or `ClientAppliancesPanel.js`.
- No staff “mark verified” flag beyond implicit staff-created `source='staff'`.

**Dependencies**

- None on payments/discounts.

### Plan

**Label mapping (portal UI)**

| `source` values | Customer-facing label |
|-----------------|----------------------|
| `portal` | Added by you |
| `staff`, `manual` (staff-entered registry) | Verified by Atomic Repair |
| `work_order_import`, `work_order_sync` | From your service history (optional subtitle) |

**Staff verified (Option B — approved)**

- Add `verified_by_staff_at` (timestamptz) and `verified_by_user_id` (FK `users.id`, nullable) on `client_appliances`.
- **Do not** overwrite `source` when staff verifies (keeps `portal` vs `work_order_import` provenance).
- Staff “Verify appliance” sets verification columns only; portal label logic: verified columns set → “Verified by Atomic Repair”; `source=portal` without verification → “Added by you”.

**Files touched**

- `client_appliance.py`, `client_appliance_service.py`, staff `POST .../appliances/{id}/verify` (or PATCH), portal/staff UI labels.

**SQL**

- `db/sql/2026-XX-XX_client_appliance_verified.sql` + `_undo`.

**Risks**

- Backfill: existing `source=staff` may be treated as verified in UI without migration, or one-time backfill `verified_by_staff_at` where `source IN ('staff','manual')`.

**Must ship first**

- None.

**How to test**

- Portal create → shows “Added by you”.
- Staff create → “Verified by Atomic Repair”.
- Import from WO → history label.

---

## Cross-cutting verification checklist

1. Run `validate` + `cd frontend && npx tsc --noEmit` after each phase (repo ship gate).
2. `pytest backend/tests/test_portal_security.py` after linking / preview / claim changes.
3. Manual: new signup, existing email link, invite JWT, claim link, admin preview locked vs unlocked write, property → appliance → schedule (no change to priority pricing display).
4. Supabase: run SQL scripts in order documented in each `db/sql` file header; keep `_undo` paired.

---

## Document history

- 2026-10-17: Step 2 plan from fresh code audit (branch `feature/booking-payments` / workspace Oct 2026).
