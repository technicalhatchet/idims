# CG-5.3 — Corpus Expansion & Ontology Gap Analysis

**Status:** Shipped  
**Depends on:** CG-5.2 compiler loop  
**Goal:** Exercise the machine at scale — learn what the ontology is missing, without autonomous ontology mutation.

## Pipeline

```
washer corpus (15 manuals today; 67 total when expanded)
    ↓
CG-3 normalize → CG-5.1 filter → CG-5.2 seed map
    ↓
CG-4 review packages
    ↓
CORPUS GAP ANALYSIS
    ↓
classify findings → approve stable candidates → promote by family batch
    ↓
promotion equivalence → resolve graph → DS-7 regression
```

## Hard rule

**Never add a canonical concept because the matcher hit one unknown term.**

Evidence chain required for ontology expansion:

```
unknown term → semantic normalization → appears across manuals
    → same functional role → same diagnostic dependencies → canonical candidate
```

## Gap classification

| Finding | Action |
|---------|--------|
| Same concept, different OEM terminology | Canonical alias |
| Same functional concept across manufacturers | Canonical ontology candidate |
| Manufacturer/platform-specific architecture | Overlay |
| Ambiguous / contradictory | Human review |

Thresholds (configurable in `gap_analyzer.py`):
- Ontology candidate: ≥3 manuals, ≥2 manufacturers, functional signature present
- Alias opportunity: ≥2 manuals, same canonical id, different source terms

## Commands

```bash
# Full washer corpus run + gap report
python backend/scripts/run_corpus_gap_analysis.py --template washer --normalize --materialize --version v1

# Entire manifest (all appliance types)
python backend/scripts/run_corpus_gap_analysis.py --all --normalize --materialize --version v1

# Re-analyze existing candidates only
python backend/scripts/run_corpus_gap_analysis.py --template washer --version v1
```

Outputs:
- `calibration/canonical_gap_report_v1_washer.json`
- `calibration/canonical_gap_report_v1_washer.txt`

## Promotion batch order

1. Whirlpool FL (`W8178558`, `W11169652`, …)
2. Samsung FL (`SAMSUNG-FL-*`)
3. Samsung TL (`SAMSUNG-TL-*`)

Each batch gate:

```
normalize → review → promotion_equivalence → publish → resolve graph → DS-7
```

Use `run_compiler_loop.py` per manual / family after gap-informed approval.

## Ship gate

```bash
python -m pytest backend/scripts/tests/test_corpus_gap_analyzer.py -q
python backend/scripts/run_corpus_gap_analysis.py --template washer --version v1
```

## CG-5 milestone

After CG-5.3, Solomon can demonstrate:

> Take an arbitrary service manual → structured knowledge → canonical mapping → uncertainty/conflicts → human approval → OEM overlay → resolved graph → safe diagnostic behavior.

Proven for W8178558 (CG-5.2). CG-5.3 scales evidence collection across the washer corpus to guide ontology vs overlay decisions.
