# Whirlpool CCU dryer (`whirlpool_ccu_dryer`) procedure seeds

**Manual:** Service data sheet W10680150 — `whirlpool-electric-gas-dryers.pdf`  
**Extraction:** [`DRYER_SERVICE_MANUAL_EXTRACTION.md`](../../knowledge/pattern-catalog/DRYER_SERVICE_MANUAL_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)  
**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual W10680150`

## Scope

Whirlpool/Maytag **CCU-era** dryers (WED/WGD/MED/MGD). **Not** Duet Sport 83/85 — those use `whirlpool_duet_sport_dryer`.

Dual-element electric heat ≤50 Ω (not Duet Sport 7–12 Ω single element). F3Ex/F4Ex error stack.

## TEST coverage (13 procedures)

| ID | OEM |
|----|-----|
| `w10680150-ccu-power` | TEST #1 |
| `w10680150-supply-connections` | TEST #2 |
| `w10680150-motor-circuit` | TEST #3 |
| `w10680150-heater-electric` | TEST #4 (electric) |
| `w10680150-heater-gas` | TEST #4 (gas orchestration) |
| `w10680150-thermistors` | TEST #4a |
| `w10680150-thermal-fuse` | TEST #4b |
| `w10680150-thermal-cutoff` | TEST #4c |
| `w10680150-gas-valve` | TEST #4d |
| `w10680150-moisture-sensor` | TEST #5 |
| `w10680150-dryness-adjust` | TEST #5a |
| `w10680150-button-indicator` | TEST #6 |
| `w10680150-door-switch` | TEST #7 |

Deferred: TEST #8 drum light, TEST #9 myst/steam valve.

Bundle: `w10680150-diagnostic-entry` (3-button × 3 sequence, LCD Diagnostics Home).
