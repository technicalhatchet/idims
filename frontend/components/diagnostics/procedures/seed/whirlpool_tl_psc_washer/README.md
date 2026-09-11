# whirlpool_tl_psc_washer — W11428632 procedure seeds

**Manual:** Whirlpool Multimedia Enhanced Top Load Washer (W11428632C / WTW5057)  
**Platform:** `whirlpool_tl_psc_washer` — models WTW/MVW 5–8 series (4616–8500 feature set; e.g. WTW5057LW)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11428632_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11428632
```

## Procedures (9)

| ID | OEM | Notes |
|----|-----|-------|
| w11428632-test-01-acu-power | TEST #1 | J1 line, diagnostic LED, J5 +12 VDC |
| w11428632-test-02-valves | TEST #2 | J8 valves 890–1090 Ω |
| w11428632-test-03-drive-system | TEST #3 | Component Activation pre-check |
| w11428632-test-03a-shifter | TEST #3a | Shifter J6 2–3.5 kΩ |
| w11428632-test-03b-motor | TEST #3b | PSC motor J6 5–9.5 Ω + run cap |
| w11428632-test-04-hmi | TEST #4 | UI Test (Key 1) / J5 harness |
| w11428632-test-05-water-level | TEST #5 | Pressure hose / Sensor Feedback |
| w11428632-test-06-drain-pump | TEST #6 | J6 drain 17.8–21.8 Ω |
| w11428632-test-07-lid-lock | TEST #7 | J4 solenoid 50–160 Ω |

## Bundles (2)

- `w11428632-service-diagnostic-entry` — Key 1/2/3 diagnostic entry
- `w11428632-automatic-test-mode` — Key 2 + START Automatic Test sequence

## WO smoke

Whirlpool `WTW5057LW` → `whirlpool_tl_psc_washer`; F5E3 → `w11428632-test-07-lid-lock`
