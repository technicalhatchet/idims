# Insignia DWR3 dishwasher (`insignia_dishwasher`) procedure seeds

**Manual:** NS-DWR3SS1 Top Control Dishwasher  
**Extraction:** [`INSIGNIA_DWR3SS1_DISHWASHER_EXTRACTION.md`](../../knowledge/pattern-catalog/INSIGNIA_DWR3SS1_DISHWASHER_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual INSIGNIA-DWR3-DISHWASHER
```

## Measurement knowledge (batch9)

| Procedure | Knowledge ID | Spec |
|-----------|--------------|------|
| Fill valve | `insigniaDishwasherFillValveOhms` | ~1 kΩ |
| Drain pump | `insigniaDishwasherDrainPumpOhms` | 25–35 Ω |
| Heater | `insigniaDishwasherHeaterOhms` | 10–15 Ω |
| Tub thermistor | `insigniaDishwasherTubThermistorOhms` | 10 kΩ @ 25°C |

## Error codes

| Code | Procedure |
|------|-----------|
| E1 | `nsdwr3ss1-inlet-fill`, `nsdwr3ss1-fill-valve` |
| E3 | `nsdwr3ss1-heater`, `nsdwr3ss1-tub-thermistor` |
| E4 | `nsdwr3ss1-overflow`, `nsdwr3ss1-drain-pump` |
| E6/E7 | `nsdwr3ss1-tub-thermistor` |
| E8 | `nsdwr3ss1-diverter` |
| E9 | `nsdwr3ss1-control-panel` |
| Ed | `nsdwr3ss1-display-comm` |
