# Samsung front-load dryer DV6000T family — extraction

**Source:** `backend/docs/manuals/samsung fl dryer dv6000t.pdf`  
**Extracted text:** `backend/docs/manuals/samsung fl dryer dv6000t-extracted.txt`  
**Scope:** DVE/DVG 45T6000/6005/6200* (DV6000T project); electric platform v1  
**Platform:** `samsung_fl_dryer_dv6000`  
**Status:** Complete — §4-1 codes, §4-4 Smart Install, §4-6 component Ω, heat-pump HE/HC notes  
**Knowledge:** `measurement-knowledge-batch27.json`

---

## 1. Model routing

| Pattern | Examples |
|---------|----------|
| DV6000* | DV6000T project, DV6000R basic |
| DVE45T* / DV45T60* | DVE45T6000W, DVE45T6005W, DVE45T6200W |
| DVE60* | DVE60-class electric FL dryers in manual family |

Make: **Samsung** only. Distinct from `samsung_fl_dryer_bb8700` (53/50BB) and `samsung_tl_dryer_dv50` (DV50R vented TL). Place **before** BB8700 `DVE50` rules — DV6000 uses **45T** / **DV6000** prefixes.

Gas models (DVG45T*) share manual §4-6 gas components; v1 platform is **electric_dryer** template only.

---

## 2. Error / information codes (§4-1)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **tC** | Thermistor1 out of range | Thermistor |
| **tC5** | Thermistor2 out of range | Thermistor |
| **dC** | Door open while running | Door switch |
| **dF** | Incorrect door switch | Door switch |
| **bC2** | Button state / display PCB | HMI |
| **FC** | Invalid power frequency | Power supply |
| **9C1** | Invalid voltage / PCB | Power supply |
| **AC** | Invalid communication | Power / PCB |
| **HC** | Invalid heating temp in run | Thermistor + heater; heat-pump compressor wiring |
| **3C** | Motor relay short | Motor circuit |

**Error Recall:** Hold **Dryness + Wrinkle Prevent** 8 s on DVE(G)45T6200*/6000*/6005* — last error displays.

**Heat pump / compressor (§1-1 safety):** After service, run Time Dry 20 min and verify **HE** does not return. If **HC** occurs on heat-pump units, inspect compressor terminal wiring (pin desorption).

---

## 3. Smart Install (§4-4)

| Step | Action |
|------|--------|
| Entry | Power on → hold **Adjust Time Up + Temp** 7 s → **SC** (empty drum) |
| Touch sensor | Open door — **0** = open, **1** = short; wet cloth → 1 |
| Motor + heater | Press **Start** → **OK** or **HC** |
| Exit | Power off |

---

## 4. Component resistance (§4-6)

| Component | Spec | Notes |
|-----------|------|-------|
| Thermistor (heat path) | **10 kΩ** @ 25°C | Thermistor 1 |
| Moisture thermistor | **238.23 kΩ** @ 25°C | Sensor dry path |
| Thermostat 1/2/3, hi-limit | **< 1 Ω** closed | 85°C / 160°C / 179°C chain |
| Heater single (pin 1–3) | **10 Ω** | 240 V 5300 W |
| Heater dual (pin 2–3 / 1–2) | **13 Ω / 34 Ω** | 3700/1500 W |
| Door switch COM–NC/NO | **< 1 Ω** closed side | 125 V 10 A |
| Belt cut-off | lever open < 1 Ω; pushed ∞ | 125 V 16 A |
| Motor windings (pin 3–4 / 4–5) | **2.88 Ω / 3.5 Ω** | Centrifugal table |
| Hi-limit 60T21 | **< 1 Ω** | 230°F |

Gas-only §4-6 (deferred — electric platform): valve 25M01A coils, igniter 101D 40–400 Ω, radiant 10RS.

---

## 5. Procedure index (generated)

| ID | Section | Tags |
|----|---------|------|
| `samsungdv6000-thermistor` | §4-1 / §4-6 | tC, tC5, HC |
| `samsungdv6000-door-switch` | §4-1 / §4-6 | dC, dF, door_switch_check |
| `samsungdv6000-heater-electric` | §4-6 | no_heat, HC |
| `samsungdv6000-thermal-cutoff` | §4-6 | no_heat, thermal_fuse_check |
| `samsungdv6000-motor-circuit` | §4-6 | motor_check, 3C |
| `samsungdv6000-belt-cutoff` | §4-6 | motor_check |
| `samsungdv6000-hmi` | §4-1 bC2 | bC2, hmi_check |
| `samsungdv6000-power` | §4-1 | 9C1, FC, AC, no_power |
| `samsungdv6000-heat-pump-compressor` | §1-1 / §4-4 HC | HE, HC, heat_pump_check |

**Bundles:** `samsungdv6000-smart-install-entry`, `samsungdv6000-error-recall`
