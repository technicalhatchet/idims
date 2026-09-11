# Samsung premium dishwasher — DW80M9 series extraction

**Source:** `backend/docs/manuals/samsung-dishwasher-svc manual diff.pdf`  
**Extracted text:** `backend/docs/manuals/samsung-dishwasher-svc manual diff-extracted.txt`  
**Platform:** `samsung_dishwasher_m9` (`templateId`: `dishwasher`)  
**Manual ID:** `SAMSUNG-DISHWASHER-M9`  
**Measurements:** batch45 (`samsungDishwasherM9*` knowledge IDs)  
**Status:** Procedure seeds from §4 Troubleshooting + Service Inspection Mode (§4-2)

---

## 1. Covered models

| Series | Examples |
|--------|----------|
| DW80M9960 | DW80M9960US/AA, DW80M9960UG/AA, DW80M9960US/AC, DW80M9960UG/AC |
| DW80M9550 | DW80M9550US/AA, DW80M9550UG/AA, DW80M9550US/AC |
| DW80M9990 | DW80M9990US/AA, DW80M9990UM/AA |

**Registry patterns:** `/DW80M9/i`, `/DW80M99/i`, `/DW80M95/i` — premium Waterwall / Auto Door Open family.  
**Not this platform:** `samsung_dishwasher` (DW80R5060/R5061/T5040) — different PCB connectors and §4-2 Smart Install variants.

---

## 2. Service Inspection Mode (§4-2)

| Item | Detail |
|------|--------|
| Enable | Power On → set timer **17 h** → press **Hi-Temp Wash** ≥ **7 s** |
| Disable | Power Off |
| Display | **AS** before Auto Mode; step number blinks during Auto Mode |
| Auto Mode | Close door within 3.7 s after Start → Steps 1–6 (drain/vane → fill → nozzle/heater/dispenser → drain → dry/auto door → OK) |
| Manual Mode | **Auto** key cycles step 1–7; **Start** runs selected step |
| Door codes | **dC / dC1** when door opens during operation (Inverter Micom door sense); Start clears and restarts |
| Info display | Hi-Temp Wash while **AS**: n1 version → **n2 inspection codes** → n3 Smart Install result → n4 cycle count → n5 dry default |
| Clear codes | Hold operation button **7 s** with inspection code on display (n2) |

**Manual step summary**

| Step | Function |
|------|----------|
| 1 | Drain (step 4) + fill (step 2) |
| 2 | Nozzle — Normal key ±100 RPM (1201–3500 BLDC); Heavy key alternation position; Delicate RPM preset |
| 3 | Heater — C-pump 10 s then heater; max 73°C or 10 min; HC1 if no ≥2°C rise |
| 4 | Dispenser 130 s |
| 5 | Fan + dry actuator 30 s |
| 6 | Drain |
| 7 | Auto Door Open actuator (dC3 if door not sensed open after retry) |

**Bundles:** `samsungdwm9-smart-install-entry`, `samsungdwm9-manual-check-mode`, `samsungdwm9-inspection-code-display`

---

## 3. Check codes → procedure routing

| Code | Meaning (summary) | Primary procedure |
|------|-------------------|-------------------|
| 4C / 4E | Water supply / flow meter pulses | `samsungdwm9-fill-valve` |
| 4C5 | False flow pulses (non-fill) | `samsungdwm9-fill-valve` |
| 5C / 5C1–5C6 | Drain pump fault (BLDC + AC paths) | `samsungdwm9-drain-pump` |
| 3C / 3C1–3C6 | Circulation pump fault (inverter) | `samsungdwm9-circulation-motor` |
| PC | Distributor / half-load cam position | `samsungdwm9-distributor` |
| 7C | Lower vane reset / sensor vane | `samsungdwm9-vane-motor` |
| tC | Thermistor out of range / frozen water | `samsungdwm9-thermistor` |
| HC1 | Heater — temp rise ≤4°C in 10 min | `samsungdwm9-heater` |
| HC | Overheat ≥80°C | `samsungdwm9-heater`, `samsungdwm9-thermistor` |
| LC | Leak sensor ≤3 V | `samsungdwm9-leak-sensor` |
| OC | Overflow sensor ≤3 V | `samsungdwm9-overflow` |
| AC | Main ↔ Sub PBA comms fail | `samsungdwm9-communication` |
| AC6 | Main ↔ Inverter PBA comms fail | `samsungdwm9-communication` |
| bC2 / bE-2 | Button held ≥30 s | `samsungdwm9-hmi-check` |
| bC3 / bE-3 | Touch IC comms fail | `samsungdwm9-hmi-check` |
| dC / dC1 | Door open during run | `samsungdwm9-door-switch` |
| dC3 | Auto door open not sensed | `samsungdwm9-dry-system` |
| FC | Dry fan <3000 RPM | `samsungdwm9-dry-system` |
| 9C1 / 9C2 | Abnormal line / DC link voltage | `samsungdwm9-voltage-abnormal` |

