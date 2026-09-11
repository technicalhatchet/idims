# Samsung front-load washer (BB8700 family) — extraction

**Source:** `backend/docs/manuals/samsung fl washer new style wf50bb8700.pdf`  
**Extracted text:** `backend/docs/manuals/samsung fl washer new style wf50bb8700-extracted.txt`  
**Scope:** Samsung drum-type FL washers WF50/53/46 BB/BG, WF51CG (2024 service manual)  
**Platform:** `samsung_fl_washer_bb8700`  
**Status:** Phase A — error codes, Smart Install test modes, corrective actions with Ω specs.  
**Knowledge:** `measurement-knowledge-batch22.json`

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| WF50BB* | WF50BB8700AV |
| WF53BB* | WF53BB8700AT, WF53BB8900AD |
| WF46BB* | WF46BB6700AD |
| WF50BG* | WF50BG8300AV |
| WF51CG* | WF51CG8000AV |

Make: **Samsung** only.

---

## 2. Error / information codes (§4-1, §4-3)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **1C** | Water level sensor fault | Water level sensor |
| **3C** | Drum motor fault | Motor circuit |
| **AC** | Main ↔ sub PBA comm | Communication |
| **AC6** | Main ↔ inverter PBA comm | Communication |
| **DC** | Door switch / lock fault | Door lock |
| **DC1** | Main door lock/unlock fault | Door lock |
| **DDC / DC3** | Add-door / barrier lock | Door lock (add door) |
| **HC / HC1** | High temp / heater fault | Wash heater + thermistor |
| **LC / LC1** | Water leakage / drain | Drain pump |
| **OC** | Overflow | Water level / overflow |
| **TC1** | Wash temperature sensor | Wash thermistor |
| **UB / UB1** | Unbalance | Load balance (no OEM ohms) |
| **9C5** | Abnormal current sense (ready) | Power / main PBA |

---

## 3. Service modes (§4-2 Smart Install)

| Mode | Entry |
|------|-------|
| Smart Install | Standby → schedule +17 hr → Start/Pause 7 s |
| Automatic check | Smart Install → Start/Pause while "AS" |
| Manual check | Smart Install → Delay End while "AS" |
| S/W version | Smart Install → Delay End in Option → Spin |
| Diagnostic code check | "AS" or "Cr" → OPTION → jog dial CW (7 digits max) |

**Manual check steps (Spin advances):** 1 door lock, 2 drain pump, 3 prep valve, Co cold, Ho hot, 6 water shot + wash heater + rinse, 7 drain, 8 spin, 9 dry heater + fan, 10 door. OK(Ot) = pass; nG = fail.

---

## 4. Measurements (Ω / frequency)

| Component | Spec | Reference |
|-----------|------|-----------|
| Motor windings (Blue-White-Red) | **15 Ω** each pair | §3 disassembly check point |
| Motor windings (3C corrective) | **6.0 Ω** @ 25°C any two of three terminals | §4-3 3C |
| Wash heater (bench, 1900 W) | **27.1 Ω** | §3 heater removal |
| Wash heater (bench, 2000 W) | **26.2 Ω** | §3 heater removal |
| Wash heater in-circuit (TYPE 1) | **16.05 ± 0.65 Ω** A–B | §4-3 HC |
| Wash thermistor (room) | **12 kΩ** | §3 thermistor |
| Door switch TYPE 1 (pins 1–3) | **~175 Ω** | §4-3 DC |
| Door lock TYPE 2 (pins 2–3, slider pushed) | **60–90 Ω** | §4-3 DC1 |
| Door lock motor (pins 1–2) | **46.57 ± 15 Ω** | §4-3 DDC |
| Water level sensor frequency | **~25.5 kHz** no load (pink/orange wires) | §4-3 1C |

---

## 5. Complaint routing

| Symptom | Priority |
|---------|----------|
| Won't start | Supply, door, child lock → Smart Install |
| Won't fill | Taps, hoses, inlet valves (Co/Ho manual check) |
| Won't drain/spin | Filter, hose, LC → drain pump |
| Door won't open | Drain drum, 3 min lock timeout |
| No heat / HC | Heater ohms → thermistor → PBA |
| Motor 3C | Motor ohms → PBA |

---

## 6. Procedure index (generated)

| ID | OEM section | Tags |
|----|-------------|------|
| `samsungbb8700-motor-circuit` | §4-3 3C | 3C, motor_check |
| `samsungbb8700-wash-heater` | §4-3 HC | HC, HC1, no_heat |
| `samsungbb8700-wash-thermistor` | §4-3 TC1 | TC1, thermistor |
| `samsungbb8700-door-lock` | §4-3 DC/DC1 | DC, DC1, door_lock_check |
| `samsungbb8700-water-level-sensor` | §4-3 1C | 1C, fill_issue |
| `samsungbb8700-drain-pump` | §4-3 LC | LC, LC1, drain_issue |
| `samsungbb8700-inlet-valves` | §4-2 Co/Ho | fill_issue, water_valve_check |
| `samsungbb8700-communication` | §4-3 AC/AC6 | AC, AC6, hmi_check |
| `samsungbb8700-overflow` | §4-3 OC | OC |
| `samsungbb8700-power-supply` | §4-3 9C5 | 9C5, no_power |

**Bundles:** `samsungbb8700-smart-install-entry`, `samsungbb8700-manual-check-mode`, `samsungbb8700-diagnostic-code-check`
