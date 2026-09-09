# midea_rss — Midea/Insignia refrigerator procedure seeds

**Platform:** `midea_rss` · template `refrigerator` · models `NS-RSS*`, `NS-RTM*`

## MIDEA-RSS-FRIDGE (NS-RSS26 SxS)

11 procedures + mandatory-mode bundle (§10.5). VFD + ice maker codes RSS-only.

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual MIDEA-RSS-FRIDGE
```

## INSIGNIA-RTM18-FRIDGE (NS-RTM18 top-freezer)

5 reused E-code procedures (E1/E2/E5/E6/E7) + test-mode bundle (§9.7). No ice maker or VFD.

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual INSIGNIA-RTM18-FRIDGE
```

**WO smoke:** NS-RTM18SS2 + Insignia → `midea_rss`; E5 → `midearss-fz-defrost-sensor`.

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/INSIGNIA_RTM18SS2_REFRIGERATOR_EXTRACTION.md`
