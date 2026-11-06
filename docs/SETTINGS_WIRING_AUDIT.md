# Settings wiring audit

**Date:** 2026-11-06  
**Scope:** Read-only. Inventory of `settings` table keys, schema fields, and frontend editors; which keys are honored at runtime; gaps and wiring order.  
**Out of scope:** Auth0 / env secrets, user UI preferences (`users.preferences` via `/api/settings/user`), appliance lifespan / maintenance-task catalogs (separate tables).

---

## 1. How settings work

| Layer | Role |
|-------|------|
| Table `settings` | One row per key: `key` (PK), `value` (JSONB), `description`, timestamps, `updated_by` |
| `SettingsService` | CRUD + cache (`app:settings:all`); validates known keys in `_validate_setting_value` |
| `/api/settings*` | Staff API in `backend/app/routers/app_settings.py` |
| Canonical UI | `frontend/pages/settings.js` (TechDeck) + panels under `frontend/components/settings/` |
| Legacy UI | `frontend/pages/settings1/index.js` |

There are **no per-field columns**. Nested config lives inside JSONB blobs (`portal_scheduling`, `trip_zones`, `tax_jurisdictions`, etc.).

### Frontend surfaces

| Page | Purpose | Uses `settings` table? |
|------|---------|------------------------|
| `/settings` → `pages/settings.js` | **Canonical** TechDeck settings (Availability, Client Portal, Notifications, Service Areas, Tax, Parts, Interface prefs) | Yes (`/api/settings`, `upsertAppSetting`) |
| `/settings1` → `pages/settings1/index.js` | **Legacy leftover**, not a duplicate of the new page. Older DashboardLayout shell with Business / Scheduling / UI / Notifications tabs for **scalar** keys the new page dropped (`tax_rate`, `travel_buffer_minutes`, `accent_color`, `notification_preferences`, `service_area_*`, etc.). Calls `apiClient('settings')` **without** `/api/` prefix — likely broken unless a rewrite adds it. Comment still says “place at `pages/settings/index.js`”. | Intended yes; path suspicious |
| `/solomon/settings` | Solomon appearance / links only | No |
| `/cxdashboard/settings` | Portal **account** profile (me, invites, auto-approve) | No |

`frontend/services/api/settingsApi.js` still defines `getCompanySettings` / company / invoice helpers that **do not match** current FastAPI routes — treat as stale.

---

## 2. Master key inventory (status table)

**Status legend**

- **WIRED** — saved and drives real behavior  
- **PARTIAL** — some nested fields / callers honor it; others ignore or hardcode  
- **UNUSED** — validated and/or editable, but no runtime consumer found (or superseded)

Nested fields under a blob are indented in the Key column.

### A. Canonical / actively maintained keys

