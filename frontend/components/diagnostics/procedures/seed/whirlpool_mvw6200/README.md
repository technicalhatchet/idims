# whirlpool_mvw6200 — W11416395 procedure seeds

**Manual:** Maytag 4.8 cu ft Top Load Washer (W11416395B / MVW6200)  
**Platform:** `whirlpool_mvw6200` — models `MVW62*`, `WTW62*` (PSC motor; not BPM `whirlpool_tl_dd`)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11416395
```

## Procedures (10)

| ID | OEM | Notes |
|----|-----|-------|
| w11416395-test-01-acu-power | TEST #1 | J1 line, diagnostic LED, J5 +12 VDC |
| w11416395-test-02-valves | TEST #2 | J8 valves 890–1090 Ω |
| w11416395-test-03-drive-system | TEST #3 | Component Activation pre-check |
| w11416395-test-03a-shifter | TEST #3a | Shifter J6 2–3.5 kΩ |
| w11416395-test-03b-motor | TEST #3b | PSC motor J6 5–9.5 Ω + run cap |
| w11416395-test-04-hmi | TEST #4 | UI J5 harness |
| w11416395-test-05-temp-thermistor | TEST #5 | Inlet NTC J8-8↔9 |
| w11416395-test-06-water-level | TEST #6 | Pressure hose / Sensor Feedback |
| w11416395-test-07-drain-pump | TEST #7 | J6 drain 17.8–21.8 Ω |
| w11416395-test-08-lid-lock | TEST #8 | J4 solenoid 50–160 Ω |

## Bundles (2)

- `w11416395-service-diagnostic-entry` — Key 1/2/3 diagnostic entry
- `w11416395-service-test-mode` — Key 2 + START Service Test sequence

## WO smoke

Maytag `MVW6200KW` → `whirlpool_mvw6200`; F5E3 → `w11416395-test-08-lid-lock`
