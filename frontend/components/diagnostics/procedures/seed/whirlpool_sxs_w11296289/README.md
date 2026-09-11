# whirlpool_sxs_w11296289 — W11296289 procedure seeds

**Manual:** Whirlpool/Maytag/Amana/IKEA Side-by-Side Refrigerator (W11296289)  
**Platform:** `whirlpool_sxs_w11296289` — WRS321/325/315/311/312, ASI2575, WRSA15  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11296289_SXS_REFRIGERATOR_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11296289
```

## Procedures (13)

| ID | OEM step | Notes |
|----|----------|-------|
| w11296289-test-01-fc-thermistor | 1 | FC NTC LED + 2.7 kΩ |
| w11296289-test-03-rc-thermistor | 3 | RC NTC |
| w11296289-test-05-defrost-thermistor | 5 | Defrost NTC |
| w11296289-test-07-compressor-cond-fan | 7 | Compressor/cond fan + ohms |
| w11296289-test-09-damper-open | 9 | Damper open |
| w11296289-test-11-damper-heater | 11 | Damper heater |
| w11296289-test-13-defrost-heater | 13 | Defrost heater 550–650 Ω |
| w11296289-test-15-evap-fan | 15 | Evap fan 2–9 Ω |
| w11296289-test-19-water-valve | 19 | Dispenser valve |
| w11296289-test-21-rc-door-switch | 21 | RC door switch |
| w11296289-test-23-fc-door-switch | 23 | FC door switch |
| w11296289-athena-fail-display | Athena 6 | Fail LED decode |
| w11296289-test-33-im-tray-thermistor | 33 | IDI SANKYO tray NTC |

## Bundles (2)

- `w11296289-theseus-service-entry` — FREEZER TEMP + ICE TYPE ×3
- `w11296289-athena-service-entry` — door switch + RC TEMP 5 s

## WO smoke

Whirlpool `WRS325SDHZ` → `whirlpool_sxs_w11296289`; warm FF → `w11296289-test-09-damper-open`
