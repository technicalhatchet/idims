# Samsung top-load washer (A50 / WA5000R family) — extraction

**Source:** `backend/docs/manuals/samsung tl washer wa50r5200.pdf`  
**Also:** `backend/docs/manuals/samsung tl new style.pdf` (same architecture; extracted)  
**Extracted text:** `backend/docs/manuals/samsung tl washer wa50r5200-extracted.txt`  
**Scope:** Samsung top-load washers WA50R*, WA51DG*, WA52DG*, WF45A* class  
**Platform:** `samsung_tl_washer_a50`  
**Status:** Complete — §5 Test Mode, error codes, §5-3 corrective actions with Ω specs  
**Knowledge:** `measurement-knowledge-batch26.json`

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| WA50* | WA50R5200AW |
| WA51D* | WA51DG5505AVUS |
| WA52D* | WA52DG5500A* |
| WF45A* | WF45A* top-load class |

Make: **Samsung** only. Distinct from `samsung_fl_washer_bb8700` (front-load BB8700).

---

## 2. Error / information codes (§5-2, §5-3)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **1C** | Water level sensor fault | Water level sensor |
| **3C** | Motor fault | Motor circuit |
| **4C / 4C2** | Water not supplied | Inlet valves |
| **5C** | Water not draining | Drain pump |
| **AC / AC6** | PBA communication | Communication |
| **dC / DC / DC1 / DC2** | Door open / lock fault | Door lock |
| **BC2** | Button stuck / relay | HMI check |
| **LC / LC1** | Water leakage / drain | Leak check |
| **UB** | Unbalance spin | Unbalance |
| **8C / 8C1 / 8C2** | MEMS sensor | MEMS PBA |
| **OC** | Overflow | Overflow |
| **HC / HC1** | High temp / heater | Wash heater |
| **TC1–TC4** | Temperature sensors | Wash thermistor |
| **UC / 9C1 / 9C2** | Power voltage fault | Power supply |
| **PC / PC1** | Clutch position | Clutch (visual — no Ω in manual) |

---

## 3. Service modes (§5-1 Test Mode)

| Mode | Entry |
|------|-------|
| Smart Install | Standby → course **Self Clean** → Start/Pause **7 s** |
| Automatic check | Smart Install → Start/Pause while **AS** |
| Manual check | Smart Install → **Spin** while **AS** (Spin advances steps) |
| S/W version | Smart Install → **Temp** while **AS** |
| Diagnostic codes | Smart Install → **Soil** while **AS** → **CR** → jog dial CW (7 digits max) |

**Manual check steps:** 1 door lock, 2 drain pump, 3 prep valve, Co cold, Ho hot, 6 water shot + wash heater + rinse, 7 drain, 8 dehydration, 9 dry heater + fan, 10 door. OK(Ot) = pass; nG = fail.

---

## 4. Measurements (Ω / frequency)

| Component | Spec | Reference |
|-----------|------|-----------|
| Motor windings | **19.3 Ω** @ 25°C any two of three terminals | §5-3 3C |
| Inlet valve | **0.9–1.1 kΩ** | §5-3 4C |
| Drain pump | **13.5–16.5 Ω** | §5-3 5C |
| Reed switch (White–Green) | **~0.2 Ω** | §5-3 DC |
| Door lock motor (Black–Brown) | **33–46 Ω** | §5-3 DC |
| Lock contacts (White–Red / White–Blue) | **~0.2 Ω** | §5-3 DC |
| Water level sensor frequency | **~26.4 kHz** no water (min 25.9 kHz) Blue–Orange | §5-3 1C |

---

## 5. Procedure index (generated)

| ID | OEM section | Tags |
|----|-------------|------|
| `samsungtla50-water-level-sensor` | §5-3 1C | 1C, fill_issue |
| `samsungtla50-motor-circuit` | §5-3 3C | 3C, motor_check |
| `samsungtla50-inlet-valves` | §5-3 4C | 4C, fill_issue |
| `samsungtla50-drain-pump` | §5-3 5C | 5C, drain_issue |
| `samsungtla50-communication` | §5-3 AC | AC, AC6, hmi_check |
| `samsungtla50-door-lock` | §5-3 DC | dC, DC, DC1, DC2, door_lock_check |
| `samsungtla50-hmi-check` | §5-3 BC2 | BC2, hmi_check |
| `samsungtla50-leak-check` | §5-3 LC | LC, LC1, leak_check |
| `samsungtla50-unbalance` | §5-2 UB | UB, spin_issue |
| `samsungtla50-mems-sensor` | §5-3 8C | 8C, 8C1, 8C2 |
| `samsungtla50-overflow` | §5-3 OC | OC |
| `samsungtla50-wash-heater` | §5-3 HC | HC, HC1, no_heat |
| `samsungtla50-wash-thermistor` | §5-3 TC | TC1, TC2, TC3, TC4 |
| `samsungtla50-power-supply` | §5-3 UC | UC, 9C1, 9C2, no_power |
| `samsungtla50-clutch` | §5-2 PC | PC, PC1 |

**Bundles:** `samsungtla50-smart-install-entry`, `samsungtla50-manual-check-mode`, `samsungtla50-diagnostic-code-check`
