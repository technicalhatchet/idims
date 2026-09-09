# whirlpool_tl_dd_4100 — W11800233 procedure seeds

**Manual:** Whirlpool 4.0–4.3 cu ft Top Load Washer (W11800233 Rev C, ACU belt-drive)  
**Platform:** `whirlpool_tl_dd_4100` — models `WTW41*`, `MVW41*`, `WTW40*`  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11800233_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11800233
```

## Procedures (9)

| ID | OEM | Notes |
|----|-----|-------|
| w11800233-test-01-acu-power | TEST #1 | J1 line, status LED, J5 +12 VDC |
| w11800233-test-02-valves | TEST #2 | J8 valves 1300–1540 Ω |
| w11800233-test-03-drive-system | TEST #3 | Automatic Test pre-check |
| w11800233-test-03a-shifter | TEST #3a | Shifter J6-2↔6; switch J2-1 |
| w11800233-test-03b-motor | TEST #3b | PSC motor J6 3.5–6 Ω + run cap |
| w11800233-test-04-hmi | TEST #4 | HMI Test; J5 harness to HMI J1 |
| w11800233-test-05-water-level | TEST #5 | Auto Test fill 70 mm / drain 3 mm |
| w11800233-test-06-drain-pump | TEST #6 | J6 drain 14–25 Ω |
| w11800233-test-07-lid-lock | TEST #7 | J4 solenoid 50–160 Ω |

## Bundles (2)

- `w11800233-service-diagnostic-entry` — 3-button Service Diagnostic entry
- `w11800233-automatic-test-mode` — Key 2 + START Automatic Test

## WO smoke

Whirlpool `WTW4100` → `whirlpool_tl_dd_4100`; F5E3 → `w11800233-test-07-lid-lock`; F3E2 → `w11800233-test-05-water-level`
