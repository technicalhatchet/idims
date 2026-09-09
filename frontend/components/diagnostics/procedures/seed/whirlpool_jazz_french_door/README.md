# whirlpool_jazz_french_door — W10322959 procedure seeds

**Manual:** Whirlpool Jazz French Door Refrigerator (W10322959B, 19–22 cu ft)  
**Platform:** `whirlpool_jazz_french_door` — WRF53/54/55/56/98/99, KRMF55, KRFF5, GI5F  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_JAZZ_FD_W10322959_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10322959
```

## Procedures (10)

| ID | OEM | Notes |
|----|-----|-------|
| w10322959-test-01-defrost | S-E 1 | Defrost bimetal O/S + heater ohms |
| w10322959-test-02-compressor | S-E 2 | Compressor/condenser fan + EM2Y60 ohms |
| w10322959-test-03-evap-fan | S-E 3 | Evaporator fan run check |
| w10322959-test-04-ff-thermistor | S-E 4 | FF NTC P/O/S + bench ohms |
| w10322959-test-05-fz-thermistor | S-E 5 | FZ NTC P/O/S + bench ohms |
| w10322959-test-06-damper | S-E 6 | Damper O/C toggle (1 min) |
| w10322959-test-07-ff-performance | S-E 7 | FF offset 1–9 (instruction) |
| w10322959-test-08-fz-performance | S-E 8 | FZ offset 1–9 (instruction) |
| w10322959-test-09-defrost-interval | S-E 9 | Adaptive vs fixed 6 hr |
| w10322959-programming-mode | P-E | Program code validate/set |

## Bundles (2)

- `w10322959-service-test-entry` — door switch + Fridge UP ×3 → S-E
- `w10322959-forced-defrost-entry` — door switch + Fridge DOWN ×3 → F-d

## WO smoke

Whirlpool `WRF535SWHZ` → `whirlpool_jazz_french_door`; heavy frost → `w10322959-test-01-defrost`
