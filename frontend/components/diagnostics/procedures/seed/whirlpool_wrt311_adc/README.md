# whirlpool_wrt311_adc — W10674984 procedure seeds

**Manual:** Whirlpool WRT311 ADC 2000 Wiring Sheet (W10674984 Rev A)  
**Platform:** `whirlpool_wrt311_adc` — WRT311* only  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WRT311FDZT00_W10674984_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10674984
```

## Procedures (5)

| ID | Source | Tags |
|----|--------|------|
| w10674984-defrost-heater | Component 30–42 Ω | RD, DF |
| w10674984-defrost-bimetal | Bi-metal 58°F | DF |
| w10674984-adc-heater-voltage | P2–P6 live | ADCTEST, RD |
| w10674984-adc-cooling-voltage | P6–P4 live | not_cooling |
| w10674984-ptc-start | PTC cold ohms | PTCOPEN, OL |

## Bundles (1)

- `w10674984-adc-defrost-test-entry` — thermostat sequence → ADC defrost test mode

## WO smoke

Whirlpool `WRT311FDZT00` → `whirlpool_wrt311_adc`; frost → `w10674984-defrost-heater`.
