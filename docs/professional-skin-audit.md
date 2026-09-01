# Solomon Professional Skin — System Audit

**Date:** 2026-08-31  
**Scope:** Solomon Diagnostic Wizard (`/solomon/*`) and shared diagnostic presentation layer  
**Status:** Audit only — **no implementation changes made**  
**Reference:** Professional mobile mockups (enterprise field-service dashboard + diagnostic session + splash)

---

## Executive summary

Solomon is **one Next.js Pages Router PWA** with a well-separated diagnostic engine (`components/diagnostics/`) and a Solomon-specific presentation layer (`components/solomon/`). The wizard itself is shared via `DiagnosticResultsForm.js`, which already branches on `variant="mobile"` and `solomonMobileLayout`.

**Good news for a second skin:**
- Lifecycle semantics are centralized (`solomonDiagnosticStatus.js`).
- List/glass styling is partially centralized (`solomonListPageUi.js`).
- Intelligence/reasoning logic is separate from Solomon chrome (`reasoningPresentation.ts`, `diagnosticIntelligenceEngine.ts`).
- No duplicate diagnostic apps exist today.

**Main risks:**
- Styling is **hard-coded hex + Tailwind** across ~45 Solomon files — no theme switch exists.
- Solomon **ignores** global `ThemeContext` and forces dark via `SolomonHead`.
- `DiagnosticResultsForm` is shared with work orders — Solomon-only changes must stay behind flags/tokens.
- Professional mock assumes **bottom navigation + metrics row** — neither exists in Solomon today.
- Hero home is **image-artboard driven** (`SolomonHeroArtboard`) — Professional home likely needs a **structural alternate**, not just recoloring.

**Architectural goal confirmed:** Same Solomon brain (engine, sessions, DMA, SVGs, APIs). Different presentation suit (Signature vs Professional).

---

## 1. Application architecture

| Layer | Location | Notes |
|-------|----------|-------|
| Routes | `frontend/pages/solomon/` | 12 routes; no `getLayout`; each page composes shell inline |
| App shell | `pages/_app.js` | `ThemeProvider`, `UIPreferencesProvider`, Auth0, Solomon prefetch |
| PWA | `SolomonHead.js`, `manifest-solomon.json` | `theme-color: #0A0F1E`, `color-scheme: dark`, portrait standalone |
| Home | `SolomonHomePage` + `SolomonHeroArtboard` | Hero artboard + CTA + 2×2 menu grid |
| List/search | `SolomonPageMain` + `SolomonPageAtmosphere` + `SolomonPageHeader` | diagnostics, outcomes, knowledge, codes |
| Wizard | `SolomonMobileShell` + `SolomonWizardHeader` | diagnose, edit diagnostic, new outcome |
| Diagnostic engine | `components/diagnostics/` | Routing, evidence, elimination, measurements, wizard registry |
| Wizard bridge | `components/work_orders/DiagnosticResultsForm.js` | Integrates engine → wizard → panels |
| Offline | `lib/solomonOfflineWrites.js`, IndexedDB | Standalone diagnostics + pending sync |
| Auth | `hooks/useSolomonAuth.js` | DIY + staff roles, sessionStorage fallback |

### Solomon routes

| Route | Purpose |
|-------|---------|
| `/solomon` | Home |
| `/solomon/start` | DIY appliance picker |
| `/solomon/diagnose` | New diagnostic wizard |
| `/solomon/diagnostics` | Session list |
| `/solomon/diagnostics/[id]` | View/edit/detail |
| `/solomon/outcomes` | Repair outcomes list |
| `/solomon/outcomes/new`, `[id]` | Outcome CRUD |
| `/solomon/knowledge` | Repair memory search |
| `/solomon/codes`, `/solomon/codes/[id]` | Error code lookup |
| `/solomon/signup` | DIY enrollment |

---

## 2. Frontend component hierarchy

### Shell / layout (presentation)

