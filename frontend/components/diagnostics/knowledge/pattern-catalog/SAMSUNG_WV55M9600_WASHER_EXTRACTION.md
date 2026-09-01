# Samsung FlexWash WV55M9600 extraction

**Source:** `backend/docs/manuals/wv55m9600av.pdf` (FlexWash dual-load)  
**Extracted text:** `backend/docs/manuals/wv55m9600av-extracted.txt`  
**Scope:** Upper + lower washer compartments; shared main PCB; inverter DD motor on lower; sub PBA on upper  
**Status:** Phase A + **Phase B/C merged** (washer template: flexwash chips, flex_compartment field, routing tokens, evidence)

---

## 1. Platform notes

| Item | Detail |
|------|--------|
| Architecture | Dual-load FlexWash; AC7 upper↔lower comm |
| Upper | Smaller load; door lock DC4 |
| Lower | Main DD motor 3C; larger capacity |
| WiFi | AC4 module communication |
| Inverter | AC6 inverter PBA (lower) |

---

## 2. Error codes (dual-column = upper / lower)

| Code | Type | First checks |
|------|------|--------------|
| 1C | Water level sensor | Air hose puncture/fold; sensor terminal |
| 3C | Motor / hall sensor | Motor harness; hall sensor; IPM connector |
| 4C / 4C2 | Water supply | Valves; hose swap hot/cold; Wool/Lingerie >50°C |
| 5C | Drain | Pump impeller; frozen drain; hose clog |
| AC | Sub-main PBA comm | Reseat sub PBA connector |
| AC4 | WiFi comm | WiFi module harness |
| AC6 | Inverter PBA comm | Inverter connector |
| AC7 | Upper-lower PCB comm | Interconnect harness between loads |
| BC2 | Stuck button / relay | Panel deformation; sub PBA mounting |
| DC1 | Door lock switch | Lock terminal leakage |
| DC4 | Upper door open | Close upper compartment door |
| HC1 | Heater fault | Heater + tub temp sensor |
| TC1 | Heater temp sensor | Sensor connector |
| TC4 | Inverter over-temp | Inverter cooling |
| SF | System fault | Replace main PCB |

**Note:** Many codes mirror standard Samsung washer families; **bold new** in DMA batch: AC, AC4, AC6, AC7, BC2, DC1, DC4, 4C2, HC1, TC1, TC4, SF.

---

## 3. Complaint routing

| Symptom | Route |
|---------|-------|
| Upper won't run | DC4 door; AC7 harness; upper sub PBA |
| Lower won't spin | 3C motor/hall; inverter AC6 |
| No fill one compartment | 4C valve for that side; 4C2 hose swap |
| Won't drain either | 5C pump; shared drain path |
| WiFi / Smart Care | AC4; app pairing |

---

## 4. Measurements (Phase B/C + brand-aware)

| Knowledge ID | Spec | Field |
|--------------|------|-------|
| `samsungFlexWashMotorOhms` | Blue-White / White-Red / Red-Blue **~15 Ω** equal | `electrical_measurements.drive_motor_ohms` |
| `samsungFlexWashDrainPumpOhms` | Main drain **13–16.5 Ω** | `electrical_measurements.drain_pump_ohms` |
| `samsungFlexWashHeaterOhms` | **26.2–27.1 Ω** (wattage variant) | `electrical_measurements.wash_heater_ohms` |
| `samsungFlexWashInletValveOhms` | Coil A–B **16.05 ± 0.65 Ω** | `electrical_measurements.inlet_valve_ohms` |

Upper compartment door lock (175 Ω), bubble pump (~40–50 Ω) — deferred; use flexwash_upper chip path first.

---

## 5. Phase B/C (merged)

- **Template:** `washer` — `flex_compartment` choice (upper / lower / both)
- **Chips:** `flexwash`, `flexwash_upper`
- **Routing:** `routingEngine.ts` tokens AC7, DC4, 4C2, AC6, TC4, SF, DC1, BC2
- **Evidence:** `knowledge/evidence/washer.json` — AC7, DC4, 4C2, system fault, flexwash_upper chip
- **Guidance:** `washerFieldGuidance.ts`, `washerFieldVisibility.ts`

**DMA:** Samsung `washing_machine` rows in `append_manual_batch_dma_seed.py`