| Key | Edited (page) | Saved | Read (file:line) | Status | Should control | Gap |
|-----|---------------|-------|------------------|--------|----------------|-----|
| `shop_hours` | `/settings` Availability | `PATCH`/`upsert` `shop_hours` (`settings.js` ~688) | `shop_hours_scheduling.py:75+`; `portal_schedule_service.py:152+`; FE `useShopHours.js:79` → schedule, AppointmentScheduler, ForceSchedule, techboard/ops, TechnicianSchedule, TimelineView | **PARTIAL** | Open days + regular/evening windows for portal booking and TechDeck calendars | Portal/window intersection uses it. Staff slot core still hardcodes **8–17** and **15 min prep** in `appointment-scheduling.js:490-496`; backend `scheduling_service.py:206-207`, `scheduling_constraints_service.py:404-405` also hardcode 8–17 |
| `trip_zones` | `/settings` Service Areas | `settings.js` ~780 | `zone_service.py:75+`; booking `diagnostic_booking_service.py:200+`; `public.py:520+`; WO trip charge `work_order_service.py:1227+`; `portal_property_service.py:63` | **WIRED** | Zip / drive-time zone + trip charge | — |
| `trip_zones.driveTimeFallback.shopAddress` | Service Areas | inside `trip_zones` | **Not used for travel origin** | **UNUSED** (nested) | Origin for drive-time fallback | Runtime uses `get_default_shop_address()` env/hardcode (`travel_calculator.py:38-43`) |
| `trip_zones.defaultTripChargeSku` | Service Areas (schema) | inside `trip_zones` | `zone_service.py:215-218` only (`get_trip_charge_sku`) | **UNUSED** | Auto SKU when adding trip charge line | No callers of `get_trip_charge_sku()` |
| `tax_jurisdictions` | `/settings` Tax | `settings.js` ~849 | `tax_service.py:111+`; applied on WO create/update (`work_orders.py:528+`, `work_order_service.py:455+`, `public.py:668`) | **WIRED** | County rate by zip → `work_orders.tax_rate` | — |
| `parts_settings` | `/settings` Parts | `settings.js` ~994 | `parts_settings_service.py:37+`; WO parts UI/API; `part_warranty.py:34+` | **WIRED** | Markup, lookup tiles, warranty defaults, vendors | — |
| `portal_scheduling` | Client Portal → Scheduling panel | `PortalSchedulingSettingsPanel.js` | `portal_scheduling_settings_service.py:35+` + consumers below | **PARTIAL** | Portal booking / pricing / Square / comms | See nested rows |
| → `self_scheduling_enabled` | same | blob | `client_portal.py:1508`; `client_appliance_service.py:154+` | **WIRED** | Global portal self-schedule gate | — |
| → `scheduling_windows` | same | blob | `portal_schedule_service.py`; `portal_narrowing_service.py`; helpers; intersected with `shop_hours` | **WIRED** | Morning/afternoon/evening customer windows | — |
| → `same_day_lead_minutes_before_close` | same | blob | `portal_scheduling_helpers.py:74+` | **WIRED** | Same-day cutoff | — |
| → `narrowing_batch_time` | same | blob | `portal_narrowing_service.py:34+` | **WIRED** | Narrowing batch schedule | — |
| → `booking.min/max_days_out` | same | blob | `portal_schedule_service.py:116+` | **WIRED** | Bookable horizon | — |
| → `auto_assign.fallback_technician_id` | same | blob | `portal_schedule_service.py:163` | **WIRED** | Default tech for slot search | — |
| → `auto_assign.strategy` | same | blob | **No runtime reads** | **UNUSED** | closest_travel / round_robin / manual_only | Saved + validated; assignment logic ignores strategy |
| → `priority_service.*` | same | blob | `portal_scheduling_helpers.py:81+`; `public.py:178+`; `client_portal.py:1513+` | **WIRED** | Priority/emergency pricing + cutoffs | — |
| → `comms.narrowing_*` | same | blob | `portal_narrowing_service.py:132-133` | **WIRED** | Narrowing SMS/email | Still gated by `customer_outreach_test_mode` |
| → `comms.same_day_*` / `denial_*` | same | blob | `portal_same_day_service.py:83-112` | **WIRED** | Approval/denial SMS/email | Same outreach gate |
| → `payment.requires_payment` | same | blob | `portal_square_payment_service.py:31+` | **WIRED** | Portal booking payment required | — |
| → `payment.apple_pay_enabled` | same | blob | `client_portal.py:1520`; `pay_link_service.py:231` | **PARTIAL** | Apple Pay on portal/pay links | Staff WO Square config hardcodes `apple_pay_enabled: True` (`work_orders.py:3146`) |
| → `payment.square_*` / `pay_link_paid_visible_days` | same | blob | Square + pay-link services | **WIRED** | Credentials + paid-link visibility | Token must stay server-only (already) |
| `portal_self_scheduling` | legacy | legacy `{enabled}` | Merged into `portal_scheduling.self_scheduling_enabled` (`portal_scheduling_settings_service.py:53-58`) | **PARTIAL** | Legacy enable flag | Prefer canonical blob; keep merge until migrated away |
| `feature_flags` | Client Portal → Feature flags | `FeatureFlagsSettingsPanel.js` | `feature_flags_service.py` | **WIRED** | Portal feature gates | — |
| `worker_feature_flags` | Notifications tab | `WorkerFeatureFlagsSettingsPanel.js` | `worker_feature_flags_service.py` | **PARTIAL** | Celery worker jobs on/off | Backend has **7** flags incl. `maintenance_reminder_emails`; UI lists **6** |
| `push_notifications` | Notifications tab | `PushNotificationSettingsPanel.js` | `push_notification_settings_service.py`; `web_push_service.py:234+` | **PARTIAL** | Staff web-push rules | Backend schema includes rules FE defaults omit (`portal_estimate_decision`, `portal_customer_media`) |
| `portal_reviews` | Client Portal → Reviews | `PortalReviewsSettingsPanel.js` | `portal_reviews_settings_service.py`; `portal_review_request_service.py` | **WIRED** | Post-job review emails + Google URL | — |
| `parts_links` | Client Portal → Parts links | `PartsLinksSettingsPanel.js` | `parts_links_service.py`; `client_appliance_service.py:689+` | **WIRED** | Customer parts URL templates | Feature-flag gated |
| `customer_outreach_test_mode` | Notifications | `CustomerOutreachSettingsPanel.js` | `customer_outreach_service.py:33+` | **WIRED** | Blocks auto SMS/email when enabled (default true) | Easy to leave on and think “comms toggles broken” |
| `parts_markup_percentage` | (legacy; Parts tab uses blob) | legacy scalar | `parts_settings_service.py:48-67` if `parts_settings` missing | **PARTIAL** | Fallback markup | Prefer `parts_settings.markupPercent` |