- `SolomonPageMain.js` — scroll pages, safe-area padding
- `SolomonMobileShell.js` — full-screen wizard (`#0f172a`, `data-mobile-form`)
- `SolomonPageHeader.js` / `SolomonWizardHeader.js` — back + centered logo
- `SolomonPageAtmosphere.js` — decorative blur orbs (Signature)
- `solomonSafeArea.js` — top inset + sync banner offset
- `solomonHeroComposition.js` — artboard math, CTA classes, z-index stack

### Home (Signature-specific)

- `SolomonHeroArtboard.js` — 1124×1920 stage, wizard hand imagery, session card overlay
- `SolomonHomeMenuGrid.js` — 2×2 tiles (diagnostics, outcomes, knowledge, codes)
- `SolomonActiveSessionCard.js` — continue session on hero
- `SolomonSmarterCard.js` — promo card
- `SolomonHomeHeader.js` — logo + optional staff settings cog

### Diagnostic session (presentation + thin hooks)

- `SolomonEquipmentBar.js` — collapsible make/model/serial
- `SolomonLeadingHypothesisCard.js` — tap → reasoning sheet
- `SolomonReasoningSheet.js` / `reasoning/SolomonReasoningPanel.js`
- `SolomonDiagnosticReasoningView.js` — orchestrator on detail page
- `SolomonDiagnosticPath.js` — step timeline inside reasoning
- `useSolomonDiagnosticLead.js` — lead % for cards (reuses intelligence engine)

### Shared diagnostic UI (logic + presentation)

- `DiagnosticSectionFields.js` — wizard fields + `SmartMeasurementField`
- `DiagnosisConfidenceMeter.js`, `CategoryEvidencePanel.js`, `EliminationBanner.js`
- `ExplainRouteBanner.js`, `ComponentHealthPanel.js`, `EvidenceSnapshotPanel.js`
- `FieldGuidance.js` — help/recommendation rendering

---

## 3. Routing & navigation

**Current model:** Home hub → 2×2 menu tiles + primary CTA. Sub-pages use arrow/hat back. **No bottom tab bar.**

| Mock element | Current state |
|--------------|---------------|
| Bottom nav: Home / Sessions / + / Knowledge / More | **Does not exist** |
| Center FAB “New Diagnostic” | Primary CTA on home (not persistent) |
| Notifications bell | **Does not exist** on Solomon home |
| Hamburger menu | **Does not exist** |

**Staff settings:** `SolomonHomeHeader` supports cog → `/settings`, but `SolomonHomePage` **does not pass `isStaff`** — settings link is currently unreachable from Solomon home.

---

## 4. Layout system & responsive behavior

- **Mobile-first:** `max-w-lg` on most Solomon pages; wizard uses full viewport shell.
- **Safe areas:** `env(safe-area-inset-*)` handled in `solomonSafeArea.js` and `SolomonPageMain`.
- **iOS input zoom:** `globals.css` `.solomon-mobile-shell` forces 16px min font on inputs.
- **Android typography:** `solomonHeroComposition.js` includes rem inflation workarounds for hero CTA.
- **Desktop:** Solomon is usable but not optimized; list pages cap at `max-w-lg`. No tablet-specific layout.
- **Two shell backgrounds:** `#0A0F1E` (page main) vs `#0f172a` (mobile shell) vs `#070b14` (home/list shell) — inconsistent.

---

## 5. Current theme / styling architecture

### Tailwind (`tailwind.config.js`)

- `darkMode: 'class'` — used by main IDIMS app, **not Solomon**
- **No extended Solomon color tokens** — empty `theme.extend.colors`
- Inter font globally

### CSS variables (`styles/globals.css`)

- `--atomic-*` variables exist for marketing/dashboard pages
- **Solomon components do not consume CSS variables today**
- Solomon-specific: mobile form input sizing only

### Hard-coded Solomon palette (repeated)

