# whirlpool_freestanding_range — W11746350 / W11174426 procedure seeds

**Manuals:** W11746350F (Copernicus ACU) + W11174426 Rev B (LCX/LCC)  
**Platform:** `whirlpool_freestanding_range` — dual registry `electric_range` + `gas_range`  
**Extraction:** `WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md`, `WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/generate_w11746350_procedure_seeds.py
python backend/scripts/generate_w11174426_procedure_seeds.py
```

## W11746350 procedures (12)

| ID | Fuel | OEM focus |
|----|------|-----------|
| w11746350-acu-power | both | ACU supply F1E1/F1EA/F6E1 |
| w11746350-hmi | both | Touch HMI F2Ex |
| w11746350-oven-sensor | both | RTD 1000–1200 Ω P22 |
| w11746350-door-latch | both | Latch 500–3000 Ω P8 |
| w11746350-vent-fan | both | Fan F7E5/F7E6 |
| w11746350-bake-element | electric | Hidden bake 23.3 Ω ±5% |
| w11746350-broil-element | electric | Broil 10–40 Ω |
| w11746350-convect-element | gas | Convect 14.5–16.1 Ω |
| w11746350-dsi-gas-valve | gas | DSI/regulator 216 Ω |
| w11746350-surface-spark | gas | Cooktop spark module |
| w11746350-bridge-element | electric | Bridge/single/warming Ω |
| w11746350-thermal-fuse | both | Thermo fuse continuity |

**Bundle:** `w11746350-service-diagnostic-entry`

## W11174426 procedures (9)

| ID | Fuel | OEM focus |
|----|------|-----------|
| w11174426-acu-power | both | Control supply F1E0–F2, F9E0 |
| w11174426-hmi | both | Keypad P11 F2E1 |
| w11174426-oven-sensor | both | RTD 1000–1200 Ω P3/Con3 |
| w11174426-door-latch | both | Latch 500–3000 Ω |
| w11174426-bake-element | electric | Bake 10–40 Ω |
| w11174426-broil-element | electric | Broil 10–40 Ω |
| w11174426-infinite-switch | electric | Cooktop infinite switches |
| w11174426-dsi-board | gas | DSI valve 216 Ω J1 |
| w11174426-surface-spark | gas | Surface spark module |

**Bundle:** `w11174426-service-diagnostic-entry`

## WO smoke

Whirlpool `WFE550S0HZ` or Maytag `MER6600F` → `whirlpool_freestanding_range`; F3E0 → oven-sensor proc; F5E1 → door-latch proc.
