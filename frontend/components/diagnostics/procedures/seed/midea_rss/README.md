# midea_rss — NS-RSS26 / NS-RTM procedure seeds

**Manual:** MIDEA-RSS-FRIDGE — Midea UR-BCD746WE-DT / Insignia NS-RSS*, NS-RTM*  
**Platform:** `midea_rss`  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md`

11 procedures + mandatory-mode bundle (§10.5).

Regenerate: `python backend/scripts/generate_midea_rss_fridge_procedure_seeds.py`

WO smoke: NS-RSS26SS + Insignia → `midea_rss`; E2 → `midearss-fz-temp-sensor`; E5 → `midearss-fz-defrost-sensor`.
