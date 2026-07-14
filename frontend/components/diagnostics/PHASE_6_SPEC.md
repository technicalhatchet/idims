# Phase 6 — Diagnostic Intelligence Engine (DMA)

**Status:** Locked for implementation  
**Last updated:** 2026-06-24  
**Philosophy:** Deterministic, explainable, rule-based. **No AI / ML in Phase 6.**

Phase 6 is where structured wizard data, the knowledge registry, and elimination reasoning connect into a **Diagnostic Intelligence Engine** that answers:

- What has been confirmed vs ruled out vs still unknown?
- Which **failure categories** does the evidence support?
- What **wizard step** should the technician visit next?
- What is the **audit trail** of the diagnostic session?

Office and managers see the same evidence and timeline on the work order — not tech-only.

---

## Relationship to prior phases

| Phase | What exists |
|-------|-------------|
| 1–2 | Wizard UI + engine |
| 3 | Configuration architecture (`WizardDefinition`, templates) |
| 4 | Conditional routing (complaint chips, prerequisites, field visibility) |
| 5 | Smart fields, measurement knowledge registry, field bindings, elimination banner, last-readings API |
| **6** | **Evidence scoring, next-best step, timeline, auto-note bullets, DMA historical nudges** |

Phase 5 built the knowledge registry (measurements, elimination configs, `dmaTags`). Phase 6 **connects the dots** — it does not invent new domain knowledge.

---

## Non-goals (Phase 6)

- LLM / AI explanations or narrative generation beyond **template bullets**
- Machine learning, Bayesian inference, or opaque “confidence” percentages
- Manufacturer-specific override tables (deferred)
- Component evidence in the **primary** tech UI (internal until 6b expand view)
- Pattern discovery / outcome learning as automated scoring (6f reports only; may come sooner as read-only analytics)

---

## Core concepts

### Diagnostic Evidence (not “confidence”)

Scores represent **accumulated diagnostic evidence** from completed checks — not statistical probability.

**UI labels:** “Diagnostic Evidence”, “Evidence Score”, or “Evidence Strength”.

Example:

```
Diagnostic Evidence — based on 7 completed checks

Defrost System     ████████░░  82
Air Leak           ███░░░░░░░  34
Airflow            ██░░░░░░░░  21
```

**Display rule:** Show **top 3 categories by evidence score only** in the primary panel. Full list available in expanded/manager view later.

Scores clamp **0–100** for display. Internal ledger keeps per-rule contributions for explainability.

### Three evidence states (do not lump together)

| State | Meaning | Example |
|-------|---------|---------|
| **Confirmed** | Test proves failure or success | Heater OL → heater confirmed failed |
| **Less likely** | Evidence reduced but category not dead | Heater good → Defrost category −30, not zero |
| **Unknown** | Not tested | Thermistor blank → no score change |

**Elimination engine (Phase 5)** handles binary suspect/confirm/ruled-out hypotheses.  
**Intelligence engine (Phase 6)** handles **weighted category evidence** and **component drill-down**.

Components can reach **0 / eliminated** while the parent category remains > 0 (e.g. heater good does not kill entire Defrost system).

### Layer 1 — Categories (visible)

Major appliance **systems** — how technicians actually think.

**Refrigerator pilot categories:**

| ID | Label |
|----|-------|
| `air_leak` | Air Leak |
| `defrost_system` | Defrost System |
| `airflow` | Airflow |
| `sealed_system` | Sealed System |
| `controls_sensors` | Controls / Sensors |
| `water_system` | Water System |
| `ice_maker` | Ice Maker |

Pilot focus: `not_cooling` paths — water/ice maker rules may be minimal until expanded.

### Layer 2 — Components (internal until expanded)

Shown only when technician **expands a category** or opens diagnosis detail (6b UI).

Example under `defrost_system`:

- `heater`
- `defrost_thermostat`
- `thermistor`
- `control_board`

---

## Architecture

```
Diagnostic Wizard (live payload + routing + measurements)
        │
        ▼
┌─────────────────────────────────────────┐
│  diagnosticIntelligenceEngine.ts        │  ← pure functions, NO UI
│  • evaluateEvidence()                   │
│  • getEvidenceLedger()                  │
│  • getComponentEvidence(categoryId)     │
│  • rankNextWizardSteps()                │
│  • buildAutoNoteBullets()               │
└─────────────────────────────────────────┘
        │ reads
        ▼
┌──────────────┬────────────────┬──────────────────┐
│ testCatalog  │ evidenceRules  │ existing Phase 5 │
│ (stable IDs) │ per template   │ measurements     │
│ → fields     │ JSON           │ elimination      │
│ → stepKeys   │ + dmaTags      │ routing          │
└──────────────┴────────────────┴──────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  UI — tech                              │
│  • Category evidence panel (top 3)      │
│  • Evidence ledger (click score → why)  │
│  • Next step reorder + highlight        │
│  • Review: auto-note bullet draft       │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  UI — office / manager                  │
│  • Same evidence + ledger on WO view    │
│  • Diagnostic timeline                  │
│  • DMA similar-repair nudges (6d)       │
└─────────────────────────────────────────┘
```