| Token | Hex / pattern | Primary files |
|-------|---------------|---------------|
| Page shell (list) | `#070b14` | `solomonListPageUi.js` |
| Page shell (main) | `#0A0F1E` | `SolomonPageMain`, `SolomonHead`, PWA manifest |
| Glass surface | `#060a12` @ 78–86% | menu tiles, cards, inputs |
| Elevated panel | `#0D1525` | hypothesis card, sheets |
| Mobile shell | `#0f172a` | `SolomonMobileShell` |
| Brand primary | `#0089B9` → `#006a94` | CTAs, FAB, search buttons |
| Borders | `border-white/10`–`/25` | universal glass |
| Backdrop blur | `backdrop-blur-md` | Signature glass aesthetic |

### Partial token modules (best injection points)

1. `solomonListPageUi.js` — glass panels, inputs, list cards, filter chips
2. `solomonDiagnosticStatus.js` — lifecycle semantic colors (cyan/orange/emerald/purple/sky/gray)
3. `solomonHeroComposition.js` — `SOLOMON_PRIMARY_CTA_CLASS`, z-index, artboard
4. `SolomonHead.js` — PWA meta colors

### Global theme systems (unused by Solomon)

- `context/ThemeContext.js` — light/dark for main app
- `context/UIPreferencesContext.js` — `railPosition` only; **skips API load on `/solomon` paths**

---

## 6. Status semantics (must preserve)

Defined in `solomonDiagnosticStatus.js`:

| Semantic | Color family | Meaning |
|----------|--------------|---------|
| Diagnostic in progress | **Cyan** | Active wizard / open session |
| Repair outcome pending | **Orange** | Diagnostic done, outcome not finalized |
| Repair successful | **Emerald** | Confirmed repair |
| Repair memory | **Purple** | Accepted into DMA pool |
| Pending sync | **Sky** | Offline queue |
| Abandoned | **Gray** | Dropped session |

Professional skin may **restrain** saturation/glow but must not swap meanings (e.g., green ≠ in-progress).

---

## 7. Diagnostic engine vs presentation

### Business logic (do not duplicate)

| Concern | Location |
|---------|----------|
| Wizard routing | `routing/routingEngine.ts`, per-appliance `*Routing.ts` |
| Field visibility | `routing/fieldVisibilityEngine.ts` |
| Evidence scoring | `intelligence/diagnosticIntelligenceEngine.ts`, `knowledge/evidence/*.json` |
| Confidence % | `intelligence/evidenceDisplay.ts` |
| Elimination | `elimination/eliminationEngine.ts`, `knowledge/elimination/*.json` |
| Measurements | `knowledge/measurementRulesEngine.ts`, seed JSON |
| Template schema | `constants/diagnosticTemplates.js` |
| Session persistence | `useSolomonDiagnosticProgress`, IndexedDB stores |
| DMA APIs | `services/api/dmaApi.js` |

### Presentation (themeable)

| Concern | Location |
|---------|----------|
| Lifecycle badges/cards | `solomonDiagnosticStatus.js`, `solomonListPageUi.js` |
| Leading hypothesis card | `SolomonLeadingHypothesisCard.js` |
| Reasoning sheet/panel | `SolomonReasoningSheet.js`, `SolomonReasoningPanel.js` |
| Wizard chrome | `SolomonMobileShell`, `SolomonEquipmentBar` |
| Field rendering | `DiagnosticSectionFields.js` (shared — use tokens + `interfaceStyle` prop) |
| Appliance SVGs | `components/ui/ApplianceIcon.js` (neon cyan/orange strokes — may need theme-aware stroke tokens) |

### Solomon mobile suppressions (`DiagnosticResultsForm.js`)

When `solomonMobileLayout === true`:

| Panel | Shown on Solomon mobile? |
|-------|--------------------------|
| `SolomonLeadingHypothesisCard` | ✅ Yes |
| `SolomonReasoningSheet` | ✅ Yes (on demand) |
| `ExplainRouteBanner` | ❌ Commented out / disabled |
| `EliminationBanner` | ❌ Hidden |
| `CategoryEvidencePanel` (fault ranking) | ❌ Hidden |
| `DiagnosisConfidenceMeter` | ❌ Hidden |
| `SolomonReasoningPanel` (inline) | ❌ Hidden (sheet instead) |
| `ComponentHealthPanel` | ❌ Not in Solomon path |
| `SolomonInsightPeekBanner` | ❌ Disabled |

