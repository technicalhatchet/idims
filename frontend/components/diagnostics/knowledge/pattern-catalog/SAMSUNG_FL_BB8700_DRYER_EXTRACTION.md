# Samsung front-load dryer (BB8700 / DV8700B) — extraction

**Source:** `backend/docs/manuals/samsung fl dryer new style dv53bb8700.pdf`  
**Extracted text:** `backend/docs/manuals/samsung fl dryer new style dv53bb8700-extracted.txt`  
**Scope:** DVE/DVG 53/46 BB8700/8900/6700 family (electric + gas)  
**Platform:** `samsung_fl_dryer_bb8700`  
**Status:** Phase A — diagnostic codes, Smart Install, component resistance tables §4-6.  
**Knowledge:** `measurement-knowledge-batch20.json`

---

## 1. Model routing

| Fuel | Pattern | Examples |
|------|---------|----------|
| Electric | DVE53BB*, DVE50*, DVE46BB* | DVE53BB8700TA3 |
| Gas | DVG53BB*, DVG50*, DVG46BB* | DVG53BB8700TA3 |

Make: **Samsung** only. User patterns: **DV53BB***, **DV50*** (matches DVE/DVG prefixes).

---

## 2. Information codes (§4-1)

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
| **HC** | Invalid heating temp | Thermistor + heater path |

**Error Recall:** Last error displayed on DVE(G)53BB89/8700* and DVE(G)46BB6700* (Dryness + Temp controls).

---

## 3. Smart Install (§4-3)

| Step | Action |
|------|--------|
| Entry | Power on → hold **Temp + Option** 7 s → "AS" (empty drum) |
| S/W version | Press **Dryness** while "AS" |
| Touch sensor | Open door: 0000 open / 0001 short (wet cloth test) |
| Vent blockage | Close door → Start → "---" ~2 min → result codes |

---

## 4. Component resistance (§4-6)

| Component | Spec |
|-----------|------|
| Electric heater | 240 V, **5300 W** single element (~**11 Ω**) |
| Gas valve 1–2 | **~1365 Ω** |
| Gas valve 1–3 | **~560 Ω** |
| Gas valve 4–5 | **~1325 Ω** |
| Gas valve 6–7 | **~1000 Ω** |
| Gas igniter (101D) | **40–120 Ω** |
| Hi-limit thermostat (60T21) | **< 1 Ω** closed |
| Flame / radiant sensor (10RS) | verify at sensor (closed when hot) |
| Door switch | Off: open; On: closed (continuity) |
| Belt cut-off | open belt / closed belt positions |
| Motor centrifugal | start vs run contact table (1M–6M) |

Thermistors: manual directs resistance check without bench table — compare to sibling reading and vent path.

---

## 5. Procedure index (generated)

| ID | Section | templateIds | Tags |
|----|---------|-------------|------|
| `samsungbb8700-dryer-thermistor` | §4-1 tC/tC5/HC | both | tC, tC5, HC |
| `samsungbb8700-dryer-door-switch` | §4-1 dC/dF | both | dC, dF, door_switch_check |
| `samsungbb8700-dryer-heater-electric` | §4-6 heater | electric_dryer | no_heat |
| `samsungbb8700-dryer-thermal-cutoff` | §4-6 thermostats | both | no_heat |
| `samsungbb8700-dryer-motor-circuit` | §4-6 motor | both | motor_check |
| `samsungbb8700-dryer-belt-cutoff` | §4-6 belt SW | both | motor_check |
| `samsungbb8700-dryer-hmi` | §4-1 bC2 | both | bC2, hmi_check |
| `samsungbb8700-dryer-power` | §4-1 9C1/FC/AC | both | 9C1, FC, AC, no_power |
| `samsungbb8700-dryer-gas-valve` | §4-6 valve | gas_dryer | gas_valve_check |
| `samsungbb8700-dryer-gas-ignitor` | §4-6 igniter | gas_dryer | igniter_check |
| `samsungbb8700-dryer-gas-flame-sensor` | §4-6 radiant | gas_dryer | ignition_issue |

**Bundles:** `samsungbb8700-dryer-smart-install-entry`, `samsungbb8700-dryer-error-recall`
