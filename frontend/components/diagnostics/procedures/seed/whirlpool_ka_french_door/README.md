# whirlpool_ka_french_door — W11509412 procedure seeds

**Manual:** Whirlpool/KitchenAid ACU French Door Refrigerator (W11509412A, ~27 cu ft)  
**Platform:** `whirlpool_ka_french_door` — WRF7/8, KRMF70/706, KRFF7, MFI7/MFT7/MFF7  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md`  
**Knowledge:** batch36 (`whirlpoolKaFd*`)

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11509412
```

## Procedures (13)

| ID | OEM | Tags / codes |
|----|-----|--------------|
| w11509412-test-01-fc-thermistor | 1 | thermistor, not_cooling |
| w11509412-test-02-rc-thermistor | 2 | thermistor, weak_cooling_ff |
| w11509412-test-03-evap-fan-damper | 3 | evap_fan, damper |
| w11509412-test-04-compressor | 4 | compressor, sealed_system |
| w11509412-test-06-defrost | 6 | defrost_heater, frost_buildup |
| w11509412-test-36-ice-box-fan | 36 | E1, no_ice |
| w11509412-test-37-ice-box-thermistor | 37 | E1, E5 |
| w11509412-test-19-fill-tube-heater | 19 | E4, fill_tube |
| w11509412-test-45-ice-water-fill | 45 | E4, water_valve |
| w11509412-test-56-ice-maker-errors | 56 | **E0–E5** |
| w11509412-test-57-ice-harvest | 57 | E2, harvest |
| w11509412-test-58-ice-heater-thermistor | 58 | E3, E5 |
| w11509412-test-59-ice-motor | 59 | E2, motor |

## Bundle (1)

- `w11509412-service-diagnostic-entry` — SW1+SW2 ×3 sec → step 01

## WO smoke

Whirlpool `WRF757SDHZ` → `whirlpool_ka_french_door`; no ice + E4 → `w11509412-test-56-ice-maker-errors` then `w11509412-test-45-ice-water-fill`
