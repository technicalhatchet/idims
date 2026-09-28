# CG-5.2 — Seed-ID Normalization + Compiler Loop Proof

**Status:** Shipped  
**Depends on:** CG-5.1 extraction noise filtering, CG-4 review/promotion  
**Goal:** Explicit seed componentId mapping candidates + prove full compiler loop for W8178558.

## 1. Seed component registry

`normalization/seed_component_registry.json` — **never silently rewrite procedure seeds**.

```json
{
  "heater": {
    "canonicalId": "wash_heater",
    "confidence": 0.97,
    "scope": "washer",
    "reviewLevel": "normal"
  },
  "door_switch": {
    "canonicalId": "door_lock",
    "confidence": 0.82,
    "scope": "washer",
    "reviewLevel": "careful"
  }
}
```

Candidates preserve `sourceTerm` / `seedComponentId` (e.g. `"heater"`) with `mappingType: seed_component_id` and registry-driven `reviewLevel`.

Scope gates prevent dishwasher `heater` from mapping to `wash_heater`.

## 2. Promotion equivalence

`promotion_equivalence` compares CG-2 reference overlay vs compiler-generated promotion:

| Check | Meaning |
|-------|---------|
| `canonicalAliases` | Reference OEM alias keys map to same canonical ids |
| `procedureBindings` | Same procedureId → testTargetId |
| `measurementBindings` | Same proc:knowledge → testTargetId |
| `topologyOverrides` | Hand-authored CCU/MCU overrides unchanged |

Extra generated aliases allowed; **reference key drift is a failure**.

```bash
python backend/scripts/run_promotion_equivalence.py --manual W8178558 --write-report
```

Report: `calibration/promotion_equivalence_W8178558.json`

## 3. Compiler loop (W8178558)

```bash
python backend/scripts/run_compiler_loop.py --manual W8178558
python backend/scripts/run_compiler_loop.py --manual W8178558 --run-ds7
# optional production publish:
python backend/scripts/run_compiler_loop.py --manual W8178558 --publish
```

Pipeline:

```
W8178558 → CG-3 normalize → CG-5.1 filter → CG-5.2 seed map
    → CG-4 review → approve → plan → promotion_equivalence
    → (dry-run/publish) → resolveDiagnosticGraph → DS-7 torture
```

**W8178558 result:** `promotion_equivalence.equivalent = true` — compiler promotion does not alter CG-2 reference behavior.

## Ship gate

```bash
python backend/scripts/run_golden_mapping_tests.py          # 66/66
python -m pytest backend/scripts/tests/test_seed_component_registry.py \
                 backend/scripts/tests/test_compiler_loop.py -q
python backend/scripts/run_compiler_loop.py --manual W8178558
cd frontend && npm run test:diagnostic-session
```

## CG-5 exit criterion

CG-5 is complete when one platform family (W8178558) has made the full trip with equivalence + DS-7 regression. **Achieved for alias/binding promotion layer.**

Topology overrides (CCU→MCU) remain hand-authored in CG-2 — relationship promotion is CG-6+ work.

## Next

- Run remaining washer manuals through pipeline; metrics reveal missing canonical concepts
- Expand seed registry per template (dryer `door_switch`, dishwasher `heater`)
- CG-6: relationship override candidates with mandatory human resolution