**Implication:** Professional session UI can **surface existing intelligence** in new presentation without engine changes — but must be deliberate about what Signature mobile intentionally hid.

---

## 8. Professional mock gap analysis

Legend: **A** = restyle only · **B** = structural change · **C** = create new · **D** = theming difficulty · **E** = do not change (logic)

### Splash / loading

| Element | Status | Notes |
|---------|--------|-------|
| Branded splash with wizard atom logo | **A/C** | PWA has manifest icons; no animated splash screen component |
| “Loading knowledge base…” | **C** | No dedicated splash route |
| Version footer | **E** | Could read from `package.json` — presentation only |

### Home / dashboard

| Mock element | Status | Real data source | Recommendation |
|--------------|--------|------------------|----------------|
| Header + logo + menu + notifications | **B/C** | Logo exists; menu/notify **C** | Professional shell component |
| Greeting (“Good morning, {name}”) | **A/B** | `useSolomonAuth().user` | Add contextual header |
| Primary “New Diagnostic” CTA | **A** | Exists on home | Reposition in Professional layout |
| Metrics row (4 KPI cards) | **C** | **No stats API today** | See §8.1 — derive or omit |
| Recent diagnostics list | **A/B** | `listStandaloneDiagnosticsOffline` | Already on `/solomon/diagnostics`; surface on home |
| Quick actions grid | **A** | Menu tiles map 1:1 | Restyle existing destinations |
| Knowledge search banner | **A** | `/solomon/knowledge` | Restyle `SolomonSmarterCard` or replace |
| Bottom navigation | **C** | N/A | New `SolomonBottomNav` — biggest structural add |
| Hero wizard hand artboard | **D** | Signature-only | Professional should **bypass** artboard home |

#### §8.1 Home metrics — what is real vs mock-only

| Mock metric | Available today? | How to obtain (no fabrication) |
|-------------|------------------|--------------------------------|
| Sessions this week | **Partial** | Client-side count from `listStandaloneDiagnosticsOffline` filtered by `created_at` |
| Avg confidence score | **Partial** | Client-side avg of `useSolomonDiagnosticLead` over recent sessions (computed, not stored) |
| Repair outcomes added | **Partial** | Count from outcomes list API/offline store |
| Knowledge base articles | **No** | No “article count” endpoint; error code count ≠ article count — **omit or show “Error codes” count via DMA search meta if API adds `total`** |
| Session time on active diagnostic | **Partial** | Would need timer from session `created_at` / `updated_at` — not currently displayed |

**Rule:** Professional home must not invent KPIs. Use computed client aggregates or omit cards.

### Diagnostic session (in-progress)

| Mock element | Status | Notes |
|--------------|--------|-------|
| Appliance photo | **A** | Use existing `ApplianceIcon` SVG — not photos |
| Make/model/serial/WO card | **B** | `SolomonEquipmentBar` is collapsible — promote to persistent session header |
| Session time | **C** | Not implemented |
| Confidence badge (HIGH) | **A** | `formatLeadCauseStrength` / intelligence tiers exist |
| Status IN PROGRESS | **A** | `resolveSolomonDiagnosticStatus` |
| Stage progress (Collect → Analyze → …) | **B/C** | Wizard has step N of M; mock shows **diagnostic phases** — map to wizard steps or add phase labels (presentation mapping, not new engine) |
| Data points list (Observed/Measured/Pending) | **B/C** | Fields exist per step; **no aggregate session list** — build from `payload.fields` + `measurementStatuses` |
| Most likely faults ranked | **A/B** | `CategoryEvidencePanel` exists but hidden on mobile — re-present in Professional |
| Leading hypothesis | **A** | `SolomonLeadingHypothesisCard` |
| Reasoning sections | **A** | `SolomonReasoningSheet` content is complete |
| Next steps / recommended test | **A** | In reasoning presentation |
| Bottom nav in session | **C** | New shell concern |

### Component detail (e.g., Defrost Heater)

