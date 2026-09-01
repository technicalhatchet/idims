# Solomon Professional Skin — Implementation Plan

**Date:** 2026-08-31  
**Prerequisite:** [professional-skin-audit.md](./professional-skin-audit.md) reviewed and approved  
**Principle:** Same Solomon brain. Different Solomon suit. **Signature remains default.**

---

## Goals

1. Introduce **PROFESSIONAL** presentation alongside existing **SIGNATURE** presentation.
2. Single app, single diagnostic engine, single data layer.
3. User-selectable via **Settings → Appearance / Interface Style**.
4. Mobile-first Professional UX aligned with enterprise field-service mockups.
5. Zero regression to Signature behavior when Professional is not selected.

## Non-goals

- Rebuilding diagnostic logic, confidence model, or APIs
- Appliance photo library or scraping
- Replacing SVG appliance illustrations (only re-present)
- Desktop-first layouts
- Fake analytics / KPI fabrication

---

## Architecture target

```
┌─────────────────────────────────────────────────────────┐
│  Data / APIs / IndexedDB / diagnosticIntelligenceEngine │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Shared components (theme-agnostic structure)           │
│  DiagnosticResultsForm · DiagnosticSectionFields        │
│  SolomonLeadingHypothesisCard · ReasoningSheet          │
│  SessionCard · DataPointRow · FaultRankingList          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  SolomonThemeProvider (signature | professional)        │
│  CSS variables / semantic tokens                        │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
   SIGNATURE layout                    PROFESSIONAL layout
   (hero artboard home)                (dashboard home + bottom nav)
```

### Theme application mechanism

```html
<html data-solomon-interface="signature|professional">
```

- Provider reads/writes `localStorage.solomon_interface_style`
- On auth: sync to `users/me` → `ui_preferences.solomonInterfaceStyle`
- `SolomonHead` sets `theme-color` from active token set
- Components consume tokens via:
  - CSS variables in `styles/solomon-theme.css`, or
  - `useSolomonTheme()` hook returning `{ tokens, classes }`

**Default:** `signature` — existing users see no change until they opt in.

---

## Phase 1 — Design tokens + theme infrastructure

**Status:** ✅ Implemented (2026-08-31)

**Objective:** Lay foundation without visible Signature regression.

### Tasks

1. Create `frontend/styles/solomon-theme.css` with semantic variables for both themes:
   - Backgrounds, surfaces, borders, text, primary, status colors
   - Radius, shadow, spacing scale (minimal useful set)
2. Create `frontend/context/SolomonThemeContext.js`:
   - `interfaceStyle`: `'signature' | 'professional'`
   - `setInterfaceStyle()`
   - Apply `data-solomon-interface` on `document.documentElement`
3. Create `frontend/hooks/useSolomonTheme.js` — read tokens/classes
4. Refactor **read-only extraction** from:
   - `solomonListPageUi.js` → reference CSS vars where safe
   - `solomonDiagnosticStatus.js` → export `getLifecycleTokens(interfaceStyle)`
5. Wire `SolomonThemeProvider` in `pages/_app.js` **only when** `pathname.startsWith('/solomon')` (avoid leaking to main IDIMS)
6. Extend Tailwind if needed: `colors.solomon.surface` → `var(--solomon-surface)`

### Verification

- [ ] Signature home/wizard/list pages pixel-identical (or acceptable drift documented)
- [ ] Toggle `data-solomon-interface=professional` in DevTools — surfaces change
- [ ] No changes to diagnostic calculations

### Deliverables

- `solomon-theme.css`
- `SolomonThemeContext.js`
- Unit-less manual test checklist

**Estimated touch:** 5–8 files · **Risk:** Low

### Implemented

