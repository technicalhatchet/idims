# Samsung front-load washer (WF6000R family) — extraction

**Source:** `backend/docs/manuals/samsung fl washer wf45t6000.pdf`  
**Extracted text:** `backend/docs/manuals/samsung fl washer wf45t6000-extracted.txt`  
**Scope:** Samsung drum-type FL washers WF45T/WF45R/WF22R/WF20T (WF6000R platform, 2024 service manual)  
**Platform:** `samsung_fl_washer_wf6000r`  
**Manual ID:** `SAMSUNG-FL-WF6000R-WASHER`  
**Status:** Phase A — error codes, Smart Install test modes, corrective actions with Ω specs.  
**Knowledge:** `measurement-knowledge-batch42.json`

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| WF45T* | WF45T6000AW |
| WF45R61* | WF45R6100AP, WF45R6100AW |
| WF45R63* | WF45R6300AP, WF45R6300AW |
| WF22R62* | WF22R6270AV, WF22R6270AW |
| WF20T60* | WF20T6000AWCXD |

Make: **Samsung** only. Distinct from `samsung_fl_washer_bb8700` (new-style BB8700) and `samsung_tl_washer_a50` (top-load).

---

## 2. Error / information codes (§4-1, §4-3)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **1C** | Water level sensor fault | Water level sensor |
| **3C** | Drum motor / hall sensor fault | Motor circuit |
| **3E** | Motor overload (too much laundry) | Motor circuit (load check) |
| **4C** | Water supply error | Inlet valves |
| **4C2** | Hot/cold hoses reversed or high temp | Inlet valves |
| **5C** | Drain error | Drain pump |
| **9C1 / 9C2** | Power / voltage fault | Power supply |
| **AC** | Main ↔ sub PBA comm | Communication |
| **AC3** | DR module comm | Communication |
| **AC4** | Wi-Fi module comm | Communication |
| **AC5** | LCD module comm | Communication |
| **AC6** | Main ↔ inverter PBA comm | Communication |
| **BC2** | Switch / main relay stuck | HMI switch |
| **DC** | Door switch fault | Door lock |
| **DC1** | Door lock/unlock fault | Door lock |
| **DDC / DC3** | Add-door / barrier lock | Door lock (add door) |
| **HC / HC1** | Heater / high temp fault | Wash heater + thermistor |
| **LC** | Water leakage / drain fault | Drain pump |
| **OC** | Overflow | Overflow |
| **TC1** | Wash temperature sensor | Wash thermistor |
| **UV / UB** | Unbalance | Unbalance (load) |
| **8C / 8C1 / 8C2** | MEMS PBA error | MEMS sensor |
| **SF** | System error (MCU fail) | Replace main PBA (deferred v1) |
| **SUD** | Excess foam (informational) | Consumer education (no procedure) |

---

## 3. Service modes (§4-2 Smart Install)

| Mode | Entry |
|------|-------|
| Smart Install | Standby → schedule 17:00 → Start/Pause 7 s |
| Automatic check | Smart Install → Start/Pause while "AS" |
| Manual check | Smart Install → Delay End while "AS" |
| S/W version | Smart Install → first bottom-left button while "AS" |
| Diagnostic code check | "AS" or "Cr" → jog dial CW (7 digits max) |

**Manual check steps (Delay End advances):** 1 door lock, 2 drain pump, 3 prep valve, Co cold, Ho hot, 6 water shot + wash heater + rinse, 7 drain, 8 spin/dehydration, 9 dry heater + fan, 10 door. OK(Ot) = pass; nG = fail.

---

## 4. Measurements (Ω / frequency)

| Component | Spec | Reference |
|-----------|------|-----------|
| Motor windings (§4-3 3C) | **6.0 Ω** @ 25°C any two of three terminals | §4-3 3C corrective |
| Motor windings (§3 rear motor checkpoint) | **15 Ω** each pair Blue-White-Red | §3-2 disassembly — use §4-3 value at connector for 3C |
| Motor hall sensor (pins 1–3, 1–4) | **2–4 MΩ** | §4-3 3C |
| Wash heater (bench, 1900 W) | **27.1 Ω** | §3 heater removal |
| Wash heater (bench, 2000 W) | **26.2 Ω** | §3 heater removal |
| Wash heater in-circuit (TYPE 1) | **16.05 ± 0.65 Ω** A–B | §4-3 HC |
| Wash thermistor (room) | **12 kΩ** | §3 thermistor |
| Door switch TYPE 1 (pins 1–3) | **~175 Ω** | §4-3 DC |
| Door lock TYPE 2 (pins 2–3, slider pushed) | **60–90 Ω** | §4-3 DC1 |
| Door lock motor (pins 1–2) | **46.57 ± 15 Ω** | §4-3 DDC/DC3 |
| Water level sensor frequency | **~25.5 kHz** no load (pink/orange wires) | §4-3 1C |

**Not TL A50:** motor is **6.0 Ω** (not 19.3 Ω top-load spec).

---

## 5. Complaint routing

| Symptom | Priority |
|---------|----------|
| Won't start | Supply, door, child lock → Smart Install |
| Won't fill | Taps, hoses, 4C → inlet valves (Co/Ho manual check) |
| Won't drain/spin | Filter, hose, 5C/LC → drain pump |
| Door won't open | Drain drum, 3 min lock timeout |
| No heat / HC | Heater ohms → thermistor → PBA |
| Motor 3C | Motor 6.0 Ω → hall sensor → PBA |
| Overflow OC | Level sensor hose → sensor → defrost |

---

## 6. Procedure index (generated)

| ID | OEM section | Tags |
|----|-------------|------|
| `samsungwf6000r-motor-circuit` | §4-3 3C | 3C, 3E, motor_check |
| `samsungwf6000r-wash-heater` | §4-3 HC | HC, HC1, no_heat |
| `samsungwf6000r-wash-thermistor` | §4-3 TC1 | TC1, thermistor |
| `samsungwf6000r-door-lock` | §4-3 DC/DC1 | DC, DC1, DDC, DC3 |
| `samsungwf6000r-water-level-sensor` | §4-3 1C | 1C, fill_issue |
| `samsungwf6000r-drain-pump` | §4-3 LC/5C | LC, 5C, drain_issue |
| `samsungwf6000r-inlet-valves` | §4-3 4C | 4C, 4C2, fill_issue |
| `samsungwf6000r-communication` | §4-3 AC* | AC, AC6, hmi_check |
| `samsungwf6000r-overflow` | §4-3 OC | OC, overflow |
| `samsungwf6000r-power-supply` | §4-1 9C1/9C2 | 9C1, 9C2, no_power |
| `samsungwf6000r-unbalance` | §4-3 UV | UV, UB, unbalance |
| `samsungwf6000r-mems-sensor` | §4-1 8C* | 8C, 8C1, 8C2 |
| `samsungwf6000r-hmi-switch` | §4-1 BC2 | BC2, hmi_check |

**Bundles:** `samsungwf6000r-smart-install-entry`, `samsungwf6000r-manual-check-mode`, `samsungwf6000r-diagnostic-code-check`

**Diagram crops:** p.15 motor, p.19 main PCB, p.21 door lock, p.23 valves/level sensor, p.27 heater/thermistor

**Deferred v1:** SF system-error dedicated procedure; SUD foam (informational only); dry-duct condensing thermistor (TC1 §4-3 TYPE 2 dry path — combo units only).
