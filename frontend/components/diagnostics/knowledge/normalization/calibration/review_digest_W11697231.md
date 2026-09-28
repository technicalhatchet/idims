# W11697231 review digest

Platform: `whirlpool_tl_dd` · Ontology: `top_load_washer`

## Your job (~15 minutes)

1. Skim the **term resolution** table below (the only real decisions).
2. Edit the term manifest if you disagree with any recommendation.
3. Run the three commands at the bottom.

## Summary

| Bucket | Count | Action |
|--------|------:|--------|
| Term resolutions (blocked/careful) | 16 | Skim table, edit manifest if needed |
| Procedure/measurement bindings | 24 | Batch-approve (mechanical) |
| Easy aliases | 2 | Auto-approve |
| Already done / inherited | 11 | None |
| **Total records** | 53 | |

## Procedure bindings (batch-approve)

- `w10864849-test-03-drive-system` -> `motor_output_test` (procedureTestBinding)
- `w10864849-test-03a-shifter` -> `motor_output_test` (procedureTestBinding)
- `w10864849-test-03b-motor` -> `motor_output_test` (procedureTestBinding)
- `w10864849-test-03b-motor` -> `motor_output_test` (measurementBinding)
- `w10864849-test-03b-motor` -> `motor_output_test` (measurementBinding)
- `w10864849-test-06-water-level` -> `drain_test` (procedureTestBinding)
- `w10864849-test-07-drain-recirc-pump` -> `drain_test` (procedureTestBinding)
- `w10864849-test-07-drain-recirc-pump` -> `drain_test` (measurementBinding)
- `w10864849-test-07-drain-recirc-pump` -> `drain_test` (measurementBinding)
- `w10864849-test-07-drain-recirc-pump` -> `drain_test` (measurementBinding)
- `w10864849-test-08-lid-lock` -> `door_lock_test` (procedureTestBinding)
- `w10864849-test-08-lid-lock` -> `door_lock_test` (measurementBinding)
- `w11697231-test-03-drive-system` -> `motor_output_test` (procedureTestBinding)
- `w11697231-test-03a-shifter` -> `motor_output_test` (procedureTestBinding)
- `w11697231-test-03a-shifter` -> `motor_output_test` (measurementBinding)
- `w11697231-test-03b-motor` -> `motor_output_test` (procedureTestBinding)
- `w11697231-test-03b-motor` -> `motor_output_test` (measurementBinding)
- `w11697231-test-03b-motor` -> `motor_output_test` (measurementBinding)
- `w11697231-test-06-water-level` -> `drain_test` (procedureTestBinding)
- `w11697231-test-07-drain-pump` -> `drain_test` (procedureTestBinding)
- `w11697231-test-07-drain-pump` -> `drain_test` (measurementBinding)
- `w11697231-test-07-drain-pump` -> `drain_test` (measurementBinding)
- `w11697231-test-08-lid-lock` -> `door_lock_test` (procedureTestBinding)
- `w11697231-test-08-lid-lock` -> `door_lock_test` (measurementBinding)

## Commands

```bash
# 1) Apply term resolutions (after optional manifest edit)
python backend/scripts/resolve_manual_terms.py --manifest frontend/components/diagnostics/knowledge/normalization/calibration/w11697231_term_resolutions.json

# 2) Batch-approve mechanical bindings
python backend/scripts/review_digest.py apply-bindings --manual W11697231

# 3) Auto-approve easy aliases
python backend/scripts/review_candidates.py auto-approve-easy --manual W11697231

# 4) Refresh digest / metrics
python backend/scripts/review_digest.py digest --manual W11697231
python backend/scripts/run_compounding_pipeline.py --manual W11697231 --skip-promotion
```