| File | Purpose |
|------|---------|
| `frontend/styles/solomon-theme.css` | Signature + Professional CSS variables |
| `frontend/components/solomon/solomonThemeTokens.js` | IDs, storage key, resolve helpers |
| `frontend/context/SolomonThemeContext.js` | Provider + `setInterfaceStyle` |
| `frontend/hooks/useSolomonTheme.js` | Consumer hook |
| `frontend/components/solomon/SolomonThemeScope.js` | Route-scoped wrapper (`/solomon` only) |
| `frontend/components/solomon/SolomonThemeColorSync.js` | PWA `theme-color` sync |
| `frontend/hooks/useSolomonAuth.js` | Added `isAdmin` |
| Shell token wiring | `SolomonPageMain`, `SolomonMobileShell`, `SolomonHomePage`, `solomonListPageUi` core classes |

**Admin-only Professional:** `canUseProfessionalInterface` is true only when `roles` includes `admin`. Non-admins always resolve to Signature; stored `professional` is cleared on load.

**Admin testing (until Settings in Phase 7):**
```js
// Browser console on /solomon (while signed in as admin)
localStorage.setItem('solomon_interface_style', 'professional');
location.reload();
// Revert:
localStorage.setItem('solomon_interface_style', 'signature');
location.reload();
```

Or use React DevTools to call `setInterfaceStyle('professional')` from `SolomonThemeProvider`.

---

## Phase 2 — Application shell + navigation

**Status:** ✅ Implemented (2026-08-31)

**Objective:** Professional mobile navigation without affecting Signature.

### Tasks

1. `SolomonBottomNav.js` — Home / Sessions / + / Knowledge / More (Professional only)
2. `useSolomonBottomNavVisible.js` + `solomonNavigation.js` — route rules, safe padding
3. `SolomonPageMain` + `SolomonHomePage` — bottom nav + scroll padding when Professional
4. `pages/solomon/more.js` — overflow links (diagnostics, outcomes, error codes, staff settings)
5. Fixed `SolomonHomePage` → `isStaff` passed to `SolomonHomeHeader` (settings cog)

**Hidden on:** `/solomon/diagnose`, `/solomon/start`, `/solomon/outcomes/new`, `/solomon/signup` (wizard flows; `SolomonMobileShell` unchanged).

**Signature:** No bottom nav; layout unchanged.

---

## Phase 3 — Professional home / dashboard

**Status:** ✅ Implemented (2026-08-31)

**Objective:** Non-artboard home using **real data**.

### Tasks

1. `SolomonProfessionalHome.js` — parallel to hero home:
   - Header row (logo, optional notification placeholder disabled until real feature exists)
   - Greeting from `useSolomonAuth().user` first name
   - Primary CTA “New Diagnostic”
   - **Recent diagnostics** — top 4 from `listStandaloneDiagnosticsOffline` (reuse list card component)
   - **Quick actions** — map to existing routes (diagnostics, outcomes, knowledge, codes)
   - Knowledge CTA banner (reuse copy from `SolomonSmarterCard`)
2. `SolomonMetricRow.js` (optional cards):
   - **Sessions this week** — count from offline list
   - **Open sessions** — count in-progress
   - **Outcomes recorded** — count from outcomes fetch
   - **Avg lead confidence** — mean of `useSolomonDiagnosticLead` over recent 10 sessions (show “—” if < 2 sessions)
   - **Omit** “2,847 articles” style metrics unless backend adds real count
3. `SolomonHomePage.js` — branch:
   ```js
   interfaceStyle === 'professional' ? <SolomonProfessionalHome /> : <SignatureHeroHome />
   ```
4. Tokenize professional home surfaces (no artboard assets)

### Verification

- [ ] No fake numbers
- [ ] Empty states when no sessions
- [ ] Signature hero path untouched
- [ ] Continue session still accessible (recent list + active session card equivalent)

**Estimated touch:** 4–6 new files, 2 modified · **Risk:** Medium

### Implemented

