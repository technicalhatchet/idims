# Samsung top-load / vented dryer (DV50R family) — extraction

**Source:** `backend/docs/manuals/samsung tl dryer dv50r5200.pdf`  
**Also:** `backend/docs/manuals/samsung tl dryer new style.pdf` (same architecture; extracted)  
**Extracted text:** `backend/docs/manuals/samsung tl dryer dv50r5200-extracted.txt`  
**Scope:** Samsung vented dryers DV50R*, DVE50R*, DVG50R* (electric + gas)  
**Platform:** `samsung_tl_dryer_dv50`  
**Status:** Complete — §4-1 codes, §4-2-7 Smart Install, §4-4 component Ω  
**Knowledge:** `measurement-knowledge-batch26.json`

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| DVE50* | DVE50R5200W, DVE50R5400V |
| DVG50* | DVG50R5200W, DVG50R5400V |
| DV50* | DV50R* vented class |

Make: **Samsung** only. Distinct from `samsung_fl_dryer_bb8700` (front-load BB8700). TL rules use **R-series** patterns (`DVE50R`, `DVG50R`, `DV50R`) placed before FL rules to avoid misrouting.

---

## 2. Error / information codes (§4-1)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **tC** | Thermistor1 out of range | Thermistor |
| **tC5** | Thermistor2 out of range | Thermistor |
| **dC** | Door open while running | Door switch |
| **dF** | Incorrect door switch | Door switch |
| **bC2** | Button state fault | HMI |
| **FC** | Invalid power frequency | Power / PCB |
| **9C1** | Invalid voltage | Power / PCB |
| **AC** | Invalid communication | Power / PCB |
| **HC** | Invalid heating temp | Thermistor + heater path |

---

## 3. Service modes (§4-2-7 Smart Install)

| Step | Entry / action |
|------|----------------|
| Enter | Power on → **Adjust Time Up + Temp** 7 s → **SC** |
| Touch sensor | Open door — 0 = open, 1 = short; wet cloth on sensor → 1 |
| Motor + heater | Press **Start** → OK or HC |
| Exit | Power off |

---

## 4. Measurements (§4-4)

| Component | Spec | Fuel |
|-----------|------|------|
| Thermistor | **10 kΩ** @ 25°C | both |
| Thermostat 1/2/3, hi-limit | **< 1 Ω** closed | both |
| Heater single (pin 1–3) | **10 Ω** (5300 W) | electric |
| Heater dual (pin 2–3 / 1–2) | **13 Ω / 34 Ω** | electric |
| Door switch COM–NC/NO | **< 1 Ω** closed side | both |
| Belt cut-off | open < 1 Ω, pushed ∞ | both |
| Motor windings (pin 3–4 / 4–5) | **2.88 Ω / 3.5 Ω** | both |
| Moisture thermistor | **238.23 kΩ** @ 25°C | both |
| Radiant flame sensor 10RS | **< 1 Ω** | gas |
| Gas valve 25M01A coils | **1365 / 560 / 1325 / 1000 Ω** pairs | gas |
| Igniter 101D | **40–400 Ω** | gas |
| Hi-limit 60T21 | **< 1 Ω** | gas |

---

## 5. Procedure index (generated)

| ID | OEM section | templateIds | Tags |
|----|-------------|-------------|------|
| `samsungtldv50-thermistor` | §4-1 / §4-4 | both | tC, tC5, HC |
| `samsungtldv50-door-switch` | §4-1 / §4-4 | both | dC, dF, door_switch_check |
| `samsungtldv50-heater-electric` | §4-4 | electric_dryer | no_heat, HC |
| `samsungtldv50-thermal-cutoff` | §4-4 | both | no_heat, thermal_fuse_check |
| `samsungtldv50-motor-circuit` | §4-4 | both | motor_check |
| `samsungtldv50-belt-cutoff` | §4-4 | both | motor_check |
| `samsungtldv50-hmi` | §4-1 bC2 | both | bC2, hmi_check |
| `samsungtldv50-power` | §4-1 | both | 9C1, FC, AC, no_power |
| `samsungtldv50-gas-valve` | §4-4 | gas_dryer | gas_valve_check |
| `samsungtldv50-gas-ignitor` | §4-4 | gas_dryer | igniter_check |
| `samsungtldv50-gas-flame-sensor` | §4-4 | gas_dryer | ignition_issue |

**Bundle:** `samsungtldv50-smart-install-entry`
