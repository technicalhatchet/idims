# Feature flags (Wave 1)

Portal and staff capabilities can be toggled without redeploying.

## Storage

- Settings key: `feature_flags`
- Shape: `{ "<flag_id>": { "enabled": bool, "admin_only": bool } }`
- Defaults: all flags **enabled**, `admin_only: false` when unset

## Backend

- `app/services/feature_flags_service.py` — registry, cache (30s TTL), `feature_enabled()`, `require_feature()`
- `GET /api/features` — enabled flag ids for the current JWT (empty roles when unauthenticated)
- `GET /api/features/config` — full definitions (admin/manager only)
- Cache invalidated when `feature_flags` is saved via settings API

## Frontend

- `FeatureFlagsProvider` in `_app.js` loads `/api/features` via `buildApiUrl('features')` (same `/api` prefix rules as `apiClient`)
- **Fail-open:** initial state and any failed/slow/malformed fetch keep all registry flags **ON**; `useFeature` returns `true` until `loaded`. Features are hidden only after a successful response that omits a flag.
- `useFeature('flag_id')` gates UI entry points
- Admin: Settings → **Portal features** panel (`FeatureFlagsSettingsPanel`)

## Flag scopes (Wave 1)

See product spec in `.cursor/rules` / PR description: each flag gates only the listed routes and UI; pre-existing estimate view/PDF/email and staff media viewing stay available when related flags are off.