| File | Purpose |
|------|---------|
| `SolomonProfessionalHome.js` | Command-center home (greeting, CTA, continue, recent, quick actions, knowledge banner) |
| `SolomonMetricRow.js` | Real metrics: sessions this week, open, outcomes, avg lead confidence |
| `SolomonDiagnosticListCard.js` | Shared list card (extracted from diagnostics index) |
| `useSolomonHomeDashboard.js` | Loads diagnostics + outcomes, computes metrics |
| `useSolomonDiagnosticLead.js` | Added `computeSolomonDiagnosticLead` for sync metrics |
| `SolomonHomePage.js` | Branches Professional vs Signature hero |

---

## Phase 4 — Shared diagnostic session components

**Status:** ✅ Implemented (2026-08-31)

**Objective:** Reusable session UI blocks for Professional (and optionally enrich Signature later).

### Tasks

1. **`SolomonSessionHeader.js`**
   - `ApplianceIcon` + template label + make/model/serial
   - Lifecycle badge from `resolveSolomonDiagnosticStatus`
   - Optional WO reference if present on payload
2. **`SolomonDataPointsPanel.js`**
   - Build rows from `payload.fields` + `measurementStatuses` + wizard step metadata
   - Status: Observed / Measured / Pending / Unresolved (map from field types + fill state)
   - Tap row → scroll to wizard step (existing step keys)
3. **`SolomonFaultRanking.js`**
   - Present `intelligenceResult.topCategories` (same data as `CategoryEvidencePanel`)
   - Compact bars + % — no engine change
4. **`SolomonDiagnosticProgress.js`**
   - Extract segmented bar from `SolomonActiveSessionCard`
   - Optional phase labels mapping wizard steps → Collect / Analyze / Test / Review (presentation mapping table per template)
5. **`SolomonConfidenceBadge.js`**
   - Wrap `computeDiagnosisConfidence` output — tier label + compact bar
6. Tokenize `SolomonLeadingHypothesisCard` — `density="compact"` for Professional

### Verification

- [ ] Components render with mock intelligence payload in Storybook or isolated page (optional)
- [ ] Data points list matches actual filled fields
- [ ] No new API calls

**Estimated touch:** 6–8 files · **Risk:** Medium

### Implemented

| File | Purpose |
|------|---------|
| `SolomonSessionHeader.js` | Appliance icon, label, equipment, lifecycle badge, WO ref |
| `SolomonDataPointsPanel.js` | Collapsible field rows with Observed/Measured/Pending/Unresolved |
| `buildSolomonDataPointRows.js` | Row builder from template fields + measurement statuses |
| `SolomonFaultRanking.js` | Compact top-category bars from `topCategories` |
| `SolomonDiagnosticProgress.js` | Segmented step bar + Collect/Analyze/Test/Review phase |
| `solomonDiagnosticStepProgress.js` | Shared step progress helpers |
| `SolomonConfidenceBadge.js` | `computeDiagnosisConfidence` tier + bar |
| `SolomonLeadingHypothesisCard.js` | Added `density="compact"` for Professional |

---

## Phase 5 — Diagnostic session screens

**Objective:** Professional in-session UX per mock.

### Tasks

1. `diagnose.js` + `diagnostics/[id].js` (edit mode):
   - Professional: `SolomonSessionHeader` sticky below wizard header
   - Insert `SolomonDiagnosticProgress` + `SolomonConfidenceBadge`
   - Collapsible `SolomonDataPointsPanel` above wizard OR side accordion on tablet
   - `SolomonFaultRanking` below hypothesis card (Professional only)
2. `DiagnosticResultsForm.js`:
   - Add prop `interfaceStyle` (from theme context)
   - When `professional` + `solomonMobileLayout`:
     - Keep `SolomonLeadingHypothesisCard` + `SolomonReasoningSheet`
     - **Optionally re-enable** `EliminationBanner` in compact form inside reasoning sheet (not inline banner)
     - Do **not** uncomment disabled route banner without UX review