**Separate layers — do not merge:**

| Layer | Responsibility |
|-------|----------------|
| Routing (4) | Which steps are enabled |
| Elimination (5) | Suspect / confirm / ruled-out hypotheses |
| **Intelligence (6)** | Evidence scores, next step, timeline, auto-note |

---

## Test ID catalog (Option B)

Stable **test IDs** decouple rules from `sectionId.fieldId` paths.

```ts
interface DiagnosticTestDefinition {
  testId: string;           // e.g. "ff_cabinet_temp"
  label: string;
  templateId: string;
  fieldKey?: string;        // maps to wizard field
  knowledgeId?: string;     // maps to measurement catalog
  wizardStepKey?: string;   // maps to routing step key
}
```

Rules reference `testId`, `chip`, `field`, or `measurement` clauses (reuse `conditionMatcher` from Phase 4/5).

Timeline events use `testId` and `stepKey` for stable logging.

**Location:** `knowledge/tests/refrigerator.json` (pilot), registry in `testCatalog.ts`.

---

## Evidence rules

Data-driven JSON per template. Evaluated on **every payload change** (same cadence as routing/elimination).

```ts
type EvidenceEffect =
  | { effect: 'increase'; value: number }
  | { effect: 'decrease'; value: number }
  | { effect: 'confirm' }           // target → 100 (components)
  | { effect: 'unlikely'; value: number }  // soft decrease
  | { effect: 'eliminate' };        // component impossible

interface EvidenceRule {
  id: string;
  when: RoutingWhenClause | { type: 'test'; testId: string; /* ... */ };
  target: string;                   // category or component id
  targetLayer: 'category' | 'component';
  effect: EvidenceEffect;
  explanation: string;              // shown in ledger
  dmaTags?: string[];
  recommendStepKey?: string;      // boosts step in next-best ranking
}
```

**Example rules:**

```json
{
  "id": "heavy_frost_defrost",
  "when": { "type": "field", "path": "visual_inspection.frost_present", "equals": "yes" },
  "target": "defrost_system",
  "targetLayer": "category",
  "effect": { "effect": "increase", "value": 35 },
  "explanation": "Heavy frost indicates defrost system failure.",
  "recommendStepKey": "defrost"
}
```

```json
{
  "id": "heater_open",
  "when": { "type": "measurement", "knowledgeId": "defrostHeaterOhms", "statusIn": ["critical"] },
  "target": "heater",
  "targetLayer": "component",
  "effect": { "effect": "confirm" },
  "explanation": "Open defrost heater confirms heater failure.",
  "dmaTags": ["defrost_heater"]
}
```

```json
{
  "id": "door_good_air_leak",
  "when": { "type": "field", "path": "visual_inspection.door_alignment", "equals": "good" },
  "target": "air_leak",
  "targetLayer": "category",
  "effect": { "effect": "decrease", "value": 35 },
  "explanation": "Door alignment good — air leak less likely."
}
```

**Scoring behavior:**

- `increase` / `decrease`: add/subtract from target score (clamp 0–100).
- `confirm`: component evidence → 100; category may still move via other rules.
- `unlikely`: subtract `value` from category; do not zero entire category unless logically required.
- `eliminate`: component → 0 / marked eliminated; category only if no remaining components plausible.
- **Unknown fields:** neutral — no penalty, no reward.

**Evidence ledger** (explainability):

```
Defrost System — 82
  +35  Heavy frost observed
  +20  Fresh food warm (55°F)
  +15  Freezer still cold (18°F)
  +12  Defrost heater open (OL)
```

---

## Pilot scope (6a)

| Item | Decision |
|------|----------|
| Template | `refrigerator` |
| Complaint focus | `not_cooling` rule **content**, but engine runs whenever `templateId === 'refrigerator'` (**no chip gate**) for easier testing |
| Visible UI | Top **3** categories by evidence score |
| Next best test | **Wizard step** level — reorder + highlight enabled steps not yet visited |
| Auto-note | **Bullet list** on Review step (deterministic template, no AI) |
| Timeline | Live log per step visit; persist on save |

---

## Next-best wizard step (6a)

Rank **enabled, not-yet-visited** steps:

1. Highest `recommendStepKey` from fired evidence rules (explicit)
2. Steps whose `wizardStepKey` maps to tests for **top evidence category**
3. Prerequisite order from Phase 4 routing config
4. Default wizard order as tiebreaker

**UI:** Suggested step moves up in step list + visual highlight (ring/badge). **Do not** force navigation.

---

## Diagnostic timeline

### Live (6a)

Append events during wizard session:

```ts
interface DiagnosticTimelineEvent {
  at: string;              // ISO timestamp
  stepKey: string;
  action: 'entered' | 'completed' | 'field_updated';
  testId?: string;
  fieldKey?: string;
  payload?: Record<string, unknown>;  // optional snapshot
}
```

- Hold in wizard context + diagnostic **draft** JSON while editing.
- On field change after step complete → `field_updated` (append-only; do not rewrite history).

### Persist (6a)

Embed in diagnostic note JSON on save:

