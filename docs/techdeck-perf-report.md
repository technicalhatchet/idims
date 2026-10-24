# TechDeck load performance

## Baseline (prod measurement, pre-change)

| Metric | Cold | Warm |
|--------|------|------|
| TTFB | ~2.1s | — |
| FCP | ~4.4s | ~0.26s |
| Time to data (usable) | ~6.7s | — |
| JS transferred | ~905 KB / 78 files | — |
| `_app` first-load chunk | ~267 KB | — |

Duplicate network on first paint (each ×2): `/api/auth/session`, `features`, notifications, `schedule/combined`, `push/vapid-public-key`, `work-orders?limit=200`.

## Changes (this branch)

1. **Static `/techboard`** — removed empty `getServerSideProps` from home, route, and mission-queue (middleware + client layout still gate staff).
2. **Deduped data layer** — react-query keys in `lib/techdeckQueries.js`; features use `apiClient` (no extra session fetch); notifications + schedule + work orders share cache with prefetch.
3. **Work orders** — dashboard loads `limit=50` first; `limit=100` (API max) prefetches on idle for offline/stats.
4. **`_app` bundle** — Solomon enrollment/theme dynamic-imported only on `/solomon/*`; shared `QueryClient` module; FeatureFlags inside `QueryClientProvider`.
5. **Glow** — decorative `blur-[64px]` titleplate glow → `TechboardPageGlow` radial-gradient (backdrop-filter on cards unchanged).

## After (fill in from deploy / local prod build)

Re-run the same trace (cold cache, `/techboard`) and update:

| Metric | Cold | Warm |
|--------|------|------|
| TTFB | _TBD_ | — |
| FCP | _TBD_ | _TBD_ |
| Time to data | _TBD_ | — |
| JS KB / files | _TBD_ | — |
| `_app` first-load | _TBD_ | — |
| Duplicate API calls on load | target: 1× each | — |

### Bundle sizes (local `npm run build`, this branch)

| Route | First Load JS | Notes |
|-------|---------------|--------|
| `/_app` | **397 kB** | Solomon shell code-split off non-`/solomon` routes |
| `/techboard` | **443 kB** | **○ static** (was server-rendered with empty GSSP) |

Re-run the same build on `master` before merge to diff `_app` and `/techboard` lines.

### Glow screenshots

Capture `/techboard` titleplate at 375px before/after on the same device; visual should match (frosted cards unchanged).
