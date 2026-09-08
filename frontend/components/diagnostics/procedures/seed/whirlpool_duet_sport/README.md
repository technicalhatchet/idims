# Whirlpool Duet Sport (`whirlpool_duet_sport`) procedure seeds

**Manual:** Job Aid 8178558 (L-78) — CCU/MCU belt-drive front-load washer  
**Extraction:** [`WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json) — planned procedures and status  
**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual W8178558`

## Layout

```
whirlpool_duet_sport/
├── procedureCatalog.json     # roadmap (not loaded at runtime)
├── bundles/                  # service-mode bundles (if needed later)
└── w8178558-*.json           # one ServiceProcedure per OEM diagnostic
```

## Naming

Duet Sport uses **section references** (e.g. §5-8 Drive Motor), not W11169652 `TEST #n` labels.  
Procedure IDs: `w8178558-{slug}`.

## Measurement knowledge (batch13)

| Procedure (planned) | Knowledge ID | CCU / connector |
|---------------------|--------------|-----------------|
| Motor | `whirlpoolDuetSportWasherMotorOhms` | Motor 5-pin (~6 Ω) |
| Drain pump | `whirlpoolDuetSportWasherDrainPumpOhms` | DP2 (~12.3 Ω) |
| Inlet valves | `whirlpoolDuetSportWasherInletValveOhms` | VCH7 (750–850 Ω) |
| Heater | `whirlpoolDuetSportWasherHeaterOhms` | HE2 (10–15 Ω) |
| Door lock | `whirlpoolDuetSportWasherDoorLockSolenoidOhms` | DL3 (60 Ω) |
| Wash NTC | `whirlpoolDuetSportWasherWashNtcOhms` | TH2 (~2.3 kΩ @ 70°F) |

**Do not reuse W11169652 (`whirlpool_fl_dd`) Ω specs** — motor, pump, and inlet ranges differ.

## Status

| ID | Status |
|----|--------|
| `w8178558-motor-circuit` | Generated (§6 diagnostic live test) |
| `w8178558-drain-pump` | Generated |
| `w8178558-inlet-valves` | Generated |
| `w8178558-door-lock` | Generated |
| `w8178558-wash-heater` | Generated |
| `w8178558-wash-ntc` | Generated |
| `w8178558-pressure-switch` | Generated |
| `w8178558-dispenser-motor` | Generated |
| `w8178558-interlock-switch` | Generated |

Service-mode bundles: diagnostic history entry (§6-5) + manual diagnostic test (§6-7). Diagram crops deferred.
