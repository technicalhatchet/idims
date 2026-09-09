# Insignia TDRE dryer (`insignia_dryer_tdre`) procedure seeds

**Manual:** NS-TDRE75W1 / NS-TDRG75W1 Service Manual  
**Extraction:** [`INSIGNIA_TDRE75W1_DRYER_EXTRACTION.md`](../../knowledge/pattern-catalog/INSIGNIA_TDRE75W1_DRYER_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)  
**Pipeline:** `python backend/scripts/generate_nstdre75w1_procedure_seeds.py`

## Layout

```
insignia_dryer_tdre/
├── procedureCatalog.json
├── bundles/
│   └── nstdre75w1-service-test-entry.json   # §4.1–4.2 service test mode
└── nstdre75w1-*.json
```

## Service test mode (§4.1–4.2)

Entry: Time Adjust + and Wrinkle Care within 3s after Power → display `St`.  
Screens: 01 version, 02 knob lights, 03 key check, **04 NTC** (E5 on fault), 05 run, Ed end.

## Measurement knowledge (batch9)

| Procedure | Knowledge ID | Notes |
|-----------|--------------|-------|
| Outlet NTC | `insigniaDryerOutletThermistorKohm` | ~50 kΩ @ 77°F; E5 |
| Heater electric | `insigniaDryerHeaterOhms` | 20 Ω element |
| Gas ignitor | `hotSurfaceIgniterOhms` | 40–400 Ω |
| Gas valve | `gasValveCoilOhms` | 1.2k / 0.5k / 1.2k pairs |

## Error codes

| Code | Procedure |
|------|-----------|
| E4 | `nstdre75w1-humidity-sensor` |
| E5 | `nstdre75w1-outlet-thermistor` |
| C9 | `nstdre75w1-communication` |
