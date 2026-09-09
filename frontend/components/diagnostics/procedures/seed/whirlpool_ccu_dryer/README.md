# Whirlpool CCU/ACU dryer (`whirlpool_ccu_dryer`) procedure seeds

**Manuals:**
- W10680150 — `whirlpool-electric-gas-dryers.pdf` — [DRYER_SERVICE_MANUAL_EXTRACTION.md](../../knowledge/pattern-catalog/DRYER_SERVICE_MANUAL_EXTRACTION.md)
- W10881701 — `servicemanual-w10881701-l-91 wed9500.pdf` — [WHIRLPOOL_W10881701_DRYER_EXTRACTION.md](../../knowledge/pattern-catalog/WHIRLPOOL_W10881701_DRYER_EXTRACTION.md)

**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)

**Pipelines:**
```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10680150
python backend/scripts/run_procedure_manual_pipeline.py --manual W10881701
```

## Scope

Whirlpool/Maytag **CCU/ACU-era** dryers (WED/WGD/MED/MGD, including **WED95*/MED95*** steam). **Not** Duet Sport 83/85 — those use `whirlpool_duet_sport_dryer`. **Not** WED51* top-load — `whirlpool_acu_tl_dryer`.

Dual-element electric heat ≤50 Ω. Connector naming: W10680150 uses P*; W10881701 service manual uses J* (same functions).

## TEST coverage

| Manual | Procedures | Bundles |
|--------|------------|---------|
| W10680150 | 13 (`w10680150-*`) TEST #1–#7 | `w10680150-diagnostic-entry` |
| W10881701 | 16 (`w10881701-*`) TEST #1–#10 | `w10881701-diagnostic-entry`, `w10881701-service-test-mode` |

W10881701-only: drum LED (#8), water/steam valve (#9), UI service LEDs (#10).
