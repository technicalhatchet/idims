# Samsung all-in-one laundry combo (WD53 / WD80) — extraction

**Source:** `backend/docs/manuals/samsung aio wd53dba900hza1.pdf`  
**Extracted text:** `backend/docs/manuals/samsung aio wd53dba900hza1-extracted.txt`  
**Scope:** Samsung heat-pump washer-dryer combo WD53DBA*, WD8000DK class  
**Platform:** `samsung_laundry_combo`  
**Manual ID:** `SAMSUNG-LAUNDRY-COMBO-WD53`  
**Status:** Complete — §4-3 Smart Install, §4-4 corrective actions, §4-5 component Ω  
**Knowledge:** `measurement-knowledge-batch43.json`

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| WD53* | WD53DBA900HZA1 |
| WD80* | WD8000DK |

Make: **Samsung** only. Equipment template: `aio_laundry` (heat-pump combo washer + dryer).

---

## 2. Error / information codes

### Wash path (§4-1, §4-4)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **1C** | Water level sensor fault | Water level sensor |
| **3C / 3C1–3C4** | Washing motor / overload | Motor circuit |
| **4C / 4C2** | Water supply error | Inlet valves |
| **5C** | Drain error / pump | Drain pump |
| **AC** | Sub/main PBA communication | Communication |
| **AC3–AC6** | DR / Wi-Fi / LCD / inverter comm | Communication |
| **BC2 / bC2** | Button stuck >30 s | HMI check |
| **DC / DC1** | Door switch / lock fault | Door lock |
| **dC1 / dC2** | Door lock CAM / excessive unlock | Door lock |
| **HC / HC1** | Wash heater / thermistor | Wash heater |
| **LC** | Water leakage | Leak check |
| **OC** | Overflow | Overflow |
| **TC1** | Wash temperature sensor | Wash thermistor |
| **UB / UB1** | Unbalance / tarpaulin | Unbalance |
| **8C / 8C1 / 8C2** | MEMS sensor | MEMS sensor |
| **9C1 / 9C2 / 9C5 / 9C9** | Power / IPM thermal | Power supply |
| **SF** | System error (MCU fail) | System fault |
| **SDC** | Drawer door lock | Door lock (drawer) |
| **SUD** | Foam detected (informational) | — deferred |

### Heat-pump dry path (§4-2)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **tC** | Duct/discharge thermistor out of range | Heat pump thermistors |
| **HC** (compressor) | Compressor overheated; EVA IN/OUT | Compressor / heat pump thermistors |
| **3CA / 3CA1–3CA8** | BLDC compressor / inverter | Compressor |
| **TC5 / TC7 / TC8 / TCA / TCB** | Refrigerant / heater thermistors | Heat pump thermistors |
| **NC / NC2 / NC3** | Filter / cover magnet missing | Filter check |
| **ULC** | Foam in dehumidification | Foam detection |
| **DC5** | Auto-open door failure | Auto-open door |
| **TCH** | Panel temp/humidity sensor | Heat pump thermistors |
| **dC** (dry) | Door open during dry | Door lock |

---

## 3. Service modes (§4-3 Smart Install)

| Mode | Entry |
|------|-------|
| Smart Install | Hidden Mode → **Smart Install** (or Product Care → Self Clean+ tap **25×** within 1 s gaps; password `washerdryer.1!`) |
| Automatic check | Smart Install → **Start Auto mode** |
| Manual check | Smart Install → **Start Manual mode** (each press advances one step) |
| Diagnostic codes | AS → first bottom-right button → **CR** → jog dial CW (7 digits max) |
| S/W versions | AS display shows Main / Inverter #1 / Inverter #2 / LCD versions |

**Manual check steps:** 1 door lock, 2 drain pump, 3 prep valve, Co cold, Ho hot, 6 water shot + wash heater + rinse, 7 drain, 8 dehydration, 9 dry heater + fan, 10 door. OK(Ot) = pass; nG = fail. Drum must be empty.

**Self diagnosis:** Settings → Self diagnosis (consumer path).

---

## 4. Measurements (Ω / frequency)

