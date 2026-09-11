# Samsung dishwasher — DW80R5060/R5061/T5040 extraction

**Source:** `backend/docs/manuals/samsung-dishwasher-svc manual.pdf`  
**Extracted text:** `backend/docs/manuals/samsung-dishwasher-svc manual-extracted.txt`  
**Platform:** `samsung_dishwasher` (`templateId`: `dishwasher`)  
**Manual ID:** `SAMSUNG-DISHWASHER`  
**Measurements:** batch41 (`samsungDishwasher*` knowledge IDs)  
**Status:** Procedure seeds from §4 Troubleshooting + Service Inspection Mode

---

## 1. Covered models

| Series | Examples |
|--------|----------|
| DW80R5061 | DW80R5061UT, DW80R5061US, DW80R5061UG |
| DW80R5060 | DW80R5060US, DW80R5060UG |
| DW80T5040 | DW80T5040US |
| DW80J3020 | Basic reference model |
| DW80K5050 | Spec cross-reference (motor wattage) |

**Not in manual:** LDT* (LG platform). **Registry patterns:** `DW80`, `DW82`, `DW60`, `DW50` (Samsung dishwasher naming §7-1).

---

## 2. Service Inspection Mode (§4-2 Smart Install)

| Item | Detail |
|------|--------|
| Enable | Power On → set timer **17 h** → press **Hi-Temp Wash** ≥ **7 s** |
| Disable | Power Off |
| Display | **AS** before Auto Mode; step number blinks during Auto Mode |
| Auto Mode | Start → Steps 1–6 (drain/vane → fill → nozzle/heater/dispenser → drain → dry/fan → OK) |
| Manual Mode | Auto key cycles step 1–7; Start runs selected step |
| Info display | Hi-Temp Wash while **AS**: n1 version → **n2 inspection codes** → n3 result → n4 cycle count → n5 dry default |
| Clear codes | Hold operation button **7 s** with inspection code on display (n2) |

**Bundles:** `samsungdw-smart-install-entry`, `samsungdw-manual-check-mode`, `samsungdw-inspection-code-display`

---

## 3. Check codes → procedure routing

| Code | Meaning (summary) | Primary procedure |
|------|-------------------|-------------------|
| 4C / 4E | Water supply / flow meter pulses | `samsungdw-fill-valve` |
| 4C5 | False flow pulses (non-fill) | `samsungdw-fill-valve` |
| 5C / 5C1–5C5 | Drain pump fault | `samsungdw-drain-pump` |
| PC | Distributor / cam position not detected | `samsungdw-distributor` |
| tC | Thermistor out of range / frozen water | `samsungdw-thermistor` |
| HC1 | Heater — temp rise ≤4°C in 10 min | `samsungdw-heater` |
| HC | Overheat ≥80°C | `samsungdw-heater`, `samsungdw-thermistor` |
| LC | Leak sensor ≤3 V | `samsungdw-leak-sensor` |
| OC | Overflow sensor ≤3 V | `samsungdw-overflow` |
| AC | Main ↔ Sub PBA comms fail | `samsungdw-communication` |
| AC6 | Main ↔ Inverter PBA comms fail | `samsungdw-communication` |
| bC2 | Button held ≥30 s | `samsungdw-hmi-check` |
| bC3 | Touch IC comms fail | `samsungdw-hmi-check` |
| dC3 | Auto door open not sensed | `samsungdw-dry-system` |
| FC | Dry fan <3000 RPM | `samsungdw-dry-system` |

---

## 4. Component checks (§4-1 / symptom tables) — Ω / test points

| Circuit | Manual ref | Connector / pins | Spec (DW80R506*) | batch41 knowledgeId |
|---------|------------|------------------|------------------|---------------------|
| Line power | Power Check | Outlet; CN101 B/W | 120 VAC | `supplyVoltage120` |
| Main PBA 5 VDC | DC voltage | CN302-4 ↔ CN301-6 | 4.5–5.5 V | — (visual checkpoint) |
| Main PBA 9–12 V | DC voltage | CN301-9 ↔ CN301-11 | 9.5–12.5 V on; 5.5–7.0 V off | — (visual checkpoint) |
| Thermistor | tC table | CN505-5 & -6 | 0.2–4.5 V powered; **49.12 kΩ @ 25°C** | `samsungDishwasherThermistorOhms` |
| Circulation motor | Nozzle check | Motor connector | **~5.8 Ω** coil | `samsungDishwasherCirculationMotorOhms` |
| Door sensing | Cycle won't start | Blue wire switch | OPEN open / SHORT closed | — (continuity checkpoint) |
| Dispenser | Detergent check | Dispenser connector | **~2.3 kΩ** | `samsungDishwasherDispenserOhms` |
| Dry fan motor | Dry not satisfied | Fan connector | **~150 Ω** | `samsungDishwasherDryFanOhms` |
| Thermal actuator | Dry not satisfied | Actuator connector | **~1.45 kΩ** | `samsungDishwasherThermalActuatorOhms` |
| Heater | HC flowchart | Heater terminals | 1100 W spec; **Heater Check body missing from PDF extract** — use Smart Install step 3 + inlet hot-water check | — (operational) |
| Inlet valve / drain | 4C / 5C flowcharts | CN202-3 valve; CN203-3 drain | No bench Ω in manual — Smart Install + mechanical checks | — |

**PCB pinouts:** CN505 (thermistor, overflow, leak, flow meter); CN202 (valve, dispenser, distributor); CN203 (drain, auto door).

---

## 5. Generated procedures

| ID | OEM section | Title |
|----|-------------|-------|
| `samsungdw-power-supply` | §4-1 Power + DC | Main PBA power & DC supplies |
| `samsungdw-thermistor` | §4-1 tC | Water thermistor |
| `samsungdw-heater` | §4-1 HC / HC1 | Heater operation |
| `samsungdw-circulation-motor` | Nozzle / wash | Circulation motor & nozzle |
| `samsungdw-door-switch` | Door sensing | Door switch circuit |
| `samsungdw-fill-valve` | §4-1 4C | Fill valve & flow meter |
| `samsungdw-drain-pump` | §4-1 5C | Drain pump |
| `samsungdw-dispenser` | Dispenser check | Detergent dispenser |
| `samsungdw-dry-system` | FC / dry | Dry fan & thermal actuator |
| `samsungdw-leak-sensor` | LC | Leak sensor |
| `samsungdw-overflow` | OC | Overflow / case brake |
| `samsungdw-distributor` | PC | Distributor motor |
| `samsungdw-communication` | AC / AC6 | Main–Sub–Inverter communication |
| `samsungdw-hmi-check` | bC2 / bC3 / LED | Touch panel & Sub PBA |

---

## 6. Gaps / deferred

- **Heater bench Ω** — "Heater Check" referenced but not present in extracted PDF pages; operational Smart Install + HC flowchart used
- **Inlet valve / drain pump Ω** — not listed in manual symptom tables; mechanical + live Smart Install only
- **Diagram crops** — PCB pinout pages exist (§5–6) but wiring diagram page is sparse in extract; deferred v1
- **LDT models** — not covered by this manual (LG platform)

---

## 7. Pipeline

```bash
python backend/scripts/generate_samsung_dishwasher_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` with make Samsung + model **DW80R5060** / **DW80R5061**.
