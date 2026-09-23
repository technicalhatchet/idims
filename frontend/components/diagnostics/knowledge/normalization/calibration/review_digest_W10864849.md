# W10864849 review digest

Platform: `whirlpool_tl_dd` · Ontology: `top_load_washer`

## Your job (~15 minutes)

1. Skim the **term resolution** table below (the only real decisions).
2. Edit the term manifest if you disagree with any recommendation.
3. Run the three commands at the bottom.

## Summary

| Bucket | Count | Action |
|--------|------:|--------|
| Term resolutions (blocked/careful) | 0 | Skim table, edit manifest if needed |
| Procedure/measurement bindings | 0 | Batch-approve (mechanical) |
| Easy aliases | 0 | Auto-approve |
| Already done / inherited | 53 | None |
| **Total records** | 53 | |

## Term resolutions

Manifest: `C:\Users\chee3\IdeaProjects\idims\frontend\components\diagnostics\knowledge\normalization\calibration\w10864849_term_resolutions.json`

| OEM term | Recommend | Classification | Rationale |
|----------|-----------|----------------|-----------|

## Commands

```bash
# 1) Apply term resolutions (after optional manifest edit)
python backend/scripts/resolve_manual_terms.py --manifest frontend/components/diagnostics/knowledge/normalization/calibration/w10864849_term_resolutions.json

# 2) Batch-approve mechanical bindings
python backend/scripts/review_digest.py apply-bindings --manual W10864849

# 3) Auto-approve easy aliases
python backend/scripts/review_candidates.py auto-approve-easy --manual W10864849

# 4) Refresh digest / metrics
python backend/scripts/review_digest.py digest --manual W10864849
python backend/scripts/run_compounding_pipeline.py --manual W10864849 --skip-promotion
```
