# Whirlpool ADA dishwasher (`whirlpool_dishwasher_ada`) procedure seeds

**Manual:** W11187658 — 18" & 24" ADA Built-In Dishwashers  
**Extraction:** [`WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md) §1  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11187658
```

## Measurement knowledge

| Procedure | Knowledge ID | Spec |
|-----------|--------------|------|
| Fill valve | `whirlpoolDishwasherAdaFillValveOhms` | ~24 Ω (CN5) |
| Heater | `whirlpoolDishwasherAdaHeaterOhms` | ~14 Ω |
| Drain pump | `insigniaDishwasherDrainPumpOhms` | 25–35 Ω (shared spec) |
| Tub thermistor | `insigniaDishwasherTubThermistorOhms` | 10 kΩ @ 77°F (shared spec) |

## Error codes

| Code | Procedure |
|------|-----------|
| E1 | `w11187658-inlet-fill`, `w11187658-fill-valve` |
| E3 | `w11187658-heater`, `w11187658-tub-thermistor` |
| E4 | `w11187658-overflow`, `w11187658-drain-pump` |
| E6/E7 | `w11187658-tub-thermistor` |