### B. Legacy / settings1-only keys (validated, mostly dead)

| Key | Edited (page) | Saved | Read | Status | Should control | Gap |
|-----|---------------|-------|------|--------|----------------|-----|
| `tax_rate` (app setting) | `settings1` Business | `settings/{key}` PATCH | **None** (billing uses `tax_jurisdictions` → WO column) | **UNUSED** | Single global rate | **Dead.** Billing honors `tax_jurisdictions` / `work_orders.tax_rate`. Do not confuse with WO field |
| `travel_buffer_minutes` | `settings1` Scheduling | PATCH | **None** | **UNUSED** | Minutes between jobs / prep | Scheduling uses `PREP_BUFFER_MINUTES=15` (`appointment-scheduling.js:496`), `BUFFER_MINUTES=10` (`route_optimization_service.py:31`), deploy buffer 5 (`web_push_service.py:34`) |
| `notification_preferences` | `settings1` Notifications | PATCH | **None** | **UNUSED** | Per-event SMS/email toggles | See §3. Reminder workers use `worker_feature_flags.appointment_reminders`, not this blob |
| → `appointment_confirmed` | same | nested | none | **UNUSED** | SMS/email when appointment confirmed | No sender checks this toggle (and may not send dedicated confirm at all) |
| → `tech_en_route` | same | nested | none | **UNUSED** | Customer notify when tech en route | Deploy/en-route is staff **web push**, not this preference |
| → `payment_received` | same | nested | none | **UNUSED** | Receipt notify | Pay-link emails exist; do not read this toggle |
| → `appointment_reminder_24hr` / `_1hr` | same | nested | none | **UNUSED** | Reminder channels | Worker flag + `appointment_reminder_service` — not these channel prefs |
| `accent_color` | `settings1` UI | PATCH | **None** in product UI | **UNUSED** | Orange/cyan theme | TechDeck CSS + PDF accents are hardcoded (`atomic_panels.py:66` cyan) |
| `extended_hours_enabled` | `settings1` Scheduling | PATCH | **None** | **UNUSED** | Global evening hours switch | Evening lives under `shop_hours.*.evening.enabled` |
| `service_area_enabled` | `settings1` Business | PATCH | **None** | **UNUSED** | Radius-based service area | Superseded by `trip_zones` (+ `custom` = out of area) |
| `service_radius_miles` | `settings1` Business | PATCH | **None** | **UNUSED** | Radius miles | Same |
| `shop_address` (app setting) | `settings1` Business | PATCH | **None** | **UNUSED** | Shop origin for travel | Env/`DEFAULT_SHOP_ADDRESS` / hardcoded Toledo (`travel_calculator.py:38-43`) |
| `diagnostic_fee_behavior` | `settings1` Business | PATCH | **None** | **UNUSED** | auto_waive / manual / always_charge | Pricing/diagnostic flows ignore |
| `invoice_terms` | `settings1` Business | PATCH | **None** | **UNUSED** | due_on_receipt / net_15 / net_30 | Invoice PDFs / terms ignore |
| `default_warranty_days` | `settings1` (if present) | PATCH | **None** found | **UNUSED** | Global warranty days | Superseded by `parts_settings.oemWarrantyDays` / aftermarket |

### C. Seed / template keys (DB seed, no modern editor)

From `seed.sql` / `db_schema.sql` (may still exist in prod DB):

