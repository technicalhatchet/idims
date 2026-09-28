# Solomon Diagnostic Loop — v1 (implementation)

**Status:** Active implementation contract (Mar 2026)  
**Audience:** Engineers building Solomon diagnostics, OEM procedures, and WO integration  
**Not:** A replacement for OEM manuals, procedure seeds, or PHASE_6_SPEC — this ties them together.

---

## One sentence

Solomon ranks the **next safe, high-value test** from evidence — it does not follow a fixed script. OEM procedures stay **manual-faithful**; the engine **interprets** results and updates what to test next.

---

## 1. Layers (what exists today)

```
CANONICAL ONTOLOGY     knowledge/canonical/*.json
        ↓              topology, failure domains, principles (FL washer v1)
PLATFORM OVERLAY       platformRegistry + platform_overlays/
        ↓              model patterns, procedure → component/domain maps
SERVICE PROCEDURES     procedures/seed/{platformId}/ + procedureRunner
        ↓              OEM-faithful steps, branches, measurements
MEASUREMENT KNOWLEDGE  knowledge/seed/measurement-knowledge-batch*.json
        ↓              model-defined ranges, OL=critical
WIZARD + ROUTING       diagnosticTemplates, routingEngine, resolveWizardSteps
        ↓              fixed step spine, complaint-gated prerequisites
INTELLIGENCE           diagnosticIntelligenceEngine + evidence/*.json
        ↓              category/component scores, ledger, recommendedStepKeys
WO SESSION             DiagnosticResultsForm payload (fields, procedureRuns, …)
```

**Parallel tracks (intentional for now):**

| Track | Role |
|-------|------|
| Wizard | Collect observations; prerequisite locks (e.g. visual → functional → electrical) |
| Intelligence | Evidence rules → scores, ledger, next **wizard step** suggestions |
| OEM procedures | Manual tests → `diagnosticEffects` → intelligence; separate **procedure** ranking |
| Elimination | Hypothesis pairs (confirmed / suspected / eliminated) — UI banner, overlaps intelligence |

**Key files:** `DiagnosticResultsForm.js`, `diagnosticIntelligenceEngine.ts`, `recommendServiceProcedures.ts`, `procedureWizardLead.ts`, `resolveCanonicalRouting.ts`, `decision_branch_extension.json`.

---

## 2. Hard rules (enforce in code)

These override scoring heuristics.

1. **Upstream before downstream** — Do not prioritize a downstream test when a required upstream condition is unresolved (routing locks today; canonical `functionalDependencies` should feed ranking next).
2. **Do not repeat without reason** — Skip completed wizard steps and completed OEM procedures in next-test ranking unless new evidence invalidates the prior result.
3. **No single-shot condemnation** — One indirect measurement or one branch must not produce `verified_failed` or auto-repair. Procedure `confirm` → “Replace X” is OEM narrative; Solomon conclusion requires stronger evidence (see §4).
4. **Preserve raw measurements** — Store technician input (`stepInputs`, wizard fields). Snapshot `MeasurementEvaluation` when a reading is submitted (classification can be re-derived but must not replace stored raw value + context).
5. **Model ranges win** — Manufacturer/platform measurement knowledge overrides canonical defaults. Missing spec → `unknown`, not “normal.”
6. **Safety over priority** — Live-voltage and safety steps stay in procedure order; do not rank a hazardous shortcut above a safe valid alternative.
7. **Finish in-progress OEM** — Wizard navigation is blocked until the active procedure run completes or is dismissed (`oemProcedureNavGate`).

**Canonical principles** in `front_load_washer.json` (`diagnosticPrinciples`) express the same intent — wire them into the ranker as we close the loop.

---

## 3. Separation of concerns

| Layer | Responsibility | Must not |
|-------|----------------|----------|
| Canonical graph | What exists; functional relationships | Encode test order or repair decisions |
| Platform overlay | Model-specific implementation | Replace procedure content |
| Service procedure | How to perform an OEM test | Be the only source of Solomon’s final diagnosis |
| Measurement knowledge | Ranges, units, classification | Hard-code global Ω/V for all platforms |
| Decision branch | Consequences of a **result** | Assume a fixed global troubleshooting script |
| Intelligence | Support/contradiction, suggestions | Silently override technician-entered facts |
| Wizard | Capture observations | Be the only navigation path (OEM inline step is first-class) |

Procedures may include OEM “replace …” outcomes. Solomon must distinguish **manual conclusion text** from **session evidence state**.

---

## 4. Component states (target vocabulary)