| Mock element | Status | Notes |
|--------------|--------|-------|
| Dedicated component drill-down screen | **C** | No route today — could be reasoning sheet section or new slide-over |
| Large measured value + Normal badge | **A** | `SmartMeasurementField` + `MeasurementStatusBadge` |
| Reference range | **A** | `MeasurementReferenceCard` in knowledge registry |
| Confidence trend graph | **C** | No time-series confidence history stored |
| Quick actions grid | **B** | Some actions exist scattered (PDF, link outcome, import WO) |

### Knowledge / sessions / outcomes / codes

| Screen | Status |
|--------|--------|
| Repair memory search | **A** — `knowledge.js` |
| Error codes | **A** — `codes/index.js` (recent) |
| Diagnostics list | **A** — `diagnostics/index.js` |
| Outcomes list | **A** — `outcomes/index.js` |
| Settings / appearance | **C** — no Solomon settings page |

---

## 9. Reusable components discovered

**Already reusable (theme-aware candidates):**

- `SolomonPageHeader`, `SolomonPageMain`, `SolomonMobileShell`
- `solomonListPageUi` exports (glass input, panel, list card surfaces)
- `SolomonDiagnosticStatusBadge`, lifecycle resolvers
- `SolomonLeadingHypothesisCard`, `SolomonReasoningSheet`
- `ApplianceIcon`, `SolomonCategoryIcon`
- `SmartMeasurementField`, `MeasurementStatusBadge`
- `DiagnosticSectionFields`, `FieldGuidance`
- Menu tiles pattern in `SolomonHomeMenuGrid`

**Should become shared primitives (extract/refactor):**

- `MetricCard` (new — home KPI)
- `SessionCard` / `DiagnosticCard` (extract from list + active session)
- `DataPointRow` (new — aggregate field status)
- `ConfidenceBar` (extract from reasoning sheet + list headline meter)
- `FaultRankingList` (wrap `CategoryEvidencePanel` data)
- `DiagnosticProgress` (extract segmented bar from `SolomonActiveSessionCard`)
- `SolomonBottomNav` (new)
- `EmptyState`, `LoadingState` (partially inline today)

**Avoid duplicating:**

- `ProfessionalDataPoint` + `SignatureDataPoint` — use one component + tokens
- Separate diagnostic forms — keep single `DiagnosticResultsForm`

---

## 10. Components requiring refactoring

| Component | Why | Risk |
|-----------|-----|------|
| `solomonListPageUi.js` | Central glass tokens — must become theme-provider aware | Low |
| `solomonDiagnosticStatus.js` | Lifecycle colors — dual theme maps | Low |
| `solomonHeroComposition.js` | Signature-only — Professional bypasses | Medium |
| `SolomonHomePage.js` | Split Signature hero vs Professional dashboard | Medium |
| `DiagnosticResultsForm.js` | Add `interfaceStyle` prop; avoid duplicating logic | **High** — shared with WO |
| `DiagnosticSectionFields.js` | Hard-coded `#0A0F1E` mobile colors | Medium |
| `ApplianceIcon.js` | Hard-coded neon strokes | Low — tokenize stroke colors |
| `SolomonLeadingHypothesisCard.js` | Emerald accent hard-coded | Low |
| `UIPreferencesContext` / backend `UIPreferences` | Extend schema for `solomonInterfaceStyle` | Low |

---

## 11. Components requiring creation

| Component | Purpose |
|-----------|---------|
| `SolomonThemeProvider` / `useSolomonInterfaceStyle` | Signature vs Professional + persistence |
| `SolomonAppShell` | Chooses home layout + bottom nav |
| `SolomonBottomNav` | Home / Sessions / + / Knowledge / More |
| `SolomonProfessionalHome` | Dashboard layout (non-artboard) |
| `SolomonSessionHeader` | Persistent appliance identity in wizard |
| `SolomonDataPointsPanel` | Aggregate observed/measured/pending |
| `SolomonSettingsPage` or section | Appearance toggle |
| `SolomonMetricCard` | Optional KPI tiles |
| `SolomonMoreMenu` | Overflow nav target |

---

