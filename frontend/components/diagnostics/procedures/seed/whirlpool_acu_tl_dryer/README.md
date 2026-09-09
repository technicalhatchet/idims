# Whirlpool ACU top-load dryer (`whirlpool_acu_tl_dryer`) procedure seeds

**Manual:** Technical manual W11416805 — WED5100 / WGD5100 family  
**Extraction:** [`WHIRLPOOL_W11416805_DRYER_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_W11416805_DRYER_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)  
**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual W11416805`

## Scope

Whirlpool/Maytag **ACU-era top-load** dryers (`WED51*`, `WGD51*`, `MED51*`, `MGD51*`). Single-element electric heat ~10 Ω (not CCU dual ≤50 Ω or Duet Sport 7–12 Ω). J-connector naming on ACU.

## TEST coverage (14 procedures)

| ID | OEM |
|----|-----|
| `w11416805-acu-power` | TEST #1 |
| `w11416805-supply-connections` | TEST #2 |
| `w11416805-motor-circuit` | TEST #3 |
| `w11416805-heater-electric` | TEST #4 (electric) |
| `w11416805-heater-gas` | TEST #4 (gas orchestration) |
| `w11416805-thermistors` | TEST #4a |
| `w11416805-thermal-fuse` | TEST #4b |
| `w11416805-thermal-cutoff` | TEST #4c |
| `w11416805-gas-valve` | TEST #4d |
| `w11416805-moisture-sensor` | TEST #5 |
| `w11416805-hmi` | TEST #6 |
| `w11416805-door-switch` | TEST #7 |
| `w11416805-drum-light` | TEST #8 |
| `w11416805-water-valve` | TEST #9 |

Bundle: `w11416805-diagnostic-entry` (3-button × 3 sequence, LCD Service Mode).

Deferred: ACU pinout diagram crops.
