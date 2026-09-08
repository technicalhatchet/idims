# Whirlpool Duet Sport dryer (`whirlpool_duet_sport_dryer`) procedure seeds

**Manual:** Job Aid 8178559 (L-79) — MCE-era front-load dryer (WED/WGD 83/85)  
**Extraction:** [`WHIRLPOOL_DUET_SPORT_8178559_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_DUET_SPORT_8178559_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json) — planned procedures and status  
**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual W8178559`

## Layout

```
whirlpool_duet_sport_dryer/
├── procedureCatalog.json
├── bundles/
│   └── w8178559-diagnostic-entry.json   # §6-1 diagnostic mode entry
└── w8178559-*.json                      # one ServiceProcedure per OEM TEST
```

## Naming

OEM troubleshooting uses **TEST #n** labels (§6). Procedure IDs: `w8178559-{slug}`.

## Measurement knowledge (batch14)

| Procedure | Knowledge ID | Notes |
|-----------|--------------|-------|
| Motor (TEST #2) | `whirlpoolDuetSportDryerMotorOhms` | 2.4–3.8 Ω windings |
| Heater electric (TEST #3) | `whirlpoolDuetSportDryerHeaterOhms` | 7–12 Ω element |
| Exhaust NTC (TEST #3a) | `whirlpoolDuetSportDryerExhaustThermistorKohm` | ~12 kΩ @ 70°F |
| Gas ignitor | `whirlpoolDuetSportDryerIgnitorOhms` | 50–250 Ω |
| Gas valve (TEST #3d) | `whirlpoolDuetSportDryerGasValveCoilOhms` | 3 coil pairs |

**Do not reuse CCU dryer dual-element specs** — Duet Sport MCE uses a single 7–12 Ω element.

## Status (§6 TEST coverage)

| ID | OEM | Status |
|----|-----|--------|
| `w8178559-supply-connections` | TEST #1 | Generated |
| `w8178559-motor-circuit` | TEST #2 | Generated + diag entry |
| `w8178559-heater-electric` | TEST #3 (electric) | Generated |
| `w8178559-heater-gas` | TEST #3 (gas orchestration) | Generated |
| `w8178559-exhaust-thermistor` | TEST #3a | Generated + diag entry |
| `w8178559-thermal-fuse` | TEST #3b | Generated |
| `w8178559-thermal-cutoff` | TEST #3c | Generated |
| `w8178559-gas-ignitor` | Gas ignitor check | Generated |
| `w8178559-gas-valve` | TEST #3d | Generated |
| `w8178559-moisture-sensor` | TEST #4 | Generated + diag entry |
| `w8178559-dryness-adjust` | TEST #4a | Generated + diag entry |
| `w8178559-button-indicator` | TEST #5 | Generated + diag entry |
| `w8178559-door-switch` | TEST #6 | Generated + diag entry |

Service-mode bundle: diagnostic entry (3-sec × 3 touchpad, §6-1). Diagram crops: 6 OEM figures under `frontend/public/images/procedures/whirlpool_duet_sport_dryer/`.