## 12. Screens requiring redesign vs simple theming

| Screen | Signature | Professional |
|--------|-----------|--------------|
| `/solomon` home | Hero artboard — keep | **New dashboard layout** |
| `/solomon/diagnose` | Mobile shell + wizard | Restructure header + data points panel |
| `/solomon/diagnostics/[id]` | View/edit + reasoning | Session header + progress emphasis |
| List pages (diagnostics, outcomes, knowledge, codes) | Glass list | **Mostly theming** + bottom nav padding |
| `/solomon/start` picker | Simple grid | Theming + nav |
| Signup | Form | Theming |
| Splash (optional) | N/A | New |

---

## 13. Hard-coded styling → token candidates

| Current | Proposed semantic token |
|---------|-------------------------|
| `#070b14`, `#0A0F1E`, `#0f172a` | `--solomon-bg-canvas`, `--solomon-bg-shell` |
| `#060a12`, `#0D1525` | `--solomon-surface`, `--solomon-surface-elevated` |
| `border-white/15` | `--solomon-border-subtle` |
| `#0089B9` gradients | `--solomon-primary`, `--solomon-primary-hover` |
| cyan/orange/emerald/purple lifecycle | `--solomon-status-*` per lifecycle key |
| `rounded-xl` (mixed `lg`/`xl`) | `--solomon-radius-card`, `--solomon-radius-control` |
| `shadow-[0_4px_18px_rgba(0,137,185,0.38)]` | `--solomon-shadow-primary` |
| `backdrop-blur-md` | `--solomon-glass-blur` (Signature on, Professional reduced/off) |

Implement via:
1. CSS variables on `html[data-solomon-theme="signature|professional"]`
2. Tailwind `theme.extend` referencing variables **or** small hook returning class maps

---

## 14. Responsive / mobile issues

| Issue | Severity |
|-------|----------|
| No persistent nav — deep pages require back stack | Medium |
| Hero artboard fragile on varied viewports (debug tooling exists) | Medium (Signature) |
| Professional mock assumes bottom nav safe-area — need `padding-bottom` on all pages | Medium |
| `max-w-lg` center column — fine for phone; tablet wastes space | Low |
| Shared WO mobile diagnostic may pick up token changes if not scoped | High |

---

## 15. Accessibility issues

| Issue | Notes |
|-------|-------|
| Status relies heavily on color | Badges include text labels — good; ensure Professional keeps text + icons |
| Touch targets | Hat back button meets 44px; some list chevrons small |
| Focus states | Glass inputs have focus rings; bottom nav must have visible focus |
| Screen reader | Reasoning sheet needs aria labels audit |
| Contrast | Professional must re-verify emerald/cyan on charcoal |
| Motion | Signature has spinners/glow; Professional should reduce `prefers-reduced-motion` |

---

## 16. Settings & persistence

**Today:**
- `UIPreferencesContext`: `railPosition` in localStorage + `users/me` settings API
- **Solomon paths skip** server preference load (`router.pathname.startsWith('/solomon')`)
- No appearance setting

**Recommended:**
- Add `solomonInterfaceStyle: 'signature' | 'professional'` to `ui_preferences` JSON (backend already accepts `Dict[str, Any]` in storage — extend Pydantic schema)
- Mirror to `localStorage` key `solomon_interface_style` for instant apply + offline
- Solomon-specific settings page at `/solomon/settings` (Professional “More” tab) — avoid coupling to staff-only `/settings`

---

## 17. Appliance illustrations

- **Source:** `components/ui/ApplianceIcon.js` — inline SVG, cyan `#00D4FF` + orange `#FF7A00` strokes with glow filters
- **Do not** add photo scraping or new asset pipeline
- **Professional:** Tokenize stroke colors (muted blue/gray); optional `glow="none"` for enterprise look
- Fault categories use `categoryIcons.js` (Font Awesome) — separate from appliance SVGs

---

## 18. Potential risks

