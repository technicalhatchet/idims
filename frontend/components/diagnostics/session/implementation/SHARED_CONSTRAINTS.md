# Shared constraints — all DS tickets

## Do NOT

- Delete `rankNextWizardSteps()` or `recommendServiceProcedures()`.
- Replace or rename 526 OEM procedure seeds.
- Enable `reorderWizardStepsForIntelligence()` for live wizard navigation (breaks back-stack / hidden steps).
- Build a second independent hypothesis engine.
- Replace the intelligence ledger with a new scoring system.
- Rewrite `procedureRunner.ts`.
- Make the canonical graph own manufacturer-specific procedure content.
- Collapse hydrate, rank, intelligence, and UI into one mega-function.
- Implement full 10-state component model, Bayesian inference, or event-sourced evidence in any DS ticket unless explicitly listed in that ticket.

## DO

- Treat `DiagnosticSession` as an **aggregation contract** over existing payload + derived evals.
- Wrap existing rankers via **normalizers**; preserve behavioral parity until tests prove improvement.
- Persist **facts** (fields, navigation, procedure runs, timeline); **derive** intelligence/elimination on hydrate unless a ticket explicitly caches them.
- Use `unknown` when data is missing — never infer `good`.
- Debounce re-rank on field changes (300–500ms); immediate re-rank on step complete, procedure complete, branch resolve.
- Keep wizard spine **guided/linear**; unified ranker **recommends**, navigation presentation stays incremental.

## Session field persistence rule

| Persist on WO save | Derive on hydrate (do not invent) |
|--------------------|-----------------------------------|
| `visitedStepKeys`, `currentStepKey` | `components[]`, `hypotheses[]` from intelligence |
| `procedureRuns`, `activeProcedureId` | `elimination` eval |
| `fields`, `timeline`, `evidenceSnapshot` | Full intelligence result |
| OEM flags: `skippedOemWizardStep`, `oemRepairDecisionPending`, etc. | `availableTestIds` (until catalog wired) |

## Architectural invariant

```text
Canonical graph     = what exists and how it relates
OEM procedure       = how the manufacturer says to test it
Measurement knowledge = what values mean
DiagnosticSession   = everything known in THIS diagnostic (facts + derived views)
Evidence/intelligence = what observations imply
NextTestCandidate   = what Solomon could do next
Unified ranker      = what is most useful NOW
UI                  = how that is presented
```

## Regression bar

After every ticket:

- `cd frontend && npx tsc --noEmit`
- New ticket tests pass
- Existing wizard linear Next/Previous unchanged unless ticket says otherwise
- OEM procedure runner still executes seeds unchanged
