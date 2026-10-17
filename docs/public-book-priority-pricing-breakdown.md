# Public `/book` priority estimate — how numbers are computed

Read-only audit for **ASAP (priority)** public booking estimates. Billing / repair-credit logic is unchanged.

## Settings source

Portal scheduling settings (`settings.key = portal_scheduling`), edited in **Settings → Client Portal Scheduling → Priority service**:

| Field | Default | Role |
|-------|---------|------|
| `priority_service.priority_diagnostic_multiplier` | `1.5` | Multiplies **base** diagnostic SKU price |
| `priority_service.priority_trip_multiplier` | `1.0` | Multiplies trip charge amount |
| `priority_service.priority_flat_fee` | `75` | **Added** to total (not a multiplier) |
| `priority_service.emergency_*` | 2.0 / 1.5 / `125` | Used when tier resolves to `emergency` (after standard same-day cutoff, still same-day + priority) |

Defaults also live in `frontend/utils/portalSchedulingSettings.js` (`DEFAULT_PORTAL_SCHEDULING`).

## Code path

1. `POST /api/public/booking/estimate` → `build_booking_estimate()` (`diagnostic_booking_service.py`)
   - **Base diagnostic** = `Service.base_price` for the appliance/subtype SKU (e.g. laundry washer/dryer diagnostic, often **$89** in marketing).
   - **Trip** = zone trip from `estimate_trip_charge()` (can be **$0** in-zone).
   - Pre-tier `estimated_total` = base diagnostic + trip (not used on UI after tier step).

2. `_apply_public_booking_tier_pricing()` → `apply_tier_pricing()` (`portal_scheduling_helpers.py`) when `time_preference === "today"` and `priority_requested === true`, priority enabled, and tier is `priority` or `emergency`.

3. For tier **`priority`** (typical evening ASAP while priority window is open):

```
diagnostic_line  = round(base_diagnostic × priority_diagnostic_multiplier, 2)
trip_line        = round(base_trip × priority_trip_multiplier, 2)   # 0 × 1 = 0
flat_fee_line    = priority_flat_fee                                 # e.g. 75
estimated_total  = diagnostic_line + trip_line + flat_fee_line
```

## Example: laundry + priority + $0 trip (your screenshot)

Assume base diagnostic **$89.00**, trip **$0.00**, defaults above:

| Line | Calculation | Amount |
|------|-------------|--------|
| Diagnostic | $89.00 × 1.5 | **$133.50** |
| Trip charge | $0.00 × 1.0 | **$0.00** |
| Priority service (flat fee) | `priority_flat_fee` | **$75.00** |
| **Estimated total** | 133.50 + 0 + 75 | **$208.50** |

## “Double priority”?

The diagnostic line is **already tier-adjusted** (multiplier baked into $133.50). The **$75** is an **additional flat priority fee** configured separately — not a second multiplier on $133.50.

So it is **not** “1.5× twice”; it is **1.5× on diagnostic + flat fee**, which can feel like priority is counted twice product-wise. Changing that policy is a product/settings decision, not a display bug.

## UI (after fix)

Step 5 shows each line with a dollar amount; total equals the sum of lines. API exposes `tier_flat_fee` and optional `diagnostic.base_price` for future breakdown copy (e.g. “$89 × 1.5”) without changing charged amounts.