| Key | Edited | Saved | Read | Status | Notes |
|-----|--------|-------|------|--------|-------|
| `company_info` | none | seed | **None** found | **UNUSED** | Name/address/phone/tax_id — PDFs/emails use other sources / hardcodes |
| `tax_rates` | none | seed | **None** | **UNUSED** | Array form superseded by `tax_jurisdictions` |
| `work_order_settings` | none | seed | **None** found | **UNUSED** | Auto-number prefix/start |
| `invoice_settings` | none | seed | **None** found | **UNUSED** | Auto-number, payment_terms, late fee |
| `quote_settings` | none | seed | **None** found | **UNUSED** | Auto-number, valid_days, terms |
| `notification_settings` | none | seed | **None** found | **UNUSED** | `appointment_reminder_hours`, `follow_up_days` |

### D. Not `settings` table (related)

| Item | Where | Notes |
|------|-------|-------|
| Rail position / style / display name | `users.preferences` via Interface tab | Wired; not app settings |
| Appliance lifespans / maintenance tasks | Dedicated APIs/tables | Edited from Client Portal accordion; not JSONB settings keys |

---

## 3. Special attention answers

### Tax: `tax_rate` vs `tax_jurisdictions`

- **Billing uses `tax_jurisdictions`.** `TaxService` loads that blob, resolves county by zip (else `defaultCounty`), writes **`work_orders.tax_rate`**.
- App setting **`tax_rate` is dead** — only validated + editable on `settings1`.
- Fallback when rate missing on a WO/PDF is often **hardcoded 0.0775** (Lucas), which matches default county but is not a live setting read.

### `travel_buffer_minutes`

- **Unused.** Slot/prep/gap logic uses hardcoded buffers (15 / 10 / 5). Saving the setting changes nothing in scheduling.

### `shop_hours` vs TechDeck scheduling

- **Portal:** uses `shop_hours` ∩ `portal_scheduling.scheduling_windows` — **WIRED**.
- **TechDeck:** calendars / day-open checks via `useShopHours` — **mostly wired**.
- **Slot placement math:** `appointment-scheduling.js` still assumes **8–17** and **15 min prep** — **PARTIAL** / ignore saved hours & buffer setting.

### Accent / theme

- `accent_color` setting **UNUSED**. Theme is CSS/PDF hardcoded. Interface tab only saves **user** rail prefs.

### Notification preferences (`appointment_confirmed`, `tech_en_route`, `payment_received`)

| Event | What actually sends today | Checks `notification_preferences`? |
|-------|---------------------------|------------------------------------|
| Appointment confirmed | No dedicated customer SMS/email toggle path found tied to this key | No |
| Tech en route | Staff deploy **web push** (`push_notifications` / deploy rule), not customer SMS from this key | No |
| Payment received | Pay-link / receipt email paths exist; mock notif type in FE API only | No |
| 24h / 1h reminders | Worker + `appointment_reminder_service` gated by **`worker_feature_flags.appointment_reminders`** | No |

**Verdict:** Entire `notification_preferences` blob is UI/schema theater until wired (or deleted in favor of portal `comms` + worker flags + push rules).

### Trip zones

- **WIRED** for zone + charge. Gaps: `driveTimeFallback.shopAddress` and `defaultTripChargeSku` not honored; shop origin is env/hardcode.

### Portal comms toggles

- **WIRED** under `portal_scheduling.comms` for narrowing + same-day approve/deny. Still subject to **`customer_outreach_test_mode`**.

### Priority service

- **WIRED** (`portal_scheduling.priority_service`).

### Payment settings

- Portal/pay-link Square + `requires_payment` + Apple Pay (portal) — **WIRED**. Staff Square Apple Pay flag hardcoded true.

---

## 4. Hardcoded values that should be settings (or should read existing ones)

