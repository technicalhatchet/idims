# DS-6 — OEM confirm → supported (not auto verified_failed)

**Status:** Implemented  
**Depends on:** DS-5

## Goal

Procedure `confirm` increases support without auto-condemnation, repair prefill, or `verified_failed` — unless an explicit failure rule applies.

## Invariant

```
confirm  ≠  verified_failed
```

Unless:

- `evidenceId` matches explicit failure pattern (`*_failed`, `*_fault`, `*_open`)
- Abnormal frozen measurement snapshot on the same step
- Negative checkpoint on a `checkpoint_no` branch

## Files

| File | Change |
|------|--------|
| `intelligence/componentVerification.ts` | Explicit-failure detection + verification level mapping |
| `applyProcedureDiagnosticEffects.ts` | Soft confirm → `unlikely` + boost; explicit → `confirmed` |
| `procedureRunPresentation.ts` | Repair/disposition only on explicit failure confirms |
| `buildProcedureRunReview.ts` | "Supported" vs "Confirmed" labels |

## Tests

| ID | Description |
|----|-------------|
| N | Soft confirm → `supported`, no repair prefill, no `verified_failed` |
| — | Measurement failure confirm → `verified_failed` + repair gate |
| — | Soft confirm boosts motor procedure ranking without failure diagnosis |

## Out of scope

- Wizard evidence rule `confirm` semantics (field-level rules)
- Removing OEM `replace_*` outcome text from seeds
