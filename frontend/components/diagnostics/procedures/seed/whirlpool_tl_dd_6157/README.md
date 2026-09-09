# whirlpool_tl_dd_6157 — W11455152 procedure seeds

**Manual:** Whirlpool 5.3 cu ft Top Load Washer (W11455152A / WTW6157)  
**Platform:** `whirlpool_tl_dd_6157` — models `MVW61*`, `WTW61*` (PSC motor; not BPM `whirlpool_tl_dd_5100`)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11455152_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11455152
```

## Procedures (9)

| ID | OEM | Notes |
|----|-----|-------|
| w11455152-test-01-acu-power | TEST #1 | J1 line, diagnostic LED, J5 +12 VDC |
| w11455152-test-02-valves | TEST #2 | J8 valves 890–1090 Ω |
| w11455152-test-03-drive-system | TEST #3 | Component Activation pre-check |
| w11455152-test-03a-shifter | TEST #3a | Shifter J6 2–3.5 kΩ |
| w11455152-test-03b-motor | TEST #3b | PSC motor J6 5–9.5 Ω + run cap |
| w11455152-test-04-hmi | TEST #4 | UI Test (Key 1) / J5 harness |
| w11455152-test-05-water-level | TEST #5 | Pressure hose / Sensor Feedback |
| w11455152-test-06-drain-pump | TEST #6 | J6 drain 17.8–21.8 Ω |
| w11455152-test-07-lid-lock | TEST #7 | J4 solenoid 50–160 Ω |

## Bundles (2)

- `w11455152-service-diagnostic-entry` — Key 1/2/3 diagnostic entry
- `w11455152-automatic-test-mode` — Key 2 + START Automatic Test sequence

## WO smoke

Whirlpool `WTW6157PW` → `whirlpool_tl_dd_6157`; F5E3 → `w11455152-test-07-lid-lock`