3. `SolomonReasoningSheet.js`:
   - Professional typography tokens (tighter spacing, no glow)
   - Ensure all sections remain: Why, Supporting, Contradicting, Unresolved, Next test, Path
4. Read-only detail view: same session header + reasoning panel

### Verification

- [ ] Full wizard flow: start → steps → save → detail
- [ ] Offline auto-save still works
- [ ] Signature wizard unchanged
- [ ] Leading hypothesis opens reasoning sheet

**Estimated touch:** 5–8 files · **Risk:** High (DiagnosticResultsForm) — test WO mobile path

---

## Phase 6 — Knowledge / sessions / supporting screens

**Objective:** Professional polish on secondary routes.

### Tasks

1. Apply `SolomonAppShell` + tokens to:
   - `diagnostics/index.js`
   - `outcomes/*`
   - `knowledge.js`
   - `codes/*`
   - `start.js` (picker)
   - `signup.js`
2. Extract shared `SolomonListPage` wrapper (header + title + glass form pattern)
3. Skin `DmaFieldRecordForm` for outcomes in Professional (input classes from tokens)
4. Align error codes emerald accents with theme primary (professional may use blue primary; codes page can use semantic “reference” color token)

### Verification

- [ ] All routes reachable from bottom nav
- [ ] List filtering/search unchanged
- [ ] Codes + knowledge API behavior unchanged

**Estimated touch:** 8–12 files · **Risk:** Low–Medium

---

## Phase 7 — Settings + theme persistence

**Objective:** User-facing toggle that survives reload.

### Tasks

1. `pages/solomon/settings.js`:
   - Section **Appearance / Interface Style**
   - Radio: Signature / Professional with descriptions from spec
   - Links: repair outcomes, account, about
2. Backend `UIPreferences` schema (`app_settings.py`):
   - Add `solomonInterfaceStyle: Optional[str]`
3. `UIPreferencesContext` OR dedicated `SolomonThemeContext` sync:
   - Load from localStorage immediately
   - On login: fetch `getUserSettings()`, merge
   - On change: `updateUserSettings({ ui_preferences: { solomonInterfaceStyle } })`
4. Remove Solomon skip in `UIPreferencesContext` for preference **write**; keep read path efficient
5. `SolomonHead` — dynamic `theme-color` from active theme

### Verification

- [ ] Toggle persists across reload
- [ ] Toggle persists across logout/login (authenticated users)
- [ ] Guest/DIY offline: localStorage only
- [ ] Default remains Signature for existing users

**Estimated touch:** 4–6 files · **Risk:** Low

---

## Phase 8 — Responsive polish

**Objective:** Phone-first quality bar; tablet acceptable.

### Tasks

1. Bottom nav safe-area on all Professional pages
2. Tablet (`sm:` / `md:`): optional two-column session layout (header + data points left, wizard right) — only if time permits
3. Optional PWA splash (`pages/solomon/_splash` or loading component) — **defer if low priority**
4. `ApplianceIcon` — `variant="professional"` muted strokes
5. Reduce `SolomonPageAtmosphere` orbs in Professional
6. Signature hero debug tools remain Signature-only

### Verification

- [ ] iPhone safe areas (notch, home indicator)
- [ ] Android Chrome PWA
- [ ] No horizontal scroll on 320px width

**Estimated touch:** 5–10 files · **Risk:** Low

---

## Phase 9 — Accessibility

**Objective:** Professional = readable in sunlight, usable with gloves.

### Tasks

1. Contrast audit on Professional tokens (WCAG AA target)
2. Focus visible on bottom nav + data point rows
3. `aria-current` on active nav tab
4. Reasoning sheet: `role="dialog"`, focus trap, escape close
5. Status badges: icon + text (not color-only)
6. `prefers-reduced-motion`: disable glow pulses, sheet slide optional

### Verification

- [ ] VoiceOver spot check on home + wizard + reasoning sheet
- [ ] Keyboard tab through settings toggle

