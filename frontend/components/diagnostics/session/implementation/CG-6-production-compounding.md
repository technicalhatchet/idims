# CG-6 — Production Compounding (Scale + Operationalize)

**Status:** ACTIVE — hierarchy frozen; efficiency and operations are the goal  
**Predecessor:** CG-5 CLOSED (hierarchy validated)  
**Successor (future):** CG-7 Diagnostic depth (repair outcomes)

CG-5 answered: *Can Solomon learn without corrupting itself?*  
CG-6 answers: *Can Solomon learn efficiently at scale?*  
CG-7 will answer: *Does what it learns make diagnoses better?*

## Roadmap

```text
CG-5  Knowledge hierarchy validation          CLOSED
        │
        ▼
┌───────────────────────────────┐
│ CG-6  Production compounding  │  ← ACTIVE
└───────────────────────────────┘
        │
        ├── 6.1 Freeze architecture/contracts     ← DONE (this phase)
        ├── 6.2 Build corpus metrics dashboard
        ├── 6.3 Semantic inheritance (matcher)     ← CLOSED (R1–R4 validated, R5 policy frozen)
        ├── 6.4 Canonical graph #2 — Dryer         ← CLOSED (6.4.1 Samsung curve frozen)
        ├── 6.5 Canonical graph #3 — Dishwasher    ← ACTIVE
        └── 6.6 Stress-test at corpus scale
                │
                ▼
        ┌──────────────────────┐
        │ CG-7 Diagnostic depth │
        └──────────────────────┘
                │
                ▼
        Repair outcomes → verified knowledge flywheel
```

## CG-5 questions — answered (do not re-prove)

| Question | Answer | Evidence |
|----------|--------|----------|
| Canonical transfer across manufacturers? | Yes | Samsung FL #1: 14 inherited corpus, 0 Whirlpool platform |
| Platform compounding across models? | Yes | Samsung FL #2: `inverter_board` semantic inherit; TL 14→0→0 |
| Model-specific isolation? | Yes | TL #3 HMI/Load&Go; Samsung BC2/unbalance |
| Avoid canonical pollution? | Yes | 0 new canonical across 7-manual cohort |
| Whirlpool ↔ Samsung platform isolation? | Yes | Architecture boundary tests PASS |

**Do not touch CG-5 frozen baselines or rerun hierarchy experiments.**

## 6.1 — Production contract (DONE)

Formal contract (machine-readable):

`knowledge/normalization/calibration/knowledge_hierarchy_contract_v1.json`

### Layer stack

```text
Canonical Ontology
    ↓
Manufacturer / Platform Family
    ↓
Model
    ↓
Diagnostic Session Evidence
```

### Promotion rules (permanent)

| Layer | Bar | Session may modify? |
|-------|-----|---------------------|
| **Canonical** | Cross-manufacturer **functional** evidence — not term frequency | **Never** |
| **Platform** | Manufacturer/platform evidence; inherits within family | **Never** |
| **Model** | Model-line OEM surface when platform promotion unjustified | **Never** |
| **Session** | Per-repair facts and derived intelligence | **Yes** |

**Critical invariant:** Better matching may increase automatic inheritance; it must **never lower the promotion bar**.

**23 frozen ontology candidates:** control group — unchanged until extraordinary evidence.

Calibration benchmark corpus:

`knowledge/normalization/calibration/compounding_calibration_corpus_v1.json`

## 6.2 — Corpus metrics (NEXT)

Use the **7-manual calibration corpus** — not all 67 manuals:

| Cohort | Manuals | Gate decisions (preview) |
|--------|---------|-------------------------:|
| Whirlpool FL | W8178558, W11169652 | 10, 9 |
| Whirlpool TL | W10864849, W11697231, W11416787 | 14, 0, 2 |
| Samsung FL | BB8700, WF6000R | 6, 7 |

**Primary KPI:** `newHumanDecisionCount` per manual at gate-preview.

**Secondary KPIs:**

- exact inheritance vs semantic inheritance (human burden)
- abstentions (partial semantic signal, refused auto-resolve)
- false inheritance / leakage (platform, canonical, model)
- matcher gap cases catalogued (`inverter_board` = template)

Deliverables:

- [x] `run_compounding_efficiency_report.py` — roll up frozen baselines (read-only)
- [x] `calibration/compounding_efficiency_v1.json` — authoritative efficiency artifact
- [x] Per-manual row: gate decisions, exact inherit, semantic catalog cases, leakage flags

```bash
python backend/scripts/run_compounding_efficiency_report.py --print-chart
```

## 6.3 — Semantic inheritance (matcher gap) — CLOSED

**Not** a giant AI system. Convert **human-proven** semantic relationships into deterministic reusable rules.

**Status:** Rule #1 **VALIDATED** (`compounding_semantic_inheritance_rule1_validated_v1.json`). 6.2 efficiency artifact remains frozen control.

### Guardrails (immutable)

- Semantic matching **may** improve inheritance
- Semantic matching **may NOT** promote ontology
- Semantic matching **may NOT** bypass human gates where confidence is insufficient
- Semantic matching **may NOT** cross manufacturer boundaries
- Semantic matching **may NOT** infer topology

### Rule ladder (one validated rule at a time)

| Rung | Pattern | Status |
|------|---------|--------|
| R1 | Exact functional concept + variant terminology | **VALIDATED** — `samsung-fl-inverter-board-power-voltage-codes` |
| R2 | Compound/phrase semantic equivalence | **VALIDATED** — `samsung-fl-pba-communication-control-board` |
| R3 | OEM diagnostic-title variation | **VALIDATED** — `samsung-fl-drain-leakage-drain-pump` |
| R4 | Constrained functional inference | **VALIDATED** — `samsung-fl-overflow-oc-water-level-sensor` (`semanticRiskClass: high`) |
| R5 | Deliberate abstention boundary | **FROZEN POLICY** — `semantic_inheritance_abstention_policy_v1.json` |

### Rule #1 (validated — R1)

`samsung-fl-inverter-board-power-voltage-codes` — BB8700 `9C5 → inverter_board` enables WF6000R `9C1/9C2 → inverter_board` as `inherited_platform_family`.

### Rule #2 (validated — R2)

`samsung-fl-pba-communication-control-board` — BB8700 `PBA communication (AC/AC6)` enables WF6000R `PBA communication (AC3–AC6) → control_board` as `inherited_corpus_knowledge`.

**Narrower than R1:** requires compound `PBA` + `communication` tokens; `excludeAny: [mems, motor]`. Single-token extrapolation forbidden. MEMS PBA abstains (does not absorb `mems_sensor`).

### Rule #3 (validated — R3)

`samsung-fl-drain-leakage-drain-pump` — BB8700 `Drain / leakage (LC/LC1)` enables WF6000R `Drain / leakage (LC/5C) → drain_pump` as `inherited_corpus_knowledge`.

**Harder than R2:** `leakage` is not a lexical synonym for `drain_pump` — relationship is diagnostic/functional. Requires compound `drain` + `leakage`; `excludeAny: [water, inlet, door]`. `leakage` alone, `water leakage`, `inlet leakage`, `door leakage` → abstain.

### Rule #4 (validated — R4, `semanticRiskClass: high`)

`samsung-fl-overflow-oc-water-level-sensor` — BB8700 `Overflow (OC)` enables WF6000R `Overflow (OC) → water_level_sensor` as `inherited_platform_family`.

**First functional inference rule:** `mayNotCreateConcept: true` — may only inherit established `water_level_sensor` from BB8700 prior. Requires `overflow` + `oc`; `excludeAny: [drain, inlet, basket, leakage]`. Restraint > efficiency delta.

**R4 incremental vs frozen R3 baseline:** mapping 68→67 · cohort 45→44 · +1 auto-resolve · +1 regression abstention · 0 FP.

Closed loop: human proves → freeze R3 baseline → encode high-risk rule → matcher applies → cumulative 4 fewer human decisions → 0 false positives / leakage / ontology promotion / topology inference.

### Before/after instrument

```bash
python backend/scripts/run_semantic_inheritance_benchmark.py
python -m pytest backend/scripts/tests/test_semantic_inheritance.py -q
```

Artifacts: `calibration/semantic_inheritance_benchmark_v1.json`, `calibration/compounding_semantic_inheritance_rule1_validated_v1.json`