| Hardcoded | Location | Should read |
|-----------|----------|-------------|
| Business day 8–17 | `appointment-scheduling.js:490-491`; `scheduling_service.py:206-207`; `scheduling_constraints_service.py:404-405` | `shop_hours` (and/or portal windows) |
| Prep buffer 15 min | `appointment-scheduling.js:496` | `travel_buffer_minutes` (or rename to `prep_buffer_minutes`) |
| Route gap 10 min | `route_optimization_service.py:31` | Same buffer setting (or separate gap setting) |
| Deploy buffer 5 min | `web_push_service.py:34` | Optional dedicated setting |
| Shop address Toledo / env | `travel_calculator.py:38-43`; route optimization duplicate | `trip_zones.driveTimeFallback.shopAddress` or `shop_address` |
| Tax fallback 0.0775 | Many WO/PDF/billing paths | Always resolve via `TaxService` / jurisdictions |
| Zone default charges / bands | `zone_service.py` defaults; `settings.js` `DEFAULT_ZONES` | OK as defaults if DB empty; ensure UI save is source of truth after first save |
| Priority flat fees 75 / 125 | Schema defaults + helpers | OK as defaults when blob missing |
| Staff `apple_pay_enabled: True` | `work_orders.py:3146` | Portal payment setting or shared payment config |
| PDF accent cyan | `atomic_panels.py:66` | `accent_color` if theme wiring is desired |

---

## 5. Recommended wiring order (payoff ÷ effort)

Smallest / highest first:

1. **Document + hide dead `settings1` keys** (or redirect `/settings1` → `/settings`)  
   Effort: tiny. Stops false confidence that tax_rate / accent / notification toggles do anything.

2. **Honor `travel_buffer_minutes` in `appointment-scheduling.js` (prep) + optionally route buffer**  
   Effort: small. High “I changed the number and nothing happened” payoff. Or rename UI to match existing constants if product wants fixed 15.

3. **Drive TechDeck slot hours from `shop_hours` / `useShopHours` instead of 8–17 constants**  
   Effort: small–medium. Aligns staff scheduling with Availability tab.

4. **`trip_zones.driveTimeFallback.shopAddress` → feed `get_default_shop_address()` (fallback chain: setting → env → hardcode)**  
   Effort: small. Makes Service Areas shop field real.

5. **Wire or delete `notification_preferences`**  
   - Prefer: map 24h/1h reminder channels into `appointment_reminder_service`; map payment_received into pay-link receipt; leave tech_en_route as customer SMS if product wants it.  
   - Or remove from UI/schema to avoid lying toggles.  
   Effort: medium; payoff high for trust.

6. **`auto_assign.strategy`** — implement closest_travel / round_robin / manual_only in portal schedule assign  
   Effort: medium. Setting already in UI.

7. **`defaultTripChargeSku`** — call `get_trip_charge_sku()` when auto-adding trip lines  
   Effort: small once SKU catalog is clear.

8. **`diagnostic_fee_behavior` / `invoice_terms` / seed `company_info` + numbering templates**  
   Effort: medium–large. Only if billing/docs product needs them; otherwise leave UNUSED and drop from validation/UI.

9. **`accent_color` theme**  
   Effort: large (CSS surface area). Low ops payoff unless branding SaaS is a goal.

10. **Align worker-flag UI with backend (add `maintenance_reminder_emails`); align push-notification FE defaults with backend rules**  
    Effort: small. Closes PARTIAL gaps on already-wired systems.

---

## 6. Quick reference — “saved but ignored” shortlist

Highest-confidence **UNUSED** (or dead nested) for follow-up tickets:

- `tax_rate` (app key)  
- `travel_buffer_minutes`  
- `notification_preferences` (+ all nested events)  
- `accent_color`  
- `extended_hours_enabled`  
- `service_area_enabled` / `service_radius_miles` / `shop_address`  
- `diagnostic_fee_behavior` / `invoice_terms` / `default_warranty_days`  
- `portal_scheduling.auto_assign.strategy`  
- `trip_zones.defaultTripChargeSku`  
- `trip_zones.driveTimeFallback.shopAddress`  
- Seed: `company_info`, `tax_rates`, `work_order_settings`, `invoice_settings`, `quote_settings`, `notification_settings`

**PARTIAL** watchlist: `shop_hours` (staff slots), `payment.apple_pay_enabled` (staff path), `worker_feature_flags` / `push_notifications` (UI incomplete).

---

## 7. Sources (primary)

- `backend/app/models/settings.py`  
- `backend/app/schemas/settings.py`  
- `backend/app/services/settings_service.py`  
- `backend/app/routers/app_settings.py`  
- `frontend/pages/settings.js`, `frontend/pages/settings1/index.js`  
- `frontend/components/settings/*`  
- Runtime loaders: `tax_service`, `zone_service`, `shop_hours_scheduling`, `portal_scheduling_settings_service`, `parts_settings_service`, `customer_outreach_service`, etc.