```json
{
  "templateId": "refrigerator",
  "appointmentId": "...",
  "fields": { },
  "timeline": [ ],
  "evidenceSnapshot": { }
}
```

No new DB table in 6a.

### Office view

Read `timeline` + `evidenceSnapshot` from saved Diagnostic Results note.

### Later (6b+)

Optional `diagnostic_events` table or DMA record for cross-WO analytics and pattern discovery.

---

## Auto-note bullets (6a on Review step)

**Not** full narrative prose. Deterministic bullet list from structured data + evidence ledger.

Example output on Review step (editable before save):

```
• Customer complaint: Not cooling
• Fresh food: 55°F — above normal range
• Freezer: 18°F — cold
• Door alignment: Good
• Evaporator fan: Running
• Heavy frost observed
• Defrost heater: Open (OL)
• Diagnostic evidence: Defrost System (82), Air Leak (34), Airflow (21)
• Leading hypothesis: Defrost system failure — heater confirmed open
```

Implementation: `buildAutoNoteBullets(context)` in intelligence engine; Review step displays + allows copy into note or auto-merge on save (product decision at implement time).

---

## DMA integration

### Tags (6a foundation)

- Evidence rules carry `dmaTags` aligned with measurement/elimination `dmaTags`.
- Diagnostic note save may sync tags to DMA record (extend existing DMA pipeline when ready).

### Historical nudges (6d)

- Query DMA repair outcomes: same equipment subtype + overlapping tags / problem codes.
- Apply **small bounded adjustments** to category evidence (+5 to +15 max per category).
- Ledger line: `+8 Similar repairs: defrost heater (12 cases)`.
- **Never override** `confirm` / `eliminate` effects from live measurements.

### Pattern discovery (6f / sooner)

- Read-only reports: callback rates, parts success, common fixes by complaint + evidence path.
- Does not auto-change live evidence scores until explicitly designed.

---

## Sub-phases (implementation order)

| Sub-phase | Deliverable |
|-----------|-------------|
| **6a** | `diagnosticIntelligenceEngine.ts`, test catalog, refrigerator evidence rules, category panel (top 3) + ledger, auto-note bullets on Review |
| **6b** | Next-best step reorder/highlight; component evidence on category expand |
| **6c** | Timeline UI (tech + manager); persist in note JSON |
| **6d** | DMA historical nudges on evidence |
| **6e** | Richer auto-note / optional merge into saved note body |
| **6f** | Pattern discovery reports; outcome feedback loop |

---

## File layout (planned)

```
frontend/components/diagnostics/
  intelligence/
    diagnosticIntelligenceEngine.ts
    evidenceTypes.ts
    rankNextWizardSteps.ts
    buildAutoNoteBullets.ts
    timeline.ts
  knowledge/
    tests/
      refrigerator.json          # test ID catalog
    evidence/
      refrigerator.json          # evidence rules (pilot)
  components/
    CategoryEvidencePanel.js     # top 3 + ledger
    DiagnosticTimeline.js        # 6c
  PHASE_6_SPEC.md                # this document
```

---

## Type exports (wizard context extension)

```ts
interface DiagnosticIntelligenceResult {
  categories: Array<{
    id: string;
    label: string;
    evidence: number;
    rank: number;
  }>;
  ledger: Array<{
    target: string;
    targetLayer: 'category' | 'component';
    delta: number;
    explanation: string;
    ruleId: string;
  }>;
  componentsByCategory: Record<string, Array<{ id: string; label: string; evidence: number; state: 'confirmed' | 'unlikely' | 'unknown' | 'eliminated' }>>;
  recommendedStepKeys: string[];
  autoNoteBullets: string[];
  timeline: DiagnosticTimelineEvent[];
}
```

Wire through `DiagnosticWizardContext` alongside existing `elimination` and `routing`.

---

## Acceptance criteria (6a pilot)

1. Open refrigerator diagnostic → category evidence panel shows up to **3** categories with scores and “based on N checks”.
2. Enter temps, frost yes, heater OL → scores update live; click category → ledger shows rule breakdown.
3. Elimination banner and evidence panel coexist without contradiction (heater confirm + defrost category still > 0 when heater good).
4. Review step shows **bullet auto-note** from current payload + evidence.
5. Engine is pure TypeScript — unit-testable with fixture payloads; no UI in engine module.
6. `npx tsc --noEmit` passes.

---

## Decisions log

| Date | Decision |
|------|----------|
| 2026-06-24 | No AI in Phase 6 |
| 2026-06-24 | Terminology: Diagnostic Evidence, not Confidence |
| 2026-06-24 | Top 3 categories only in primary UI |
| 2026-06-24 | Refrigerator template always runs evidence engine (no chip gate) for testing |
| 2026-06-24 | Next-best at wizard **step** level; reorder + highlight |
| 2026-06-24 | Separate intelligence layer from elimination |
| 2026-06-24 | Stable test ID catalog (Option B) |
| 2026-06-24 | Auto-note: bullet list on Review in 6a |
| 2026-06-24 | Timeline: live log; persist in note JSON on save |
