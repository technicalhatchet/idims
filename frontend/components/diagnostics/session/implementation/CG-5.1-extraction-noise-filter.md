# CG-5.1 — Extraction Noise Filtering

**Status:** Shipped  
**Depends on:** CG-5 calibration infrastructure  
**Goal:** Filter procedural/structural extraction debris **before** canonical matching — without teaching the ontology to ignore noise.

## Principle

```
raw extracted token
        ↓
token classification
        ├── canonical candidate
        ├── OEM alias
        ├── procedural noise      → filtered (not matched)
        ├── structural noise      → filtered (not matched)
        └── unresolved            → blocked with reason
```

**Filter noise before matching; don't add noise terms to the ontology.**

## Examples

| Raw extraction | After preprocess | Outcome |
|----------------|------------------|---------|
| `TEST #5 — Door Lock` | `Door Lock` | `door_lock` alias candidate |
| `§5-4: Detergent Dispenser Motor` | full phrase | `COMPOUND_TERM_CANDIDATE` → `dosing_pump` |
| `§5-4 MOTOR TEST` | `MOTOR` | `AMBIGUOUS_COMPONENT` (blocked) |
| `TEST` (bare) | — | `PROCEDURAL_NOISE` (filtered, no candidate) |
| `C2` | — | `STRUCTURAL_TOKEN` (filtered) |

## Blocked reason taxonomy

| Reason | Meaning |
|--------|---------|
| `PROCEDURAL_NOISE` | TEST, Check, Ohms, Manual, etc. |
| `STRUCTURAL_TOKEN` | Pin designators (C2, J14), bare section markers |
| `CROSS_APPLIANCE_TERM` | Seed componentId from another appliance template |
| `UNRESOLVED_COMPONENT` | Genuine unknown — needs ontology or alias |
| `AMBIGUOUS_COMPONENT` | Single-token ambiguity (Motor, Valve, Pump) |
| `CONFLICT` | Attached global/per-manual conflict |
| `INVALID_EXTRACTION` | Empty / malformed |

Filtered noise is tracked in `pipeline_manifest.extractionFilters` (not promoted to review).

## Modules

| File | Role |
|------|------|
| `term_preprocessor.py` | Strip prefixes/suffixes, classify noise |
| `extraction_filter.py` | Per-manual filter stats |
| `canonical_matcher.py` | Title-level extraction (no naive title tokenization) |

## v1 → v2 baseline (67 manuals)

| Metric | v1 (CG-5) | v2 (CG-5.1) | Δ |
|--------|----------:|------------:|--:|
| Total candidates | 3,121 | 2,253 | **−868** |
| Blocked rate | 76.2% | 66.6% | **−9.6 pts** |
| Extraction filtered | — | 505 | (358 procedural + 147 structural) |
| Golden set | 60/60 | **64/64** | +4 title-strip cases |

Remaining blocked is now diagnosable:

```
1,500 blocked candidates
  160 AMBIGUOUS_COMPONENT
   94 UNRESOLVED_COMPONENT
    1 CROSS_APPLIANCE_TERM
  505 pre-match filtered (not in candidate pool)
```

Top remaining unresolved: `heater`, `supply`, `igniter` (seed componentIds) — CG-5.2 target.

## Ship gate

```bash
python backend/scripts/run_golden_mapping_tests.py    # 64/64
python -m pytest backend/scripts/tests/test_normalization_preprocessor.py -q
python backend/scripts/run_calibration_baseline.py --version v2 --compare v1
```

## Next (CG-5.2)

- Seed `componentId` → canonical mapping for common cross-manual ids (`heater`, `door_switch`)
- Title functional-phrase extraction for TL washer procedures (`Drive System`, `Lid Lock`)
- First platform family end-to-end: approve → promote → resolve graph → DS-7
