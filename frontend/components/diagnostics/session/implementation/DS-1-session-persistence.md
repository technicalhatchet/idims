# DS-1 — Session types, hydrate/serialize, WO persistence

**Status:** Implemented (Mar 2026)  
**PR scope:** One PR only. Stop when DoD is met.

## Goal

Create the `DiagnosticSession` aggregation type and fix WO save/load so diagnostic position and OEM runs survive reload.

## Out of scope

- Unified ranking, branch wiring, UI changes beyond minimal hydrate hooks
- Changing intelligence, elimination, or procedure runner behavior

## Files to create

| File | Purpose |
|------|---------|
| `session/types.ts` | `DiagnosticSession`, supporting types |
| `session/hydrateDiagnosticSession.ts` | Payload → session |
| `session/serializeDiagnosticSession.ts` | Session → payload |
| `session/index.ts` | Public exports |
| `session/__tests__/hydrateSerialize.test.ts` | Tests A, B |

## Files to modify

| File | Change |
|------|--------|
| `frontend/constants/diagnosticTemplates.js` | `parseDiagnosticNotePayload` / `serializeDiagnosticNotePayload` — round-trip session fields |
| `frontend/components/work_orders/DiagnosticResultsForm.js` | Optional: use hydrate on load if it simplifies; **minimum** ensure save path includes session fields in emitted payload |

## Types (v1 — minimal persisted core)

```ts
export type DiagnosticSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'repair_outcome_pending'
  | 'repair_successful'
  | 'unresolved'
  | 'abandoned';

export type DiagnosticSession = {
  sessionId: string;
  appliance: {
    ontology: string;
    manufacturer: string | null;
    model: string | null;
    platform: string | null;
  };
  symptoms: DiagnosticSymptom[];
  state: {
    status: DiagnosticSessionStatus;
    currentHypothesisId: string | null;
    currentComponentId: string | null;
  };
  navigation: {
    currentStepKey: string | null;
    visitedStepKeys: string[];
    wizardMode: 'linear' | 'guided'; // no "dynamic" until it exists
  };
  /** Facts persisted on WO — not intelligence output */
  payload: DiagnosticSessionPayload;
  /** Derived at hydrate time — optional cache, not source of truth */
  derived?: {
    intelligence?: DiagnosticIntelligenceResult | null;
    elimination?: EliminationEvaluationResult | null;
    hydratedAt: string;
  };
};

/** Round-trip compatible with existing WO payload shape */
export type DiagnosticSessionPayload = {
  templateId: string;
  appointmentId?: string;
  fields: Record<string, unknown>;
  visitedStepKeys: string[];
  currentStepKey: string | null;
  procedureRuns: Record<string, ProcedureRunState>;
  activeProcedureId: string | null;
  timeline: DiagnosticTimelineEvent[];
  evidenceSnapshot: unknown | null;
  skippedOemWizardStep?: boolean;
  oemRepairDecisionPending?: string | null;
  oemRepairDecision?: string | null;
  autoNoteBullets?: string[];
  autoNoteEdited?: boolean;
  autoNoteFormat?: string;
  includeAutoNoteInSummary?: boolean;
  // extend only when existing payload already uses the field
};
```

**Do not** add full `hypotheses[]` / `components[]` arrays to persisted session in DS-1. Populate in `derived` via `evaluateDiagnosticIntelligence()` when callers pass eval context into hydrate options.

## Hydrate mapping

```text
payload.templateId + workOrder make/model + platform resolution
  → session.appliance

complaint chips + error codes from fields
  → session.symptoms

payload.visitedStepKeys / currentStepKey
  → session.navigation

payload.procedureRuns / activeProcedureId / timeline / fields / flags
  → session.payload

optional: run intelligence + elimination
  → session.derived
```

**Rule:** Missing data → `null` / `[]` / `unknown` — never infer good.

## Serialize mapping

```text
session.payload.* → existing WO payload fields (preserve all legacy keys)
```

`sessionId` may live in payload as `_diagnosticSessionId` or be derived from WO id + note id — pick one and document in code comment.

## Persistence fix (critical)

Update `serializeDiagnosticNotePayload` and `parseDiagnosticNotePayload` to include at minimum:

```js
visitedStepKeys
currentStepKey
procedureRuns
activeProcedureId
skippedOemWizardStep
oemRepairDecisionPending
oemRepairDecision
```

Verify `WorkOrderNotes.js` save path passes full payload from `DiagnosticResultsForm` (not a stripped subset).

## Tests

### A — Hydration

Fixture: payload with `currentStepKey`, `visitedStepKeys`, `procedureRuns`, `timeline`, `evidenceSnapshot`.  
Assert `hydrateDiagnosticSession()` preserves equivalent navigation + payload facts.

### B — Serialization round-trip

`serialize(hydrate(payload))` preserves all session fields listed in persistence fix.

### C — Save/reload contract (unit-level)

Given session with `currentStepKey=X`, `visitedStepKeys=[A,B,X]`, `procedureRuns={P1: ...}`:  
`parse(serialize(payload))` equals those fields.

(Add integration test against `diagnosticTemplates.js` functions directly.)

## Definition of Done

- [x] `session/types.ts` exists
- [x] `hydrateDiagnosticSession` / `serializeDiagnosticSession` implemented
- [x] WO note parse/serialize preserves session fields
- [x] Tests A, B, C pass (`npm run test:diagnostic-session`)
- [x] `npx tsc --noEmit` passes
- [x] No changes to rankers, procedure runner, or wizard navigation logic

## Cursor stop line

Do not implement `getNextDiagnosticActions`, candidate types, or branch wiring in this PR.
