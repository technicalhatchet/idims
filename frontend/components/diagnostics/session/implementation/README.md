# Solomon Diagnostic Session — Implementation Tickets

**Normative principles:** [`SOLOMON_DIAGNOSTIC_LOOP_V1.md`](../../knowledge/canonical/SOLOMON_DIAGNOSTIC_LOOP_V1.md)  
**This folder:** Bounded implementation tickets for Cursor. If docs conflict, the loop doc wins on philosophy; ticket files win on API names and file paths.

## Objective

Close the seams between existing Solomon systems **without rewriting them**:

- Wizard + `rankNextWizardSteps()`
- OEM + `recommendServiceProcedures()` + procedure runner
- Intelligence ledger + elimination
- Canonical ontology (FL washer v1)
- WO diagnostic payload

**Target loop:**

```text
TEST → RESULT → SESSION UPDATE → RE-RANK → NEXT TEST
```

## Rules for every ticket

1. **One ticket per PR** unless the user explicitly approves combining.
2. **Do not** delete existing rankers, rewrite OEM seeds, enable `reorderWizardStepsForIntelligence` for navigation, or build a second hypothesis engine.
3. **Do not** “clean up” unrelated diagnostic code while implementing a ticket.
4. Stop at the ticket’s Definition of Done — do not start the next ticket.

See [`SHARED_CONSTRAINTS.md`](./SHARED_CONSTRAINTS.md) for the full do-not-break list.

## Ticket order

| Ticket | Title | Depends on |
|--------|--------|------------|
| [DS-1](./DS-1-session-persistence.md) | Session types + hydrate/serialize + WO persistence | — |
| [DS-2](./DS-2-unified-candidates.md) | Candidate pool + `getNextDiagnosticActions` (engine only) ✅ | DS-1 |
| [DS-3](./DS-3-ui-wire.md) | Wire unified API to existing recommendation UI ✅ | DS-2 |
| [DS-4](./DS-4-branch-rerank.md) | Branch extension boosts + replan triggers ✅ | DS-2 |
| [DS-5](./DS-5-eval-snapshots.md) | Measurement eval snapshots + ranking loop ✅ | DS-4 |
| [DS-6](./DS-6-confirm-softening.md) | OEM confirm → supported (not auto verified_failed) ✅ | DS-5 |
| [DS-7](./DS-7-fl-scenario-harness.md) | FL washer torture harness (contradictory evidence) ✅ | DS-6 |

**Recommended implementation order:** DS-1 → DS-2 → DS-3 → DS-4 → DS-5 → DS-6 → DS-7 ✅ → **[CG-1](./CG-1-canonical-graph-runtime.md)** ✅ → **[CG-2](./CG-2-whirlpool-overlay.md)** ✅ → **[CG-3](./CG-3-normalization-pipeline.md)** ✅ → **[CG-4](./CG-4-review-promotion.md)** ✅ → **CG-5** hierarchy validation ✅ CLOSED → **[CG-6](./CG-6-production-compounding.md)** production compounding (ACTIVE)

### CG series (knowledge graph)

| Phase | Ticket | Status |
|-------|--------|--------|
| CG-5 | [5.5 Whirlpool](./CG-5.5-whirlpool-washer-compounding.md) · [5.6 Samsung](./CG-5.6-samsung-fl-cross-manufacturer.md) | **CLOSED** |
| CG-6 | [Production compounding](./CG-6-production-compounding.md) | **ACTIVE** |
| CG-7 | Diagnostic depth (repair outcomes) | Planned |

Production contract: `knowledge/normalization/calibration/knowledge_hierarchy_contract_v1.json`

## Code layout (created incrementally)

```text
frontend/components/diagnostics/session/
  types.ts                          # DS-1+
  hydrateDiagnosticSession.ts       # DS-1
  serializeDiagnosticSession.ts     # DS-1
  candidates/                       # DS-2+
    types.ts
    normalizeWizardCandidates.ts
    normalizeOEMProcedureCandidates.ts
    collectDiagnosticCandidates.ts
    filterEligibleDiagnosticCandidates.ts
    rankDiagnosticCandidates.ts
    diagnosticWeights.ts
  getNextDiagnosticActions.ts       # DS-2
  applyDecisionBranch.ts            # DS-4
  __tests__/                        # per ticket
```

## Verified pain points (audit Mar 2026)

- `serializeDiagnosticNotePayload` / `parseDiagnosticNotePayload` in `frontend/constants/diagnosticTemplates.js` **omit** `visitedStepKeys`, `currentStepKey`, `procedureRuns`, `activeProcedureId`.
- Local draft (`diagnosticDraft`) **does** persist session fields — WO note reload does not.
- Two recommendation leaders: `recommendedStepKeys` vs `recommendServiceProcedures()`.
- `decision_branch_extension.json` defines `nextTestCandidates` — **not wired** to ranking.

## Related files (do not assume — re-verify before edit)

| Concern | Path |
|---------|------|
| WO orchestration | `frontend/components/work_orders/DiagnosticResultsForm.js` |
| Note save/load | `frontend/constants/diagnosticTemplates.js` |
| Wizard ranker | `frontend/components/diagnostics/intelligence/rankNextWizardSteps.ts` |
| OEM ranker | `frontend/components/diagnostics/procedures/recommendServiceProcedures.ts` |
| OEM ↔ wizard bridge | `frontend/components/diagnostics/procedures/procedureWizardLead.ts` |
| Procedure types | `frontend/components/diagnostics/procedures/types.ts` |
| Branch extension schema | `frontend/components/diagnostics/knowledge/canonical/schemas/decision_branch_extension.json` |
| Intelligence engine | `frontend/components/diagnostics/intelligence/diagnosticIntelligenceEngine.ts` |