| Component | Spec | Reference |
|-----------|------|-----------|
| Motor windings | **6.0 Ω** @ 25°C any two of three | §4-4 3C |
| Wash heater in-circuit (A–B) | **16.05 ± 0.65 Ω** | §4-4 HC TYPE 1 |
| Wash heater bench | **27.1 Ω** (1900 W) or **26.2 Ω** (2000 W) | §3 heater checkpoint |
| Wash thermistor | **~12 kΩ** @ room temp | §3 / §4-4 HC TYPE 2 |
| Door switch TYPE 1 (pins 1–3) | **~175 Ω** | §4-4 DC |
| Door lock TYPE 2 (pins 2–3, slider pushed) | **60–90 Ω** | §4-4 DC1 |
| Door lock TYPE 3 (pins 2–3) | **65–75 Ω** | §4-4 DC1 |
| Water level frequency | **~25.5 kHz** no load Pink–Orange | §4-4 1C |
| Drain/circulation pump | **330 Ω** (±15% on 220 V rated) | §4-5 #7 |
| Duct/discharge thermistor | **50 kΩ ± 7%** @ 25°C | §4-5 #1 / tC |
| EVA IN / EVA OUT thermistor | **10 kΩ ± 3%** @ 25°C | §4-5 #2 / HC |
| Compressor top thermistor | **200 kΩ ± 3%** @ 25°C | §4-5 #3 / TCA |
| Heater thermistor (dry) | **238.23 kΩ ± 7.5%** @ 25°C | §4-5 #4 / TCB |
| Dry heater element | **35.6–39.4 Ω** (3P pins 1–3) | §4-5 #5 |

**Note:** §3 rear-motor checkpoint cites **15 Ω** Blue-White/White-Red/Red-Blue — use **6.0 Ω** from §4-4 3C for diagnostic procedure (same as Samsung FL WF6000R family).

---

## 5. Procedure index (generated)

| ID | OEM section | Tags |
|----|-------------|------|
| `samsungwd53-water-level-sensor` | §4-4 1C | 1C, fill_issue |
| `samsungwd53-motor-circuit` | §4-4 3C | 3C, motor_check |
| `samsungwd53-inlet-valves` | §4-4 4C | 4C, fill_issue |
| `samsungwd53-drain-pump` | §4-4 5C / §4-5 | 5C, drain_issue |
| `samsungwd53-communication` | §4-4 AC | AC, AC6, hmi_check |
| `samsungwd53-door-lock` | §4-4 DC | DC, DC1, dC1, door_lock_check |
| `samsungwd53-wash-heater` | §4-4 HC | HC, HC1, no_heat |
| `samsungwd53-wash-thermistor` | §4-4 TC1 | TC1, thermistor |
| `samsungwd53-overflow` | §4-4 OC | OC, overflow |
| `samsungwd53-unbalance` | §4-4 UB | UB, spin_issue |
| `samsungwd53-mems-sensor` | §4-4 8C | 8C, 8C1, 8C2 |
| `samsungwd53-power-supply` | §4-4 9C | 9C1, 9C2, no_power |
| `samsungwd53-hmi-check` | §4-4 BC2 | BC2, hmi_check |
| `samsungwd53-leak-check` | §4-4 LC | LC, leak_check |
| `samsungwd53-heat-pump-thermistors` | §4-5 / §4-2 | tC, TC5, TC7, heat_pump_dry |
| `samsungwd53-dry-heater` | §4-5 #5 | no_heat, heat_pump_dry |
| `samsungwd53-compressor` | §4-2 3CA | 3CA, compressor |
| `samsungwd53-filter-check` | §4-2 NC | NC, NC2, NC3 |
| `samsungwd53-foam-detection` | §4-2 ULC | ULC |
| `samsungwd53-auto-open-door` | §4-2 DC5 | DC5 |
| `samsungwd53-system-fault` | §4-4 SF | SF |

**Bundles:** `samsungwd53-smart-install-entry`, `samsungwd53-manual-check-mode`, `samsungwd53-diagnostic-code-check`

**Diagrams:** deferred — manual has disassembly photos only, no strip-circuit pages.