**Estimated touch:** cross-cutting · **Risk:** Low

---

## Phase 10 — Regression testing

**Objective:** Ship confidence.

### Manual test matrix

| Flow | Signature | Professional |
|------|-----------|--------------|
| Home load | Hero + CTA | Dashboard + nav |
| New diagnostic (DIY) | picker → wizard | same |
| New diagnostic (staff) | direct wizard | same |
| Auto-save offline | ✓ | ✓ |
| Continue session | hero card | recent list |
| Complete → outcome link | ✓ | ✓ |
| Repair memory search | ✓ | ✓ |
| Error code lookup | ✓ | ✓ |
| Theme toggle | n/a | persists |
| WO mobile diagnostic | unchanged | unchanged |

### Automated

- [ ] `npx tsc --noEmit`
- [ ] Existing diagnostic unit tests (if any) still pass
- [ ] Lint on touched files

### Rollout

- Ship behind default `signature`
- Internal dogfood `professional` via settings
- Document in changelog

---

## File creation checklist

| File | Phase |
|------|-------|
| `styles/solomon-theme.css` | 1 |
| `context/SolomonThemeContext.js` | 1 |
| `hooks/useSolomonTheme.js` | 1 |
| `components/solomon/SolomonAppShell.js` | 2 |
| `components/solomon/SolomonBottomNav.js` | 2 |
| `components/solomon/SolomonMoreMenu.js` | 2 |
| `components/solomon/SolomonProfessionalHome.js` | 3 |
| `components/solomon/SolomonMetricRow.js` | 3 |
| `components/solomon/SolomonSessionHeader.js` | 4 |
| `components/solomon/SolomonDataPointsPanel.js` | 4 |
| `components/solomon/SolomonFaultRanking.js` | 4 |
| `components/solomon/SolomonDiagnosticProgress.js` | 4 |
| `components/solomon/SolomonConfidenceBadge.js` | 4 |
| `pages/solomon/settings.js` | 7 |

---

## Phase dependency graph

```
Phase 1 (tokens)
    ↓
Phase 2 (shell/nav) ──→ Phase 3 (home)
    ↓                        ↓
Phase 4 (session components) ←┘
    ↓
Phase 5 (wizard screens)
    ↓
Phase 6 (supporting pages)
    ↓
Phase 7 (settings/persistence)  ← can start after Phase 1, complete before Phase 3 ship
    ↓
Phase 8–10 (polish, a11y, QA)
```

**Recommended first PR:** Phase 1 only (invisible to users).  
**Recommended second PR:** Phase 7 (settings) + Phase 1 — enables internal testing.  
**Recommended third PR:** Phase 2 + 3 (nav + home).  
**Then:** Phases 4–5 (session UX).

---

## Open decisions (resolve before Phase 3)

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Should Professional show Signature hero as optional? | No — clean separation |
| 2 | Re-enable elimination/fault ranking on Signature mobile too? | Later — Professional first |
| 3 | Notifications bell on home? | Omit until real notification feature exists |
| 4 | Session timer on diagnostic screen? | Phase 5 optional — compute from `created_at` |
| 5 | Confidence trend graph? | Defer — no historical series stored |
| 6 | Staff `/settings` vs `/solomon/settings`? | Solomon settings for appearance; staff company settings stay at `/settings` |

---

## Success criteria

- [ ] User can switch Signature ↔ Professional in settings
- [ ] Signature experience matches pre-change behavior
- [ ] Professional home shows real sessions, no fake KPIs
- [ ] Professional session answers: appliance, hypothesis, confidence, data collected, next test
- [ ] All existing APIs and diagnostic outputs unchanged
- [ ] SVG appliance illustrations still used (no photos)
- [ ] Status colors retain semantic meaning

---

*Implementation should begin only after review of [professional-skin-audit.md](./professional-skin-audit.md) and approval of phase order.*
