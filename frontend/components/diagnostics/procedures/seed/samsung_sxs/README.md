# Samsung SxS refrigerator (`samsung_sxs`)

**Manuals:**
- `SAMSUNG-RF260B-FRIDGE` — RF260B*/RF261B* (CN30/CN76 pinouts)
- `SAMSUNG-RS28-SXS` — RS28A500*/RS23A500* (CN20/CN40/CN90 pinouts)
- `SAMSUNG-RS22T-SXS` — RS22T*/RS27T*/RS28T5B*/RS5300* (reuses `samsungrs28-*` seeds)

**Extraction:**
- `knowledge/pattern-catalog/SAMSUNG_RF260B_FRIDGE_EXTRACTION.md`
- `knowledge/pattern-catalog/SAMSUNG_RS28_FRIDGE_EXTRACTION.md`
- `knowledge/pattern-catalog/SAMSUNG_RS22T_SXS_EXTRACTION.md`

RF260B: 16 procedures + 2 bundles. RS28/RS22T: 17 procedures + 3 bundles (shared).

Regenerate RF260B: `python backend/scripts/generate_samsung_rf260b_fridge_procedure_seeds.py`  
Regenerate RS28: `python backend/scripts/generate_samsung_rs28_fridge_procedure_seeds.py`
