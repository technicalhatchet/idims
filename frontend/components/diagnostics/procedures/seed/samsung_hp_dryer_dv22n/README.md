# Samsung DV22N heat-pump dryer (`samsung_hp_dryer_dv22n`)

**Manual:** SAMSUNG-HP-DRYER-DV22N — DV22N6850HX/A2  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_HP_DRYER_DV22N_EXTRACTION.md`

10 procedures for pilot P07 prerequisite ingestion.

```bash
python backend/scripts/generate_samsung_hp_dryer_dv22n_procedure_seeds.py
python backend/scripts/run_normalization_pipeline.py --manual SAMSUNG-HP-DRYER-DV22N
```
