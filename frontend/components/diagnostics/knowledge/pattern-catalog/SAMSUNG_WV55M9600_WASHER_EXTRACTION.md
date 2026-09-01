# Samsung FlexWash WV55M9600 extraction

**Source:** `backend/docs/manuals/wv55m9600av.pdf` (FlexWash dual-load)  
**Extracted text:** `backend/docs/manuals/wv55m9600av-extracted.txt`  
**Scope:** Upper + lower washer compartments; shared main PCB; inverter DD motor on lower; sub PBA on upper  
**Status:** Phase A — **Phase B/C not merged**

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

## 4. Measurements

Refer to §4-3 corrective actions in extracted text for motor, valve, and heater resistance checks per compartment.

---

## 5. Phase B/C (deferred)

- Template: dual-load selector or manufacturer chip `flexwash`
- Routing tokens: `AC7`, `DC4`, `4C2`, `SF`
- Evidence: compartment-specific door lock vs shared drain

**DMA:** Samsung `washing_machine` rows in `append_manual_batch_dma_seed.py`
