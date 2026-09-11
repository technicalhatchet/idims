# whirlpool_tl_dd_5100 — W11416787 procedure seeds

**Manual:** Whirlpool & Maytag 4.7/5.3 cu ft Top Load Washer (W11416787 Rev C, direct drive)  
**Platform:** `whirlpool_tl_dd_5100` — models `WTW51*`, `MVW51*` (Whirlpool/Maytag DD)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11416787_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11416787
```

## Procedures (11)

| ID | OEM | Notes |
|----|-----|-------|
| w11416787-test-01-acu-power | TEST #1 | J1 line, diagnostic LED, J14 +12.7 VDC |
| w11416787-test-02-valves | TEST #2 | J16 valves 890–1090 Ω |
| w11416787-test-03-drive-system | TEST #3 | Component Activation pre-check |
| w11416787-test-03a-shifter | TEST #3a | Shifter J15-1↔4, slider on drive |
| w11416787-test-03b-motor | TEST #3b | BPM motor J3 8–10 Ω |
| w11416787-test-04-hmi | TEST #4 | HMI Test; J14 harness to HMI J1 |
| w11416787-test-05-temp-thermistor | TEST #5 | Inlet NTC J16-4↔8 |
| w11416787-test-06-water-level | TEST #6 | Pressure hose / Sensor Feedback |
| w11416787-test-07-drain-recirc-pump | TEST #7 | J15 drain 17.8–21.8 / recirc 26–32 Ω |
| w11416787-test-08-lid-lock | TEST #8 | J6 solenoid 50–160 Ω |
| w11416787-test-09-load-and-go | TEST #9 | Bulk sensor J9 VDC; pump J17 16–19 Ω |

## Bundles (2)

- `w11416787-service-diagnostic-entry` — LCD 3-button Service Mode entry
- `w11416787-component-activation` — Service Diagnostics → Component Activation

## WO smoke

Whirlpool `WTW5100` → `whirlpool_tl_dd_5100`; F5E3 → `w11416787-test-08-lid-lock`; F3E5 → `w11416787-test-09-load-and-go`
