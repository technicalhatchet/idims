# DS-5 — Measurement evaluation snapshots + ranking loop

**Status:** Implemented  
**Depends on:** DS-1, DS-4

## Goal

Persist frozen measurement evaluation at submit time and feed abnormal interpretations into the unified candidate ranker — without auto-condemning components from a single out-of-range reading.

## In scope

- Persist `rawInput`, `parsedValue`, `unit`, evaluation snapshot (status, message, expected range used), optional `context`, `evaluatedAt`
- WO save/reload round-trip via `procedureRuns.stepEvaluations`
- Review/presentation/effects prefer stored snapshot over live re-evaluation
- `deriveMeasurementCandidateAdjustments` — re-derived at rank time from snapshots + `measurementEffectRegistry`
- Prove **measurement → interpretation → ranking changes** (37 VAC safety test)

## Out of scope

- Full evidence graph rewrite, Bayesian engine, ontology expansion, UI redesign
- Fabricating measurement context not available at submit
- DS-6 confirm semantics

## Key files

| File | Role |
|------|------|
| `procedures/types.ts` | `ProcedureStepEvaluationSnapshot`, `stepEvaluations` |
| `procedures/buildProcedureStepEvaluationSnapshot.ts` | Build + restore snapshot |
| `procedures/resolveProcedureStepMeasurementEvaluation.ts` | Prefer snapshot |
| `procedures/procedureRunner.ts` | Write snapshot on measurement submit |
| `session/measurementEffectRegistry.ts` | knowledgeId+status → candidate adjustments |
| `session/candidates/measurementEffects.ts` | Derive adjustments from snapshots |
| `session/getNextDiagnosticActions.ts` | Apply measurement adjustments after branch |

## Tests

| ID | Description |
|----|-------------|
| K | Evaluation status/message/expected range survive serialize reload |
| L | Raw `stepInputs` preserved alongside snapshot |
| M | 37 VAC vs 110–130 VAC boosts investigation path, does not confirm control board |

## Definition of Done

- [x] Snapshot written on measurement submit
- [x] Review/presentation uses snapshot when available
- [x] Round-trip through serialize session / procedureRuns
- [x] Measurement influences unified ranking
- [x] Tests K, L, M pass
- [x] `npx tsc --noEmit` passes
