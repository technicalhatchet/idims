# DS-7 — Diagnostic loop torture harness

**Status:** Implemented  
**Depends on:** DS-6

## Goal

Prove Solomon maintains diagnostic uncertainty as evidence accumulates and continuously re-ranks without premature component condemnation.

## Harness

| Path | Role |
|------|------|
| `session/__tests__/fixtures/fl-washer/scenarioKit.ts` | Shared scenario builders, evolution helpers |
| `session/__tests__/scenarios/fl-washer-torture.test.ts` | Full torture scenario + evolution table |
| `session/__tests__/fl-washer-wont-spin.test.ts` | Lightweight rank-delta regression (unchanged) |

Uses real `getNextDiagnosticActions`, `evaluateDiagnosticIntelligence`, procedure runner measurement path, and WO serialize/rehydrate.

## Stages covered

| Stage | Assertion style |
|-------|-----------------|
| Initial | Pool contains door, drain, motor |
| A Door good | Ranking flip door↔motor; no verified_failed |
| B Drain good | Ranking flip drain↔motor; door stays down |
| C Command present | Motor rises via branchBoost; no motor condemnation |
| D 37 VAC | Snapshot persists; measurementBoost visible |
| E Contradiction | Prior facts survive; discriminating pool remains |
| F Repeat completed | Completed OEM suppressed; history intact |
| G Noop branch | Graceful fallback when boost targets missing |
| Replay | Serialize/rehydrate behavioral equivalence |
| Order independence | door→drain ≡ drain→door ranking |

## Evolution table

The torture test prints a candidate evolution table on every run:

```
Stage   #1   #2   #3   Key evidence
```

Score breakdown tags: `b`=branch, `m`=measurement, `p`=penalty, `e`=legacy boost.

## Definition of Done

- [x] Torture scenario passes with behavioral assertions (not brittle absolute scores)
- [x] No premature `verified_failed` across scenario
- [x] `npm run test:diagnostic-session` passes
- [x] `npx tsc --noEmit` passes

## Out of scope

Canonical graph expansion, new hypothesis engine, wizard navigation reorder.
