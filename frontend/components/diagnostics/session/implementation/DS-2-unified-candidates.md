# DS-2 — Unified candidate pool + `getNextDiagnosticActions` (engine only)

**Status:** Complete (engine only — no UI wire)  
**PR scope:** One PR. No UI wiring.

## Goal

Single entry point that collects wizard + OEM recommendations into `NextTestCandidate[]`, filters, ranks, and returns — **without** changing what the UI displays yet.

## Out of scope

- `DiagnosticResultsForm` behavior change (except optional dev-only logging)
- Branch extension boosts (DS-4)
- Measurement eval snapshots (DS-5)
- Confirm softening (DS-6)

## Files to create

| File | Purpose |
|------|---------|
| `session/candidates/types.ts` | `NextTestCandidate`, weights config |
| `session/candidates/diagnosticWeights.ts` | `DEFAULT_DIAGNOSTIC_WEIGHTS` |
| `session/candidates/normalizeWizardCandidates.ts` | Wrap `rankNextWizardSteps` output |
| `session/candidates/normalizeOEMProcedureCandidates.ts` | Wrap `recommendServiceProcedures` output |
| `session/candidates/collectDiagnosticCandidates.ts` | Merge + dedupe |
| `session/candidates/filterEligibleDiagnosticCandidates.ts` | Hard eligibility |
| `session/candidates/rankDiagnosticCandidates.ts` | Score + sort |
| `session/getNextDiagnosticActions.ts` | Public API |
| `session/__tests__/candidates.test.ts` | Tests D–G, O, P, Q |

## Public API

```ts
export type GetNextDiagnosticActionsInput = {
  session: DiagnosticSession;
  /** Context required to run existing rankers unchanged */
  wizardContext: DiagnosticWizardContext; // or minimal adapter type
  procedureContext: RecommendServiceProceduresInput;
  limit?: number;
};

export type GetNextDiagnosticActionsResult = {
  candidates: NextTestCandidate[];
  leadHypothesisId: string | null;
  leadComponentId: string | null;
  blockedCandidates: NextTestCandidate[];
  debug?: NextTestCandidate[]; // top N with full scoreBreakdown when NODE_ENV=development
};

export function getNextDiagnosticActions(
  input: GetNextDiagnosticActionsInput,
): GetNextDiagnosticActionsResult;
```

## Normalization

### Wizard

Call existing `rankNextWizardSteps()` (or consume precomputed `intelligence.recommendedStepKeys` with same ordering logic).

```ts
{
  id: `wizard.${stepKey}`,
  type: 'wizard_step',
  target: stepKey, // or resolved component from step meta
  source: { system: 'wizard', id: stepKey },
  wizardStepKey: stepKey,
  procedureId: null,
  score: 0, // filled by ranker
  scoreBreakdown: { ..., existingSystemBoost: normalizedWizardScore },
}
```

### OEM

Call existing `recommendServiceProcedures()` unchanged.

```ts
{
  id: `oem.${procedureId}`,
  type: 'service_procedure',
  target: primaryComponentFromProcedure,
  source: { system: 'oem', id: procedureId },
  procedureId,
  wizardStepKey: null,
}
```

### Canonical / branch collectors

Return `[]` in DS-2. Stub functions exist for DS-4.

## Dedupe

Same `procedureId` or same `wizardStepKey` → one candidate. Merge `existingSystemBoost` from all sources.

## Eligibility (hard filters)

| Rule | Implementation hint |
|------|---------------------|
| Already performed wizard step | `visitedStepKeys` contains `wizardStepKey` |
| Already completed OEM procedure | `procedureRuns[id].status === 'completed'` and no invalidation flag |
| Routing prerequisite | Reuse `resolveWizardSteps` lock / `isStepKeyEnabled` |
| Upstream dependency | DS-2: routing prerequisites only; canonical graph in DS-7 fixtures |

Set `eligible: false`, `blockedReason`, move to `blockedCandidates` or filter from active list per product choice (document in code).

## Ranking (parity first)

**Phase 1 scoring:** map legacy scores to 0–1, store in `existingSystemBoost`. Other breakdown fields may be `0` until DS-4.

```ts
score =
  sum(weighted factors) +
  existingSystemBoost -
  deprioritizationPenalty -
  repeatPenalty;
```

**Parity acceptance:** For fixture sessions built from real washer templates, top candidate should match legacy leader (`recommendedStepKeys[0]` **or** top OEM when OEM lead is strong per `isStrongProcedureLead`) in ≥90% of fixtures unless documented exception.

## Tests

| ID | Description |
|----|-------------|
| D | Wizard `door_lock` → `type: wizard_step`, `wizardStepKey: door_lock` |
| E | OEM `w8178558-door-lock` → `type: service_procedure` |
| F | Duplicate procedure from two sources → one candidate, merged boost |
| G | Completed door-lock step/procedure → not in eligible top list |
| O | Wizard navigation code paths untouched (no imports from WizardProvider changed) |
| P | Procedure runner tests / smoke unchanged |
| Q | Intelligence eval still invoked; ranker consumes its output |

## Definition of Done

- [x] `NextTestCandidate` type exists
- [x] `getNextDiagnosticActions` implemented
- [x] Wizard + OEM normalizers call **existing** rankers
- [x] Dedupe + eligibility + ranking with configurable weights file
- [x] Tests D–G, parity note documented
- [x] **No** UI consumer switched yet
- [x] `npx tsc --noEmit` passes

## Cursor stop line

Do not wire `WizardSuggestedStep`, `procedureWizardLead`, or branch extension in this PR.
