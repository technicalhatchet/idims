# DS-3 — Wire unified API to existing recommendation UI

**Status:** Complete  
**PR scope:** One PR. Presentation only — no navigation rewrite.

## Goal

`getNextDiagnosticActions()[0]` feeds existing Solomon recommendation surfaces. User-visible behavior should match or narrowly improve current suggestions.

## Out of scope

- Wizard step reordering or dynamic navigation mode
- Branch boosts (DS-4) — wire hook points only if needed
- Confirm softening (DS-6)

## Files to modify

| File | Change |
|------|--------|
| `DiagnosticResultsForm.js` | Build `DiagnosticSession` via hydrate; call `getNextDiagnosticActions`; pass results into wizard context |
| `procedureWizardLead.ts` | Prefer unified top candidate for OEM step injection when type is `service_procedure`; fall back to legacy merge if empty |
| `WizardSuggestedStep.tsx` | Top `wizard_step` candidate drives suggestion label + jump index |
| `SolomonProcedurePanel.js` | Optional: highlight procedure matching top `service_procedure` candidate (bannerOnly path can stay lean) |

## Integration pattern

```text
DiagnosticResultsForm
  hydrateDiagnosticSession(payload, workOrder, evals)
  getNextDiagnosticActions({ session, wizardContext, procedureContext })
  wizardContext.intelligence.recommendedStepKeys ← derived from ranked wizard_step candidates (backward compat)
  wizardContext.unifiedCandidates ← optional new field for dev/debug
```

**Backward compat:** Keep populating `recommendedStepKeys` from unified ranker output so any consumer not yet migrated still works.

## Replan triggers (initial)

Call `getNextDiagnosticActions` again when:

- Wizard step completed (`handleWizardStepChange` / timeline complete)
- `handleProcedureRunChange` when status → `completed` or branch applied
- Complaint chips / error codes change

**Debounce** field-level changes 300–500ms if any replan is tied to `onFieldChange`.

## OEM nav gate

No change to `oemProcedureNavGate` — remains independent.

## Tests

- Manual smoke: WFW8300 door-lock path — OEM suggestion still appears
- Unit: `mergeOemProcedureWizardSteps` receives same effective first key as before for golden fixtures
- Regression O: wizard Next/Previous unchanged

## Definition of Done

- [x] `DiagnosticResultsForm` uses hydrate + `getNextDiagnosticActions`
- [x] `WizardSuggestedStep` reflects unified top wizard candidate
- [x] `procedureWizardLead` uses unified top OEM candidate when applicable
- [x] `recommendedStepKeys` still populated for compat
- [x] Replan on step/procedure complete (debounced field changes)
- [x] `npx tsc --noEmit` passes

## Cursor stop line

Do not implement branch extension scoring or confirm behavior changes in this PR.