---

## 4. Component checks (§4-3) — Ω / test points

| Circuit | Manual ref | Connector / pins | Spec (DW80M9) | batch45 knowledgeId |
|---------|------------|------------------|---------------|---------------------|
| Line power | No Power | Outlet; CN101 | 120 VAC | `supplyVoltage120` |
| Fill valve coil | 4C check | CN401 pin 6 (water valve) | **990 Ω ±10%** (890–1089 Ω) | `samsungDishwasherM9FillValveOhms` |
| Drain pump coil | 5C check | Drain pump connector | **88 Ω ±7%** (~82–94 Ω) | `samsungDishwasherM9DrainPumpOhms` |
| Circulation pump | 3C check | C-pump connector | **5.8 Ω ±10%** | `samsungDishwasherM9CirculationMotorOhms` |
| Heater element | HC1 check | Heater terminals / relay | **12.14–14.16 Ω** | `samsungDishwasherM9HeaterOhms` |
| Thermistor | tC check | CN503 pin 4 | 0.05–4.95 V; **49.12 kΩ @ 25°C** | `samsungDishwasherM9ThermistorOhms` |
| Dispenser | Dispenser check | CN401 pin 4 | **0.7–3 kΩ** | `samsungDishwasherM9DispenserOhms` |
| Distributor motor | PC check | Distributor motor | **3.6–4.0 kΩ** | `samsungDishwasherM9DistributorMotorOhms` |
| Vane motor | 7C check | Red/Black & White/Black | **1.625–1.796 kΩ** | `samsungDishwasherM9VaneMotorOhms` |
| Dry fan | Dry check | Fan connector | **~150 Ω** | `samsungDishwasherM9DryFanOhms` |
| Thermal actuator | Dry check | CN401 pin 5 | **~1.45 kΩ** | `samsungDishwasherM9ThermalActuatorOhms` |
| Door sensing | Cycle won't start | White wire switch | 10.5–13 V open; **<1 V closed** | — (voltage checkpoint) |
| Door switch cont. | Cycle won't start | Blue wire switch | SHORT open / OPEN closed | — (continuity checkpoint) |
| Overflow | OC | CN503 pin 1 | ≤3 V wet / >3 V dry | — (voltage checkpoint) |
| Leak | LC | CN503 pin 2 | ≤3 V wet / >3 V dry | — (voltage checkpoint) |
| Flow meter | 4C / 4C5 | CN503 pin 11 | Pulse count during fill | — (operational) |

**PCB pinouts (§5):** CN503 sensing (overflow, leak, thermistor, flow meter); CN401 relay loads (valve, drain, distributor, dispenser, vane, auto door, dry); CN501 distributor/vane sensors; CN802 sub comm (5V/12V/TX/RX); CN901 BLDC wash pump; CN902 BLDC drain.

---

## 5. Generated procedures

| ID | OEM section | Title |
|----|-------------|-------|
| `samsungdwm9-power-supply` | No Power + Power Relay | Main PBA power & relay |
| `samsungdwm9-thermistor` | §4-3 tC | Water thermistor |
| `samsungdwm9-heater` | §4-3 HC / HC1 | Heater element & relay |
| `samsungdwm9-circulation-motor` | §4-3 3C | Circulation pump (BLDC/inverter) |
| `samsungdwm9-door-switch` | Cycle won't start | Door sensing switch |
| `samsungdwm9-fill-valve` | §4-3 4C | Fill valve & flow meter |
| `samsungdwm9-drain-pump` | §4-3 5C | Drain pump |
| `samsungdwm9-dispenser` | Dispenser check | Detergent dispenser |
| `samsungdwm9-dry-system` | FC / dC3 | Dry fan, actuator & auto door |
| `samsungdwm9-leak-sensor` | LC | Leak sensor |
| `samsungdwm9-overflow` | OC | Overflow sensor |
| `samsungdwm9-distributor` | §4-3 PC | Distributor / half-load motor |
| `samsungdwm9-vane-motor` | §4-3 7C | Lower vane motor & sensor |
| `samsungdwm9-communication` | AC / AC6 | Main–Sub–Inverter communication |
| `samsungdwm9-hmi-check` | bC2 / bC3 | Touch panel & Sub PBA |
| `samsungdwm9-voltage-abnormal` | 9C1 / 9C2 | Abnormal supply voltage |

---

## 6. Diagram crops

| Asset | PDF page | Use |
|-------|----------|-----|
| `samsungdwm9-main-pcb-layout.png` | 54 (§5-1) | Main PCB connector map |
| `samsungdwm9-main-pcb-pinout.png` | 55 (§5-2) | CN101/CN401/CN503/CN802 pin lists |

---

## 7. Pipeline

```bash
python backend/scripts/generate_samsung_dishwasher_m9_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` — Samsung + **DW80M9960US** / **DW80M9550US** / **DW80M9990US**.
