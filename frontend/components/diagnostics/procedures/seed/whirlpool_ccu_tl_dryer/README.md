# Whirlpool/Maytag CCU top-load dryer (`whirlpool_ccu_tl_dryer`)

**Manual:** W10410465A — `WPL Top load Dryer Service Manual.pdf`  
**Extraction:** `knowledge/pattern-catalog/WHIRLPOOL_W10410465_TL_CCU_DRYER_EXTRACTION.md`

## Platform routing

| templateId | Model patterns (examples) |
|------------|---------------------------|
| `electric_dryer` | WED6600*, WED7500*, WED8000*, WED8500AW |
| `gas_dryer` | WGD6600*, WGD7500*, WGD8000*, WGD8500AW |

CCU LCD console top-load family — same P* pinouts as W10680150 FL CCU tech sheet, distinct from `whirlpool_acu_tl_dryer` (W11416805).

## Procedures (15)

| ID | OEM TEST |
|----|----------|
| `w10410465-ccu-power` | #1 |
| `w10410465-supply-connections` | #2 |
| `w10410465-motor-circuit` | #3 |
| `w10410465-heater-electric` | #4 (electric) |
| `w10410465-heater-gas` | #4 (gas) |
| `w10410465-thermistors` | #4a |
| `w10410465-thermal-fuse` | #4b |
| `w10410465-thermal-cutoff` | #4c |
| `w10410465-gas-valve` | #4d (gas) |
| `w10410465-moisture-sensor` | #5 |
| `w10410465-dryness-adjust` | #5a |
| `w10410465-button-indicator` | #6 |
| `w10410465-door-switch` | #7 |
| `w10410465-drum-light` | #8 |
| `w10410465-myst-valve` | #9 |

**Bundle:** `w10410465-diagnostic-entry` (3-button × 3 service diagnostics entry)

## Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10410465
python backend/scripts/crop_w10410465_procedure_figures.py
```

**Smoke:** WED7500AW + Whirlpool → `whirlpool_ccu_tl_dryer`