| Metric | BEFORE 6.3 (frozen) | AFTER 6.3 (projected) |
|--------|--------------------:|----------------------:|
| Human gate decisions (cohort) | 48 | **44** |
| Semantic inherit (human burden) | 1 | 0 |
| Semantic inherit (auto-resolved) | 0 | **4** |
| Abstentions (regression scan) | 0 | **2** |
| Leakage | 0 | 0 |
| New canonical | 0 | 0 |

Regression: **4 semantic matches** across 7-manual calibration corpus (WF6000R only; no false positives). R3 baseline (68/45/3/1) frozen — R4 delta reported incrementally.

**Abstentions** = matcher recognized partial semantic evidence but deliberately refused auto-resolve (human gate). False-positive resistance matters as much as reducing the remaining 47 human decisions.

Deliverables:

- [x] `semantic_inheritance_rules_v1.json` + `normalization/semantic_inheritance.py`
- [x] Matcher integration (`canonical_matcher.build_mapping_candidates`)
- [x] Metrics recognition (`record_has_semantic_platform_inheritance`)
- [x] `run_semantic_inheritance_benchmark.py` + tests
- [x] Rule #1 validated + abstention metric
- [x] Rule #2 validated — compound PBA communication → control_board
- [x] Rule #3 validated — drain + leakage OEM title → drain_pump
- [x] Rule #4 validated — Overflow/OC functional inference → water_level_sensor (`semanticRiskClass: high`)
- [x] R5 — abstention policy frozen (`semantic_inheritance_abstention_policy_v1.json`)

**CG-6.3 is not a blocker for graph expansion.** Do not chase 67→66 semantic rules without new human-proven evidence class.

## 6.4 — Canonical graph #2: Dryer — ACTIVE

**Primary track:** build dryer ontology + run manual→overlay compounding through existing pipeline.

See: `CG-6.4-dryer-canonical-graph.md`

```text
R4 VALIDATED ✅
        │
R5 abstention policy frozen ✅
        │
        ▼
DRYER CANONICAL GRAPH          ← START HERE
        │
        ▼
DRYER MANUAL → OVERLAY COMPOUNDING (W8178559 first)
        │
        ▼
DISHWASHER CANONICAL GRAPH
        │
        ▼
PERSONAL REPAIR PILOT (washer + dryer + dishwasher)
        │
        ▼
REFRIGERATOR / RANGE / MORE
```

**Usability target:** 🟢 personal repair pilot after ~3 strong canonical families — not full appliance coverage.

**Deferred (not blocked):** LG FL washer breadth pass; TL formalization — resume when dryer graph proves cross-appliance generalization.

## 6.5 — Stress-test at corpus scale

Only after 6.2–6.4 show efficiency curves hold:

- Batch gate-preview across manifest manuals
- Leakage sweeps (architecture boundary tests per manufacturer)
- Human labor projection model

## CG-7 preview (out of scope for CG-6)

Prove diagnostic **quality**, not ingestion:

```text
TEST → RESULT → KNOWLEDGE CHANGES → CANDIDATE EFFECTS → RE-RANK → NEXT TEST
```

vs static symptom → checklist.

Measure whether canonical diagnostic graphs improve next-test decisions. Session/outcome feedback classifies **which layer** evidence justifies — never silent ontology rewrite.

## Hard rules (carry forward from CG-5)

- Gate-preview = authoritative compounding metrics
- Raw gate preview ≠ human-resolved classification (preserve both)
- `canonical.components` ≠ `overlay.add.components`
- No compiler tuning during measurement windows
- CG-5 frozen baselines immutable
- 23 ontology candidates frozen

## Related artifacts

| Artifact | Role |
|----------|------|
| `knowledge_hierarchy_contract_v1.json` | Production layer + promotion contract |
| `compounding_calibration_corpus_v1.json` | 7-manual efficiency benchmark |
| `compounding_methodology_v1.json` | Measurement discipline (gate vs post-publish) |
| `CG-5.5-whirlpool-washer-compounding.md` | Whirlpool evidence (CLOSED) |
| `CG-5.6-samsung-fl-cross-manufacturer.md` | Samsung evidence (CLOSED) |
| `semantic_inheritance_abstention_policy_v1.json` | R5 frozen abstention policy |
| `CG-6.4-dryer-canonical-graph.md` | Canonical graph #2 kickoff |