Runtime today uses intelligence `unknown | confirmed | unlikely | eliminated`. Target (canonical `componentStateModel`):

| State | Meaning |
|-------|---------|
| `unknown` / `unverified` | Not tested |
| `suspected` / `supported` | Evidence leans; not proven |
| `verified_good` | Relevant function proven for this complaint path |
| `verified_failed` | Multiple independent evidence types agree on failure |
| `contradicted` | Strong opposing evidence on same target |

**Mapping today:** `eliminated` ≈ ruled out (not necessarily `verified_good`); `confirmed` ≈ fault suspected (not necessarily `verified_failed`). Tighten over time — do not rename OEM effect types in seeds; map at the intelligence layer.

**`verified_good` example:** door lock engages + feedback + cycle authorizes (door-lock OEM path).  
**`verified_failed` example:** command present + power at motor + windings out of spec — not “won’t spin” alone.

---

## 5. The loop (target behavior)

```
Symptom / chips / codes
      ↓
Activate failure domains (canonical) + evidence rules (intelligence)
      ↓
Rank next test candidates (wizard steps + OEM procedures)
      ↓
Technician performs test (wizard field or OEM procedure)
      ↓
Capture raw result + classify
      ↓
Emit evidence (ledger + optional branch extension effects)
      ↓
Update component states + deprioritize contradicted paths
      ↓
Re-rank → repeat until verified_* / repair / unresolved
```

**Today’s gap:** measurement eval snapshots (DS-5) and confirm softening (DS-6). Branch extension → re-rank loop shipped (DS-4). WO session + unified leader shipped (DS-1 / DS-3).

---

## 6. Phase 2 wiring (ordered)

Do in this order unless a WO bug forces a swap.

| # | Work item | Outcome |
|---|-----------|---------|
| 1 | **Persist session on WO** — `visitedStepKeys`, `currentStepKey`, `procedureRuns` in note save/load | Resume mid-diagnostic on phone |
| 2 | **Unified next-test ranker** — single function: wizard step candidates + OEM procedures, shared scoring inputs | One “what’s next” decision |
| 3 | **Wire `decision_branch_extension`** — read `nextTestCandidates`, `deprioritizeDomains` on branch apply | Procedure outcomes drive ranking |
| 4 | **Canonical upstream gating** — `functionalDependencies` in ranker | Contract rule #1 at runtime |
| 5 | **Snapshot evaluations** in `ProcedureRunState` | Stable audit trail if knowledge changes |
| 6 | **Graded evidence** — extend beyond confirm/eliminate/suspect (+28) using extension `evidence[]` | Support shifts without auto-condemn |
| 7 | **Soften repair prefill** — `verified_failed` gate before diagnosis prefill from procedure `confirm` | Manual text ≠ Solomon verdict |
| 8 | **Don’t repeat completed OEM** — deprioritize or exclude completed procedure IDs in ranker | Contract rule #2 for procedures |

Schema reference: `schemas/decision_branch_extension.json` (documented, not yet wired to `procedureRunner`).

---

## 7. What we are not doing (v1)

- Replacing 526 OEM seeds with abstract cross-platform test IDs
- Full probabilistic inference / ML scoring
- Re-enabling `reorderWizardStepsForIntelligence` for navigation until back-stack + hidden-step issues are fixed
- Event-sourced evidence graph (ledger re-eval is enough for now)
- Canonical ontologies for every appliance before FL washer loop is closed on WO

---

## 8. Related docs

| Doc | Purpose |
|-----|---------|
| `README.md` (this folder) | Canonical ontology conventions |
| **`../../session/implementation/README.md`** | **Bounded implementation tickets DS-1 … DS-7** |
| `PHASE_6_SPEC.md` | Intelligence engine behavior (as shipped) |
| `pattern-catalog/PROCEDURE_ONBOARDING.md` | Manual ingestion pipeline |
| `.cursor/rules/oem-procedure-layer-integration.mdc` | WO OEM panel + wizard lead |
| `schemas/decision_branch_extension.json` | Branch → evidence + next-test extension |

---

## 9. Review checklist (PRs touching diagnostics)

- [ ] Does this change assume a fixed test order when ranking should be evidence-driven?
- [ ] Are raw technician values preserved?
- [ ] Does a single measurement or branch auto-condemn a component for repair?
- [ ] Are upstream prerequisites respected?
- [ ] Do procedure effects flow into intelligence without bypassing the ledger?
- [ ] If adding OEM content, is manual fidelity preserved (separate from Solomon conclusion)?
