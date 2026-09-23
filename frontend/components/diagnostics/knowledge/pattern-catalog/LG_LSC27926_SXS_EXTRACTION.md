# LG LSC27926 side-by-side refrigerator — extraction

**Source:** `backend/docs/manuals/LGSxS.pdf` (101 pages)  
**Extracted text:** `backend/docs/manuals/LGSxS-extracted.txt`  
**Scope:** LSC27926** SxS with dispenser (water + ice), conventional compressor relay, BLDC F-FAN/C-FAN.  
**Platform:** `lg_sxs` — **separate from** `lg_lrmvs` (French-door linear compressor).

---

## 1. Control architecture

| Element | Detail |
|---------|--------|
| Main PCB | MICOM load orchestration — compressor relay, defrost heater relay, BLDC fans, stepper dampers |
| Display PCB | Dedicated MICOM — 4-wire L/Wire FD/H to main (§1-11, p33) |
| Compressor | Conventional AC relay drive (RY2) — **not** LRMVS linear inverter |
| Evap fan | F-FAN — freezer BLDC, high-speed in Test 1 |
| Condenser fan | C-FAN — machine-room BLDC, runs with compressor in Test 1 |
| Air damper | Stepping motor baffle + OptiChill stepping damper (Test 1 open / Test 2 closed) |

---

## 2. PCB test button (§2-17, p21)

**Location:** Main PCB test switch. Exit test: unplug and replug. Max 2 h auto-reset. No test during active fault codes.

| Mode | Entry | Loads / display |
|------|-------|-----------------|
| **Test 1** | Press test button once | COMP ON, F-FAN + C-FAN high RPM, defrost heater OFF, main damper OPEN, OptiChill damper CLOSED, all display segments ON |
| **Test 2** | Press test button once at Test 1 | COMP OFF, fans OFF, defrost heater ON, main damper CLOSED, OptiChill CLOSED, display segments OFF |
| **Normal** | Press test button once at Test 2 | Return to normal operation |

**Door behavior in Test 1:** Freezing fan stops when any door opens; resumes when closed (§1-4 load circuit, p24).

---

## 3. LCD / LED check (§2-16, p20)

Hold **Express Freezer** + **Freezer temp adjust** ~1 s → all LCD/LED graphics on (backlight check). Release restores prior display.

LCD check also reveals hidden sensor faults (R2, OptiChill, water tank, ice maker sensor/unit, ambient on Better1) not shown on main fault display.

---

## 4. Sensor resistance (§1-12 table, p34)

Measure after 3 min stabilization. ±5% tolerance. Power off, disconnect harness.

| Sensor | Connector | Notes |
|--------|-----------|-------|
| Freezing (freezer cabinet) | **CON7** | NTC table −20 °C … +50 °C |
| Cold storage 1 & 2 (fresh food) | **CON8** | Shared table |
| Defrost | Main PCB defrost sensor circuit | Same NTC table as frost removal sensor |
| Ambient (Better1 only) | Ambient circuit | "Er" on ambient display when failed |

Typical @ +25 °C: ~11 kΩ (freezer/cold storage table).

---

## 5. Display communication (§1-11, p33)

Main MICOM ↔ display MICOM over 4-wire harness. Failure if exchange stops >2 min. Symptoms: partial display, comm fault codes.

---

## 6. Door switches (§1-4, p24)

Freezer and refrigerator door switches **(A), (B), (C), (D)** wired in parallel to MICOM door-open sense. Switches (A) and (B) interconnected — either failure affects both.

**Test mode evidence:** Fan stops on door open during Test 1 (independent door_switch diagnostic path vs Samsung RS28 abstention).

---

## 7. Defrost heater (Test 2 + troubleshooting p73+)

Test 2 forces defrost heater ON. Flowchart: check CON2 (1–7) voltage after test button; relay RY7; defrost sensor resistance.

Use `lgDefrostHeaterVoltage` in Test 2; bench Ω before live test.

---

## 8. Ice maker + dispenser (§3, p42+, LSC27926** only)

- In-door ice/water without opening freezer door  
- Ice maker on main PWB with test switch input (same door-switch detect circuit)  
- Water solenoid on back plate; dispenser relays RY4, RY5, RY12 (ice), RY7 (water)

---

## 9. Complaint routing

| Complaint / symptom | First OEM procedures |
|---------------------|---------------------|
| Not cooling | Test 1 → compressor relay, F-FAN, C-FAN, CON7/CON8 sensors |
| Heavy frost / no defrost | Test 2 → defrost heater, defrost sensor |
| Weak FF cooling | Damper (Test 1 open / Test 2 closed), CON8 sensors |
| Display dead / partial | LCD check, display communication |
| Door left open behavior | Door switch A/B/C/D, Test 1 fan stop |
| No ice / no water | Ice maker, water dispenser (LSC27926** models) |

---

## 10. Procedure seed checklist (`lgsxs-*`)

| ID | OEM ref | Tags |
|----|---------|------|
| `lgsxs-test-mode-entry` | §2-17 bundle | service_diagnostic, control_board |
| `lgsxs-lcd-check` | §2-16 | hmi_check, user_interface |
| `lgsxs-freezer-sensor` | CON7 / table | thermistor, not_cooling |
| `lgsxs-fresh-food-sensor` | CON8 | thermistor, weak_cooling_ff |
| `lgsxs-defrost-sensor` | Defrost NTC | defrost, frost_buildup |
| `lgsxs-ambient-sensor` | Better1 ambient | thermistor, Er |
| `lgsxs-fz-fan` | F-FAN Test 1 | evap_fan, airflow |
| `lgsxs-condenser-fan` | C-FAN Test 1 | condenser_fan, not_cooling |
| `lgsxs-damper` | Stepper + OptiChill | damper, airflow |
| `lgsxs-defrost-heater` | Test 2 | defrost_heater, no_defrost |
| `lgsxs-compressor` | Relay RY2 Test 1 | compressor, not_cooling |
| `lgsxs-door-switch` | A/B/C/D + Test 1 | door_switch |
| `lgsxs-display-communication` | §1-11 p33 | E_CO, hmi_check |
| `lgsxs-ice-maker` | §3 ice maker | ice_maker, no_ice |
| `lgsxs-water-dispenser` | §2-18 / RY7 | water_dispenser |

**Do not** reuse LRMVS linear-compressor CH/CL sealed-system or CON4 pinouts.