| Risk | Mitigation |
|------|------------|
| Breaking Signature hero | Feature-flag home layout by theme |
| Breaking work order diagnostics | Scope token changes to `[data-solomon-theme]` descendants or Solomon-only wrappers |
| Duplicate navigation (menu grid + bottom nav) | Professional uses bottom nav; Signature keeps grid |
| Fabricated metrics | Client-compute only from real lists |
| Scope creep into engine | UI-only PRs per phase; no changes to `diagnosticIntelligenceEngine.ts` |
| PWA theme-color mismatch | Update `SolomonHead` from theme provider |
| Offline preference sync | localStorage first; merge server on login |

---

## 19. Comparison table

| Area | Current state | Professional changes | Risk | Recommendation |
|------|---------------|----------------------|------|----------------|
| **Theme system** | Hard-coded hex, no switch | CSS variables + `SolomonThemeProvider` | Medium | Phase 1 — foundation |
| **Home** | Hero artboard + 2×2 grid | Dashboard + metrics (real) + recent sessions | Medium | Alternate layout component |
| **Navigation** | Back + hub tiles | Bottom nav + More menu | Medium | New shell; Signature unchanged |
| **Wizard shell** | `SolomonMobileShell` | Session header + data points rail | Medium | Extend shell, don’t fork form |
| **Leading hypothesis** | Emerald card + sheet | Compact authoritative card | Low | Restyle + density tokens |
| **Reasoning** | Bottom sheet (good) | Denser typography, less glow | Low | Theme tokens only |
| **Fault ranking** | Hidden on mobile | Show ranked list | Low | Re-enable `CategoryEvidencePanel` data in new UI |
| **Confidence meter** | Hidden on mobile | Tier + % bar in session | Low | Presentation only |
| **Elimination** | Hidden on mobile | Collapsible section in reasoning | Low | Re-enable with Professional layout |
| **Data points** | Per-field in wizard | Aggregate list panel | Medium | Build from existing field map |
| **Measurements** | `SmartMeasurementField` | Row-based status in panel | Low | Reuse evaluation maps |
| **Lifecycle colors** | Centralized | Restrained variants | Low | Dual maps in status module |
| **List pages** | Glass cards | Flatter surfaces, bottom inset | Low | Token swap |
| **Error codes** | Emerald accents | Align to Professional primary | Low | Already isolated page |
| **Outcomes form** | `DmaFieldRecordForm` generic | Solomon professional skin | Medium | Phase 6 |
| **Settings** | Staff `/settings` unreachable | `/solomon/settings` appearance | Low | Extend `ui_preferences` |
| **Diagnostic engine** | Mature | **No change** | High if touched | **E — do not change** |
| **APIs / DB** | Stable | **No change** | High | **E — do not change** |
| **SVG appliances** | Neon strokes | Muted professional strokes | Low | `variant` prop on icon |
| **Splash** | None | Optional branded load | Low | Defer to Phase 8 |

---

## 20. Recommended implementation order (summary)

See `professional-skin-plan.md` for phased detail.

1. Theme tokens + provider (no visible change to Signature default)
2. App shell + bottom nav (Professional only)
3. Professional home dashboard
4. Shared session components (header, data points, fault list)
5. Wizard/session screen restyle
6. List/supporting pages
7. Settings + persistence
8. Responsive polish + splash (optional)
9. Accessibility pass
10. Regression testing (Signature + Professional)

---

## 21. Files to treat as canonical during implementation

```
frontend/components/solomon/                    # Presentation layer
frontend/components/diagnostics/              # Engine (read-only for skin)
frontend/components/work_orders/DiagnosticResultsForm.js  # Integration hub — careful
frontend/constants/diagnosticTemplates.js     # Schema (read-only)
frontend/components/ui/ApplianceIcon.js         # SVG illustrations
frontend/context/UIPreferencesContext.js        # Extend for persistence
backend/app/routers/app_settings.py             # Extend UIPreferences schema
frontend/components/solomon/solomonDiagnosticStatus.js
frontend/components/solomon/solomonListPageUi.js
frontend/components/solomon/solomonHeroComposition.js
```

---

*End of audit. Implementation must not begin until this document is reviewed and phases are approved.*
