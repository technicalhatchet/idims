# CG-5.4 — Washer Alias Consolidation + Whirlpool Batch Promotion

**Status:** Complete — baseline frozen in CG-5.5  
**Depends on:** CG-5.3 gap analysis  
**Goal:** Consolidate 12 cross-manual alias families, promote Whirlpool FL with equivalence gates, measure human decision compounding.

## 1. Alias family approval

Preserves **each OEM term individually** — CCU, Central Control Unit, and Machine Control remain distinct `oemTermAliases` keys mapping to `control_board`.

```bash
python backend/scripts/approve_alias_families.py list
python backend/scripts/approve_alias_families.py show control_board
python backend/scripts/approve_alias_families.py approve-all
```

Only `easy` + `normal` approval levels auto-approved via alias-family (careful/blocked excluded).

## 2. Human decision metrics

```bash
python backend/scripts/human_decision_metrics.py --template washer --version v1
```

Tracks per manual:
- Review records by approval level (easy / normal / careful / blocked)
- Auto vs human approvals
- Manual resolutions required (blocked)

**Compounding hypothesis:** later Whirlpool manuals should show lower `humanDecisionCount` after W8178558 establishes shared aliases.

Output: `calibration/human_decision_metrics_v1_washer.json`

## 3. Whirlpool FL batch promotion

```bash
# W8178558 only (CG-2 reference, dry-run)
python backend/scripts/run_washer_batch_promotion.py --batch whirlpool_fl --manual W8178558

# Publish + DS-7
python backend/scripts/run_washer_batch_promotion.py --batch whirlpool_fl --manual W8178558 --publish --run-ds7
```

Gate per manual:
```
gaps → review → approve → promotion_equivalence → publish → resolve graph → DS-7
```

`W11169652` requires `MANUAL_TO_OVERLAY` + platform family scaffold before publish (next Whirlpool FL step).

## 4. Samsung FL stress test (after Whirlpool)

```bash
python backend/scripts/run_washer_batch_promotion.py --batch samsung_fl --manual SAMSUNG-FL-BB8700-WASHER
```

Tests whether canonical abstraction is functional across manufacturers — not Whirlpool-shaped.

## Hard rules (carry forward)

- Do **not** promote cross-appliance ontology candidates from CG-5.3 `--all` report
- Alias families only for CG-5.4 washer consolidation
- Every publish requires `promotion_equivalence.equivalent = true`

## Results (Sep 2026)

### Alias consolidation
- **12 families** approved via `approve-all` → **123** easy/normal candidates
- **Careful/blocked** left for human review (e.g. `TEST #1: Main Control (ACU)` compound terms)
- Each OEM term preserved individually in overlay `oemTermAliases`

### W8178558 baseline (compounding reference)
| Metric | Count |
|--------|------:|
| Review records | 41 |
| Easy / Normal / Careful / Blocked | 14 / 10 / 7 / 10 |
| Approved (incl. alias-family) | 31 |
| Manual resolutions remaining | 10 |
| Human decisions | 0 (all auto/alias-family) |

### W8178558 publish
- `promo-W8178558-20260913045809` — **published**
- `promotion_equivalence.equivalent = true` (CG-2 reference preserved)
- `cg2-whirlpool-overlay.test.ts` — **pass**
- 16 new OEM term aliases added to overlay (CCU/MCU/PR6 etc. skipped as already present)

### W11169652 scaffold (compounding test)
- `MANUAL_TO_OVERLAY` → `whirlpool_fl_dd_direct_drive` platform family
- Minimum scaffold: direct-drive topology, establishedFactSources, empty bindings (promotion fills)
- **No approve-all** — alias-family corpus flows through automatically

| Metric | W8178558 | W11169652 | Delta |
|--------|---------:|----------:|------:|
| reviewRecords | 41 | 49 | +8 |
| approved | 31 | 12 | — |
| humanDecisionCount | 10 | 9 | -1 |
| **newHumanDecisionCount** | 10 | **9** | -1 |
| inheritedResolvedAutomatically | 20 | **40** | +20 |
| manualResolutionsRequired | 10 | 9 | -1 |

- `promotion_equivalence.equivalent = true` (dry-run, aliases only — procedure bindings still candidate)
- Gap analysis unchanged: **12** alias families, **0** ontology candidates
- Pipeline: `python backend/scripts/run_compounding_pipeline.py --manual W11169652`

### W11169652 publish (complete)

**Term resolution** (`w11169652_term_resolutions.json`):
- 10 `existing_canonical_concept` (OEM TEST title → established canonical id)
- 2 `existing_platform_concept` (drum light → supply; drain/recirc TEST → drain_pump)
- 0 new ontology candidates

**Post-publish gates:** equivalence PASS · canonical validation PASS · CG-2 + canonical-graph DS-7 PASS

**Permanent baseline:** `calibration/compounding_baseline_v1_whirlpool_fl.json`

| | W8178558 | W11169652 |
|--|--------:|----------:|
| newHumanDecisionCount | 10 | 9 |
| inheritedResolvedAutomatically | 20 | 40 |
| manualResolutionsRequired | 10 | 9 |
| newHumanDecisionRate | 24.4% | 18.4% |
| inheritedResolutionRate | 66.7% | 81.6% |
| equivalence | PASS | PASS |

Gap analysis post-publish: **12** alias families · **0** ontology candidates (unchanged).

## Ship gate

```bash
python backend/scripts/approve_alias_families.py approve-all
python backend/scripts/run_washer_batch_promotion.py --manual W8178558 --publish --run-ds7
python backend/scripts/human_decision_metrics.py --template washer --version v1
python backend/scripts/run_golden_mapping_tests.py
npx tsx components/diagnostics/session/__tests__/scenarios/cg2-whirlpool-overlay.test.ts
```
