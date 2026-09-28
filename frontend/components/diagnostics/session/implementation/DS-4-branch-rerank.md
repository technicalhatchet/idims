# DS-4 — Branch extension + replan loop

**Status:** Complete  
**PR scope:** One PR.

## Goal

When a procedure branch resolves, apply `nextTestCandidates` boosts and `deprioritize` penalties from `decision_branch_extension.json`, then re-rank — **without** hard navigation.

## Out of scope

- Updating all 526 OEM seeds (use fixture + one real seed if easy)
- Full canonical graph traversal
- New candidate types from branches (branches adjust scores, not create tests)

## Files to create / modify

| File | Purpose |
|------|---------|
| `session/applyDecisionBranch.ts` | Apply branch extension effects to session-side boost/penalty maps |
| `session/candidates/branchEffects.ts` | Read boosts/penalties during `rankDiagnosticCandidates` |
| `procedures/types.ts` | Optional extension fields on `DecisionBranch` (typed, optional) |
| `procedureRunner.ts` | On branch match, return extension payload for caller to apply |
| `DiagnosticResultsForm.js` | On procedure step result, `applyDecisionBranch` → replan |

## Session side-effects (new fields on session or payload)

```ts
session.payload.candidateBoosts?: Record<string, number>; // candidateId → amount
session.payload.candidatePenalties?: Record<string, number>;
session.payload.deprioritizedTestIds?: string[];
```

Serialize these in WO payload (DS-1 path).

## Branch extension subset (v1)

From `decision_branch_extension.json`, support only:

```json
"nextTestCandidates": [{ "testId": "...", "priorityAdjustment": 0.4 }],
"deprioritize": [{ "target": "...", "amount": 0.2 }]
```

Map `testId` to candidate `id` via alias table (initially hardcoded map in test fixture + extensible registry).

**Do NOT** implement full `evidence[]` state changes on components in this ticket.

## Flow

```text
procedure branch resolved
  → applyDecisionBranch(session, branchExtension)
  → update boost/penalty maps on session.payload
  → getNextDiagnosticActions(session)
  → UI updates suggestion
```

**Bad:** `goToStep('motor_winding')`  
**Good:** motor winding candidate score += 0.40

## Test fixture

Add `session/__tests__/fixtures/branch-motor-command-present.json` with mock branch extension.  
Optionally add extension fields to one seed branch in dev-only test procedure — **not** required for all manuals.

## Tests

| ID | Description |
|----|-------------|
| H | `motor_command_present` boost → `motor_output_test` candidate score increases |
| I | `motor_command_absent` deprioritize → motor winding rank falls, still eligible if not hard-blocked |
| — | Procedure completion triggers replan (mock handler) |

## Definition of Done

- [x] Branch effects derived from resolved branches (recomputable — no stale boost maps)
- [x] Ranker applies boosts/penalties from branch extensions
- [x] Procedure completion records `resolvedBranchEvents`; WO replans via existing memos
- [x] Tests H, I + FL won't-spin mini proof pass
- [x] No direct navigation from branch handler
- [x] `npx tsc --noEmit` passes

## Cursor stop line

Do not change confirm→repair mapping (DS-6) or measurement snapshots (DS-5) in this PR.
