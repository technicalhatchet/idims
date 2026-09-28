# CG-3 — Manual Normalization Pipeline

Transforms existing procedure seeds and manual metadata into **reviewable candidates** for the canonical/overlay architecture.

**This folder never mutates production canonical graphs or approved overlays.**

## Pipeline

```
procedureManualManifest.json + procedure seeds
        ↓
normalize_procedures
        ↓
OEM terminology extraction + canonical matching
        ↓
overlay candidate generation
        ↓
conflict detection (cross-manual)
        ↓
candidates/{manualId}/*.json   (status: candidate)
        ↓
validate_normalization_candidates.py
        ↓
human approval  →  manufacturer_overlays/ (future publish step)
```

## Output layout

| File | Purpose |
|------|---------|
| `candidates/{manualId}/normalized_procedures.json` | Uniform procedure structure |
| `candidates/{manualId}/canonical_mapping_candidates.json` | OEM term → canonical id |
| `candidates/{manualId}/overlay_candidates.json` | procedureTestBinding, measurementBinding, etc. |
| `candidates/{manualId}/conflicts.json` | `CONFLICT_REQUIRES_REVIEW` — never auto-resolved |
| `candidates/{manualId}/pipeline_manifest.json` | Run metadata + counts |

## Run

```bash
# Single manual (smoke)
python backend/scripts/run_normalization_pipeline.py --manual W8178558

# All registered manuals
python backend/scripts/run_normalization_pipeline.py --all

# Validate candidates (ship gate with CG-3 work)
python backend/scripts/validate_normalization_candidates.py
python backend/scripts/validate_normalization_candidates.py --manual W8178558
```

## Candidate status workflow (CG-4)

```
candidate → needs_review → approved → promoted
                ↓
             rejected

approved ≠ published
published = explicit `promote_overlay.py`
```

See `session/implementation/CG-4-review-promotion.md` for review CLI.

## Provenance

Every candidate includes a `provenance` chain:

`candidate → manualId → procedureId / page → source file`

## CG-5.1 — Extraction noise filtering

Procedural/structural tokens are classified and filtered **before** canonical matching. See `session/implementation/CG-5.1-extraction-noise-filter.md`.

## CG-5.3 — Corpus gap analysis

Identify ontology vs overlay gaps from the washer corpus — **no autonomous ontology mutation**.

```bash
python backend/scripts/run_corpus_gap_analysis.py --template washer --normalize --materialize --version v1
```

See `session/implementation/CG-5.3-corpus-gap-analysis.md`.

## CG-5 — Corpus calibration (measurement + tuning)

**Not mass promotion.** Establish baselines, tune matcher, re-measure, promote one family at a time.

```bash
# Golden regression (required before matcher changes ship)
python backend/scripts/run_golden_mapping_tests.py

# Versioned corpus baseline
python backend/scripts/run_calibration_baseline.py --version v1 --normalize --materialize

# Compare after matcher tune
python backend/scripts/run_calibration_baseline.py --version v2 --template washer --normalize --compare v1
```

Artifacts: `calibration/normalization_metrics_v1.json`, `calibration/golden_mapping_set.json`

See `session/implementation/CG-5-corpus-calibration.md`.

## Out of scope (CG-3)

- Autonomous ontology creation
- Automatic conflict resolution
- Automatic production overlay publish
- LLM diagnosis generation
- Replacing PDF extraction (`extract_pdf.py`)

See `session/implementation/CG-3-normalization-pipeline.md`.
