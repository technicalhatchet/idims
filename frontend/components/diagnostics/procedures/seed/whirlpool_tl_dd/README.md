# whirlpool_tl_dd — W10864849 procedure seeds

**Manual:** Whirlpool & Maytag 6.2 cu ft Direct Drive Top Load Washer (W10864849)  
**Platform:** `whirlpool_tl_dd` — models `WTW85*`/`MVWB85*` (Cabrio W10758836), `WTW*`/`MVW*` (W10864849 WTW9500 family)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md`  
**Cabrio alias:** W10758836 (WTW8500) — see [WHIRLPOOL_W10758836_CABRIO_WASHER_EXTRACTION.md](../../../knowledge/pattern-catalog/WHIRLPOOL_W10758836_CABRIO_WASHER_EXTRACTION.md) (reuses seeds below; no Ω delta)

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10864849
```

## Procedures (14)

| ID | OEM | Notes |
|----|-----|-------|
| w10864849-test-01-acu-power | TEST #1 | J12 line, diagnostic LED, J18 +5 VDC |
| w10864849-test-02-valves | TEST #2 | J2 valves 790–840 Ω |
| w10864849-test-03-drive-system | TEST #3 | Service Test pre-check |
| w10864849-test-03a-shifter | TEST #3a | Shifter J4-7, slider |
| w10864849-test-03b-motor | TEST #3b | Motor J1 8–10 Ω |
| w10864849-test-04-keys-encoders | TEST #4 | UI J18/J17 |
| w10864849-test-05-temp-thermistor | TEST #5 | Inlet NTC J2 |
| w10864849-test-06-water-level | TEST #6 | Pressure hose |
| w10864849-test-07-drain-recirc-pump | TEST #7 | J4 18–24 / 26–32 Ω |
| w10864849-test-08-lid-lock | TEST #8 | J6 lid lock |
| w10864849-test-09-heater | TEST #9 | Heater (some models) |
| w10864849-test-10-service-leds | TEST #10 | UI service LEDs |
| w10864849-test-11-basket-light | TEST #11 | J19 basket light |
| w10864849-test-12-bulk-dispense | TEST #12 | REX + bulk pump |

## Bundles (2)

- `w10864849-service-diagnostic-entry` — 3-button diagnostic entry
- `w10864849-service-test-mode` — 2nd-button Service Test Mode

## WO smoke

Whirlpool `WTW9500` + F5E2 → `w10864849-test-08-lid-lock`
