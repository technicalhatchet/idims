# CG-5 — Corpus Normalization Calibration

**Status:** In progress (CG-5.1 extraction noise filtering shipped)  
**Depends on:** CG-3 (normalization), CG-4 (review + promotion)  
**Goal:** Measurement-and-tuning phase — **not** mass promotion.

## Principle

```
70 manuals → CG-3 normalize → CG-4 review packages → METRICS
    → matcher tuning → re-normalize → metrics again → promote stable families
```

**Precision over recall.** Fewer blocked terms is not success if questionable mappings increased.

## Deliverables

| Item | Path |
|------|------|
| Compound term parser | `backend/scripts/normalization/compound_term_parser.py` |
| Canonical ontology alias merge | `canonical_matcher.load_full_registry()` |
| Versioned baseline metrics | `normalization/calibration/normalization_metrics_v1.json` |
| Golden mapping set (60 cases) | `normalization/calibration/golden_mapping_set.json` |
| Baseline CLI | `backend/scripts/run_calibration_baseline.py` |
| Golden regression CLI | `backend/scripts/run_golden_mapping_tests.py` |

## Compound OEM phrases

Multi-token terms that fail direct alias lookup enter compound parsing:

```
OEM phrase → tokenization → functional noun extraction → suffix phrase variants
    → COMPOUND_TERM_CANDIDATE (careful review)
```

Example: `Detergent Dispenser Motor` → matched suffix `dispenser motor` → proposed `dosing_pump` at ≤0.88 confidence.

**Does not auto-publish.** Compound proposals require human approval (approval level: `careful`).

## Baseline metrics captured

- candidates/manual, by type, confidence distribution
- approval-level distribution (easy / normal / careful / blocked)
- unresolved terms (top 30)
- global conflict counts by type
- duplicate candidate groups
- procedure/measurement binding confidence averages
- overlay coverage: `promotion_ready` vs `already_published`
- quality indicators: blocked rate, unresolved rate, conflict rate, compound share

## Commands

```bash
# Golden regression (ship gate for matcher changes)
python backend/scripts/run_golden_mapping_tests.py

# Full corpus baseline (v1)
python backend/scripts/run_calibration_baseline.py --version v1 --normalize --materialize

# Washer-only baseline + compare after matcher tune
python backend/scripts/run_calibration_baseline.py --version v2 --template washer --normalize --compare v1

# Pytest
python -m pytest backend/scripts/tests/test_normalization_calibration.py -q
```

## Tuning loop

1. Establish baseline (`normalization_metrics_v1.json`)
2. Attack blocked/unresolved buckets (compound nouns, ontology aliases, title-token filters)
3. Run golden set — must stay at 100% pass
4. Re-normalize + write v2 baseline + compare deltas
5. Promote **one platform family at a time** (Whirlpool FL → resolve graph → DS-7 regression)

## Exit criteria

CG-5 complete when demonstrated end-to-end:

```
Corpus → Normalize → Review → Tune → Re-normalize → Approve → Promote
    → Resolved graph → Diagnostic regression suite
```

With:
- No production canonical mutation from normalization
- Complete provenance
- Deterministic promotion (CG-4)
- Golden set + DS-7 regression protection

## Out of scope (CG-5)

- Review UI
- Mass approve/promote across corpus
- Remaining 18 appliance canonical graphs (after washer corpus proves pipeline)

## Architecture preserved

```
Service manuals = source code
Canonical ontology = type system
Manufacturer overlays = compiled artifacts
Diagnostic graph = runtime representation
Diagnostic evidence = runtime state
```
