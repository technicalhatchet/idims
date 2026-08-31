# Dryer service manual extraction (general troubleshooting knowledge)

**Source:** Whirlpool electric & gas dryer service data sheet (28 pp.) — `backend/docs/manuals/whirlpool-electric-gas-dryers.pdf.pdf`  
**Extracted text:** `backend/docs/manuals/whirlpool-electric-gas-dryers-extracted.txt`  
**Scope:** Brand-agnostic dryer troubleshooting patterns. Whirlpool-specific service-mode keystrokes and connector pinouts are noted but generalized where possible.  
**Status:** Phase A + B + C merged (fields, evidence, elimination, F-code routing, `heats_when_shouldnt`, control components). Chip boosts tuned to 20; multi-signal rules 22–28. Re-tune on completed jobs.

Cross-reference inventories: [INVENTORY_ELECTRIC_DRYER.md](./INVENTORY_ELECTRIC_DRYER.md), [INVENTORY_GAS_DRYER.md](./INVENTORY_GAS_DRYER.md).

---

## 1. Universal pre-service checklist

Apply before any complaint-specific work:

| Check | Why it matters | Maps to existing fields |
|-------|----------------|-------------------------|
| Standby mode / power at outlet | No response ≠ always dead control | `motor_electrical.supply_voltage`, chip `no_power` |
| Time-delay fuse (not regular fuse) on 240 V electric | Half-heat or dead from blown leg | field help on supply |
| Breaker not tripped; both legs present (electric) | L1/L2 loss → no heat or no motor | `supplyVoltage240`, F4E4 / L2 |
| Gas supply valve on (gas) | No ignition path | `commonly_missed.gas_supply` |
| Vent installed, clear of lint/obstructions | Restricted airflow → long dry, F4E3, blown thermal devices | `commonly_missed.*`, `functional_checks.airflow` |
| Lint screen clean | Same as vent restriction cascade | `commonly_missed.lint_trap`, `visual_inspection.lint_accumulation` |
| Resistance checks with power **disconnected** | Safety + accurate ohms | measurement field guidance |
| VOM sensitivity ≥ 20,000 Ω/V DC | Accurate control-board readings | — |
| ESD precautions on electronic controls | Intermittent CCU/UI failures | `motor_electrical.board_notes` |
| Harness fully seated; no damaged pins | Root cause before board swap | visual + board notes |
| Door fully closed for motor/heat tests | Door switch blocks start/heat | **new field proposed** `functional_checks.door_closed` |

**Quick diagnostic concept (any brand with service mode):** Motor, heater(s), inlet/exhaust thermistors, airflow (AF), low line voltage (L2). Stops on first fault. Door must be closed.

---

## 2. Complaint → cause routing (troubleshooting guide)

General symptom matrix distilled from manual. Use to validate chip coverage and evidence routing.

| Symptom cluster | Likely causes (priority order) | Primary tests / checks | Current chips | Gap |
|-----------------|--------------------------------|------------------------|---------------|-----|
| **Will not power up** — no LEDs, no keypad | Outlet/CB/fuse; cord→terminal; CCU↔UI harness; CCU power (+5/+12 VDC); UI failure | Supply voltage; TEST #1 CCU power; TEST #2 supply connections; TEST #6 UI | `no_power` | Partial — add UI/CCU branch fields |
| **Will not start cycle** — Start does nothing | Door not latched; door switch; belt/belt switch; thermal fuse (elec); motor circuit; UI; CCU | Door switch TEST #7; motor TEST #3; thermal fuse TEST #4b | `no_power`, `no_spin` | **Missing chip:** `wont_start` (distinct from dead) |
| **Will not shut off when expected** | Poor airflow; Pause/Cancel stuck; moisture sensor; thermistor; UI; CCU | Vent/lint; TEST #5 moisture; TEST #4a thermistors | `wont_stop_spinning` | Add airflow + sensor path to `wont_stop_spinning` routing |
| **Console won't accept selections** | Invalid customer option; UI failure | Use & care vs TEST #6 | — | Low priority chip |
| **Drum will not spin** | Belt/belt switch; thermal fuse (elec only); door switch; motor; CCU | TEST #3 motor; TEST #7 door; TEST #4b fuse | `no_spin` | Covered — enrich belt switch |
| **Will not heat** | Install/L1-L2; heater open; gas valve/ignitor (gas); thermal cut-off; high-limit; CCU relay | TEST #4 heat; supply diagnostics | `no_heat` | Add cut-off, relay, ignitor branches |
| **Heats on AIR / no-heat cycle** | Shorted heater coil; stuck heater relay; heat system fault | TEST #4 heat-shutoff branch | — | **New chip candidate:** `heats_when_shouldnt` |
| **Shuts off before clothes dry** | Auto dryness setting; lint; vent; moisture sensor; customer dryness calibration | TEST #5; TEST #5a dryness level | `not_drying` | Strong moisture-sensor evidence path |
| **Water/steam valve not dispensing** | Wrong cycle; no water supply; myst valve; harness; CCU | TEST #9 | — | Steam models only — optional chip `steam_no_water` |

---

## 3. Error codes (full table + Solomon mapping)

### 3.1 Customer-visible codes

| Code | Meaning | Recommended procedure | General category | DMA seed status |
|------|---------|----------------------|------------------|-----------------|
| Power Failure / Interruption | Power lost mid-cycle | Press START to continue or POWER to clear | Power / customer | Add generic |
| Restricted Air Flow | Low airflow affecting performance | Lint screen, duct, fan; see F4E3 | `vent` / airflow | Partial (F4E3 exists) |
| Low Line Voltage | L2 &lt; 30 V at control | See F4E4 | `supply` | L2 exists |

### 3.2 Service fault codes

| Code | Meaning | Threshold / note | Test ref | Suspect components | DMA seed |
|------|---------|------------------|----------|-------------------|----------|
| **F1E1** | CCU / main control problem | — | TEST #1 | `ccu` | Washer entry only — **add dryer-specific** |
| **F2E1** | UI stuck button (&gt;20 s) or UI mismatch | Service mode only | TEST #6 | `user_interface` | Washer F2E1 — **add dryer** |
| **F2E2** | UI software error 1 (EEPROM read) | — | Replace UI | `user_interface` | **Missing** |
| **F2E3** | UI software error 2 (EEPROM not programmed) | — | Replace UI | `user_interface` | **Missing** |
| **F3E1** | Exhaust thermistor open | Temp &lt; 18°F (&gt;50 kΩ) | TEST #4a | `exhaust_thermistor` | Exists (generic) — **enrich** |
| **F3E2** | Exhaust thermistor shorted | Temp &gt; 250°F (&lt;500 Ω) | TEST #4a | `exhaust_thermistor` | **Missing** |
| **F3E3** | Inlet thermistor open | Temp &lt; 18°F (&gt;245 kΩ) | TEST #4a | `inlet_thermistor` | **Missing** |
| **F3E4** | Inlet thermistor shorted | Temp &gt; 391°F (&lt;328 Ω) | TEST #4a | `inlet_thermistor` | **Missing** |
| **F3E5** | Inlet + exhaust thermistor open | P14 unplugged at CCU | Harness | `thermistor_harness` | **Missing** |
| **F3E6** | Moisture sensor open | Service mode only | TEST #5 | `moisture_sensor` | **Missing** |
| **F3E7** | Moisture sensor shorted | Service mode only | TEST #5 | `moisture_sensor` | **Missing** |
| **F4E1** | Heater relay / connector (no voltage at relay) | Service mode only | Check heater wires + CCU relays | `heater_relay`, `heating_element` | **Missing** |
| **F4E3** | Restricted airflow | — | Lint, duct, fan; TEST #4a | `vent` | Exists |
| **F4E4** | L2 line voltage error | L2 &lt; 30 V | Breaker, cord, CCU relays; gas: P14 loopback pins 4–5 | `supply` | Map to L2 alias |
| **F6E1** | UI→CCU comm error | — | Harness, TEST #1, replace UI/CCU | `ccu`, `user_interface` | **Missing** |
| **F6E2** | CCU→UI comm error | — | Replace UI then CCU | `ccu`, `user_interface` | **Missing** |

**Error-code chip routing:** When `error_code` chip + `customer_complaint.error_codes` populated, auto-suggest category boosts per table above.

---

## 4. Measurement specifications (knowledge base)

Values below are from manual test procedures. Proposed knowledge IDs for Solomon smart measurements.

### 4.1 Supply voltage

| Parameter | Electric | Gas |
|-----------|----------|-----|
| Nominal | 240 VAC (200–260), 208 VAC (176–229) | 120 VAC (100–130) |
| Service | 30 A | 15 A |
| Frequency | 58–62 Hz | 58–62 Hz |
| CCU L1 at P9-2 vs P8-3 (N) | 120 VAC | 120 VAC |
| L2 low fault | &lt; 30 V at CCU | N/A (gas uses 120) |

Existing: `supplyVoltage240`, `supplyVoltage120`. **Add field help:** F4E4 triggers below 30 V on L2 leg, not just nominal range.

### 4.2 Control board power (TEST #1)

| Point | Expected |
|-------|----------|
| CCU +5 VDC (P2-1 vs P2-3) | Present; if missing with P14 unplugged → shorted thermistor (TEST #4a) |
| CCU +12 VDC (P5-8 vs P5-3) | Present; missing → replace CCU |

**Proposed knowledge ID:** `dryerCcu5vdc` (presence check, boolean workflow).

### 4.3 Drum motor windings (TEST #3)

| Winding | Resistance (Ω) | Measurement points |
|---------|----------------|-------------------|
| MAIN | 3.3–3.6 | Lt blue @ pin 4 + bare copper off pin 5 |
| START | 2.7–3.0 | Lt blue @ pin 4 + bare copper on pin 3 |

**Motor circuit quick check:** P8-4 to P9-1 = **1–6 Ω** → motor circuit OK, suspect CCU if still won't run.

**Update `dryerDrumMotorWindingOhms`:** Split main vs start or use combined range 2.7–3.6 Ω per winding; current 1–10 Ω is loose.

### 4.4 Belt switch (TEST #3)

- Resistance across two light blue wires: **open → few Ω** when pulley pushed up.
- Open circuit with good belt switch → harness.

**Proposed field:** `motor_electrical.belt_switch` (yn: opens/closes correctly).

### 4.5 Door switch (TEST #3 quick / TEST #7)

- P8-3 (N) to P8-4 (door): **0–2 Ω** door closed.

**Proposed field:** `functional_checks.door_switch` (yn).

### 4.6 Electric heater (TEST #4)

| Check | Expected |
|-------|----------|
| Heater relay #1 violet to relay #2 violet | ≤ 50 Ω (both elements) |
| Each element violet to center red | Continuity |
| P9-2 (L1) to heater relay #1 black | Continuity through thermal cut-off |
| P9-2 (L1) to heater relay #2 black | Continuity through thermal cut-off |
| High-limit thermostat | Continuity; open → replace **high-limit + thermal cut-off** |
| Outlet thermistor P14-3 to P14-6 | 5–15 kΩ at room; &lt;1 kΩ → replace; open → repair |
| Heater relay voltage (AIR cycle, no heat) | ~0 VAC = relay OK; ~240 VAC = stuck relay → replace CCU |

Existing `electricDryerHeatingElementOhms` normal 8–15 Ω — manual uses **≤50 Ω** across both elements in parallel. **Reconcile:** single element ~20 Ω; dual ~10–25 Ω parallel.

### 4.7 Gas heat (TEST #4d)

| Component | Resistance |
|-----------|------------|
| Gas valve coil 1–2 | 1400 ± 70 Ω |
| Gas valve coil 1–3 | 570 ± 28.5 Ω |
| Gas valve coil 4–5 | 1300 ± 65 Ω |
| Ignitor (2-pin) | 50–500 Ω |
| Flame sensor | Continuity when good |

Existing `gasValveCoilOhms` 900–1600 — manual gives **1400/570/1300** per coil pair. **Split** into high/low coil knowledge IDs or widen warning band.

**Ignitor:** `hotSurfaceIgniterOhms` normal 40–400 — manual **50–500 Ω** aligns.

**Flame sensor:** Continuity test — **proposed field** `gas_ignition.flame_sensor_continuity`.

### 4.8 Thermistors (TEST #4a)

**Outlet (exhaust) — P14-3 to P14-6**

| Temp °F (°C) | kΩ |
|--------------|-----|
| 50 (10) | 19.0–22.0 |
| 60 (16) | 14.8–16.8 |
| 70 (21) | 11.5–13.5 |
| 80 (27) | 8.5–10.5 |
| 90 (32) | 6.8–8.8 |
| 100 (38) | 5.0–7.0 |

Fault thresholds: open &gt;50 kΩ (&lt;18°F); short &lt;500 Ω (&gt;250°F).  
Room check: **5–15 kΩ** acceptable band on connector.

**Electric inlet — P14-1 to P14-2**

| Temp °F | kΩ |
|---------|-----|
| 68 (20) | 61.2–63.7 |
| 77 (25) | 49.0–51.0 |
| 86 (30) | 39.5–41.1 |
| 95 (35) | 32.0–33.3 |
| 104 (40) | 26.1–27.2 |
| 113 (45) | 21.4–22.3 |
| 122 (50) | 17.6–18.5 |
| 131 (55) | 14.5–15.3 |
| 140 (60) | 12.1–12.8 |
| 149 (65) | 10.2–10.7 |
| 158 (70) | 8.5–9.0 |
| 167 (75) | 7.2–7.6 |
| 176 (80) | 6.1–6.5 |

**Gas inlet — P14-1 to P14-2** (different curve)

| Temp °F | kΩ |
|---------|-----|
| 68 (20) | 57.5–67.6 |
| 77 (25) | 46.1–53.8 |
| 86 (30) | 37.4–43.1 |
| 95 (35) | 30.4–34.7 |
| 104 (40) | 24.9–28.2 |
| 113 (45) | 20.5–23.0 |
| 122 (50) | 16.9–18.9 |
| (same high-temp rows as electric) | |

Open: &gt;245 kΩ; short: &lt;328 Ω (&gt;391°F).

**Proposed knowledge IDs:** `dryerExhaustThermistorOhms`, `dryerInletThermistorOhmsElectric`, `dryerInletThermistorOhmsGas`.

### 4.9 Exhaust temperature targets (timed dry, vent disconnected, empty drum, EcoBoost off)

| Setting | Heat OFF °F (°C) | Heat ON (below OFF) |
|---------|------------------|---------------------|
| High | 155 ± 5 (68 ± 3) | 10–15°F (6–8°C) lower |
| Medium High | 150 ± 5 (65 ± 3) | |
| Medium | 140 ± 5 (60 ± 3) | |
| Low | 125 ± 5 (52 ± 3) | |
| Extra Low | 105 ± 5 (41 ± 3) | |

Should reach setpoint within **~7 minutes**; if not → voltage + vent blockage.

Maps to `heat_circuit.exhaust_temp` / `motor_electrical.exhaust_temp` — **add smart measurement** `dryerExhaustAirTemp`.

### 4.10 Thermal fuse (TEST #4b)

- **Electric:** In series with drive motor.
- **Gas:** In series with gas valve.
- Open → replace fuse; **always investigate vent restriction** (especially after cut-off trip).

Existing `dryerThermalFuseOhms` — OK.

### 4.11 Thermal cut-off (TEST #4c)

- Open → replace **thermal cut-off AND high-limit thermostat** together.
- Check vent restriction and (electric) heater malfunction.

**Proposed component:** `thermal_cutoff` (distinct from `thermal_fuse`).

### 4.12 Moisture sensor (TEST #5)

- Touch both strips → status open→closed in service mode.
- Harness P13 to sensor: continuity.
- Outer contacts + MOV: small R if dirty strips (clean first).
- Outer to center (ground): must be infinite.
- Auto cycle max **2.5 hours** then shutdown.
- Overdrying: short in sensor system.

**Proposed fields:** `functional_checks.moisture_sensor_status` (open/closed toggles), `heat_circuit.moisture_sensor_harness_ohms`.

### 4.13 Myst / steam valve (TEST #9)

- Coil P8-1 to P9-2: **510–590 Ω**.
- Water pressure: 20–120 PSI (spec).

Optional steam-only checklist fields.

### 4.14 Drum light (TEST #8)

- LED current P13 pins 1–3: **150–370 mA** when driven.

Low priority for Solomon unless steam/console chip added.

---

## 5. System architecture (strip circuits — generalized)

Understanding for evidence graph, not brand wiring.

### 5.1 Motor circuit (all dryers)

```
L1 → CCU motor relay → drive motor (main 3.3–3.6 Ω, start 2.7–3.0 Ω)
                    → centrifugal switch (heat enable)
                    → belt switch
                    → door switch (in path)
Electric only: thermal fuse in series with motor
```

### 5.2 Electric heat circuit

```
L1 → heater relay 1 → thermal cut-off → high-limit → element 1 (~20 Ω)
L2 → heater relay 2 → centrifugal → element 2
Outlet thermistor feedback to CCU
Inlet thermistor on high-limit assembly (electric)
```

### 5.3 Gas heat circuit

```
L1 → heater relay → thermal cut-off → high-limit → gas valve coils (1400/570/1300 Ω)
                  → ignitor (50–500 Ω) → flame sensor
Thermal fuse in series with gas valve
Inlet thermistor at drum inlet (gas)
```

### 5.4 Airflow detection

- Inlet + outlet thermistor delta used for AF (restricted airflow) and load sizing.
- F4E3 / Restricted Air Flow = vent path, not just thermistor.

### 5.5 Moisture sensor

- Two metal strips → CCU via P13; MOVs on harness.
- Affects auto-cycle termination; ties to `not_drying` and `wont_stop_spinning`.

---

## 6. Test procedure index (for field help text)

| Test | When to use | Key outcome |
|------|-------------|-------------|
| #1 CCU power | Dead UI, random CCU faults | +5 VDC, +12 VDC, 120 VAC at CCU |
| #2 Supply connections | Power at outlet but not CCU | Cord, terminal block, harness continuity |
| #3 Motor circuit | No tumble, won't start | Belt, door, 1–6 Ω motor path, windings |
| #4 Heat system | No heat, won't stop heating | Elements, cut-off, high-limit, relays, gas valve |
| #4a Thermistors | Temp errors F3Ex, wrong temps | kΩ tables, exhaust temp verify |
| #4b Thermal fuse | No heat (gas valve) / no motor (elec) | Continuity |
| #4c Thermal cut-off | No heat | Replace with high-limit |
| #4d Gas valve | Gas no heat | Coil + ignitor + flame sensor |
| #5 Moisture sensor | Early stop, long auto cycles | Strip touch test, harness |
| #5a Dryness level | Damp clothes, sensor OK | Customer calibration +15/30% |
| #6 Buttons/UI | Stuck keys, dead display | Replace UI assembly |
| #7 Door switch | Won't start, door status wrong | 0–2 Ω closed |
| #8 Drum light | Light inop | LED current 150–370 mA |
| #9 Myst valve | Steam no water | 510–590 Ω coil |

---

## 7. Gap analysis vs current Solomon templates

### 7.1 Complaint chips

| Manual symptom | Current chip | Action |
|----------------|--------------|--------|
| No heat | `no_heat` | OK |
| Long dry / damp | `not_drying` | OK — strengthen moisture + thermistor |
| No tumble | `no_spin` | OK — add belt switch |
| Won't stop | `wont_stop_spinning` | Add moisture/thermistor/UI routes |
| Dead | `no_power` | OK |
| Error display | `error_code` | Expand DMA + auto-routing |
| Gas smell | `gas_smell` (gas only) | OK |
| Weak flame | `weak_flame` | Tie to flame sensor + valve |
| Heats on air cycle | — | **Add** `heats_when_shouldnt` |
| Won't start (has power) | overlaps `no_power`/`no_spin` | **Add** `wont_start` or disambiguate in guidance |
| Steam/water | — | Optional `steam_no_water` |

### 7.2 Components in evidence graph

| Component ID | In inventory? | Notes |
|--------------|---------------|-------|
| `heating_element` | Yes | Refine ohm ranges |
| `thermal_fuse` | Yes | Elec=motor, gas=valve — document in help |
| `cycling_thermostat` | Yes | High-limit related |
| `vent` | Yes | F4E3 primary |
| `motor` | Yes | Winding specs |
| `supply` | Yes | L2 &lt;30 V |
| `igniter` | Gas yes | 50–500 Ω |
| `gas_valve` | Gas yes | Multi-coil ohms |
| `exhaust_thermistor` | **No** | Add |
| `inlet_thermistor` | **No** | Add |
| `moisture_sensor` | Partial (functional only) | Add component + rules |
| `thermal_cutoff` | **No** | Add (pair with high-limit) |
| `heater_relay` | **No** | Add for F4E1, heats-on-air |
| `belt_switch` | **No** | Add |
| `door_switch` | **No** | Add |
| `flame_sensor` | **No** | Add (gas) |
| `ccu` / `user_interface` | **No** | Add for error codes F1/F2/F6 |

### 7.3 Measurements

| Knowledge ID | Status |
|--------------|--------|
| `electricDryerHeatingElementOhms` | Refine |
| `dryerDrumMotorWindingOhms` | Tighten to 2.7–3.6 per winding |
| `dryerThermalFuseOhms` | OK |
| `dryerCyclingThermostatOhms` | OK |
| `supplyVoltage240` / `supplyVoltage120` | Add L2 &lt;30 V note |
| `hotSurfaceIgniterOhms` | Align 50–500 |
| `gasValveCoilOhms` | Split high/low coils |
| `dryerExhaustThermistorOhms` | **New** |
| `dryerInletThermistorOhms` | **New** (elec vs gas curves) |
| `dryerExhaustAirTemp` | **New** |
| `dryerMotorCircuitOhms` | **New** (P8-4 to P9-1, 1–6 Ω) |

---

## 8. Proposed wizard fields (draft)

| Field path | Type | Label | Visibility |
|------------|------|-------|------------|
| `functional_checks.door_switch` | yn | Door switch closes (0–2 Ω) | `no_power`, `no_spin`, `wont_stop_spinning` |
| `functional_checks.door_closed` | yn | Door fully latched | start complaints |
| `functional_checks.centrifugal_switch` | yn | Centrifugal switch closes at speed | `no_heat`, gas ignition |
| `motor_electrical.belt_switch` | yn | Belt switch toggles with pulley | `no_spin` |
| `motor_electrical.motor_circuit_ohms` | text | Motor circuit Ω (neutral to motor) | `no_spin` — bind `dryerMotorCircuitOhms` |
| `heat_circuit.thermal_cutoff` | text | Thermal cut-off continuity | `no_heat` |
| `heat_circuit.outlet_thermistor_ohms` | text | Exhaust thermistor kΩ | `not_drying`, `error_code` |
| `heat_circuit.inlet_thermistor_ohms` | text | Inlet thermistor kΩ | `not_drying`, `error_code` |
| `gas_ignition.flame_sensor` | yn | Flame sensor continuity | `no_heat`, `weak_flame` |
| `customer_complaint.error_codes` | text | *(exists)* | Enhance with F-code parser hints |

---

## 9. Field guidance drafts (technician copy)

### `commonly_missed.lint_trap`
Clean lint screen before heat/airflow tests. A full screen is the #1 cause of long dry times and trips thermal cut-off/fuse. Recheck exterior hood airflow.

### `commonly_missed.vent_restriction`
Restricted vent causes F4E3 / Restricted Air Flow, high exhaust temps, and blown thermal cut-off. Verify run length, elbows, and exterior flap opens. Timed dry exhaust temp should reach setpoint in ~7 minutes with vent disconnected for test.

### `functional_checks.heating`
On electric: both L1 and L2 must be present at control. On gas: ignitor should glow 50–500 Ω cold; valve coils 1400/570/1300 Ω. No heat with good ignitor glow but no flame → flame sensor or valve.

### `functional_checks.airflow`
Weak airflow at hood with clean lint screen → duct restriction. Inlet/outlet thermistor delta abnormal → same root cause before replacing sensors.

### `heat_circuit.thermal_fuse`
Electric: fuse in motor circuit — open fuse stops drum and heat. Gas: fuse in gas valve circuit — drum may run but no heat. Always find why it blew (vent, element short).

### `motor_electrical.motor_ohms`
Main winding 3.3–3.6 Ω, start 2.7–3.0 Ω at motor. Much higher start Ω → replace motor. Motor circuit 1–6 Ω from door neutral to motor relay suggests wiring/motor OK → suspect CCU.

### `customer_complaint.error_codes`
F3E1/F3E2 = exhaust thermistor; F3E3/F3E4 = inlet; F4E3 = vent; F4E4/L2 = supply leg; F3E6/F3E7 = moisture sensor; F4E1 = heater relay.

---

## 10. Evidence rule drafts (review before merge)

Weights follow existing pattern: single-signal confirm +35–38 category; multi-signal +25–28. **Do not ship weights without field tuning.**

### Airflow / vent

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `ed_man_001_f4e3_vent` | field:error_codes contains F4E3 OR F4E3 | `vent` | confirm |
| `ed_man_002_restricted_airflow_chip` | chip:not_drying AND field:commonly_missed.vent_restriction=checked | `vent` | +25 category |
| `ed_man_003_exhaust_temp_low` | measurement:dryerExhaustAirTemp in critical AND chip:not_drying | `vent` | confirm |
| `gd_man_001_f4e3_vent` | (same, gas template) | `vent` | confirm |

### Thermistors

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `ed_man_010_f3e1_exhaust` | error F3E1 | `exhaust_thermistor` | confirm |
| `ed_man_011_f3e2_exhaust_short` | error F3E2 | `exhaust_thermistor` | confirm |
| `ed_man_012_inlet_thermistor_open` | error F3E3 OR F3E5 | `inlet_thermistor` | confirm |
| `ed_man_013_outlet_kohm_low` | field:heat_circuit.outlet_thermistor_ohms &lt;1 kΩ | `exhaust_thermistor` | confirm |
| `ed_man_014_inlet_outlet_mismatch` | chip:not_drying AND field:functional_checks.airflow=bad | `inlet_thermistor` | +18 suspect |

### Moisture sensor

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `ed_man_020_f3e6_moisture` | error F3E6 OR F3E7 | `moisture_sensor` | confirm |
| `ed_man_021_moisture_bad` | chip:not_drying AND field:functional_checks.moisture_sensor=bad | `moisture_sensor` | confirm |
| `ed_man_022_moisture_wont_stop` | chip:wont_stop_spinning AND field:functional_checks.moisture_sensor=bad | `moisture_sensor` | confirm |
| `ed_man_023_auto_long_dry` | chip:not_drying AND field:functional_checks.heating=yes AND field:functional_checks.airflow=good | `moisture_sensor` | +22 suspect |

### Motor / door / belt

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `ed_man_030_door_switch_no` | field:functional_checks.door_switch=no | `door_switch` | confirm |
| `ed_man_031_belt_switch_no` | chip:no_spin AND field:motor_electrical.belt_switch=no | `belt_switch` | confirm |
| `ed_man_032_motor_circuit_ok_ccu` | measurement:dryerMotorCircuitOhms in normal AND chip:no_spin | `ccu` | +20 suspect |
| `ed_man_033_start_winding_high` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | confirm |

### Heat circuit

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `ed_man_040_cutoff_open` | field:heat_circuit.thermal_cutoff=open | `thermal_cutoff` | confirm |
| `ed_man_041_fuse_and_lint` | measurement:dryerThermalFuseOhms critical AND lint bad | `vent` | +25 category |
| `ed_man_042_heater_relay_f4e1` | error F4E1 | `heater_relay` | confirm |
| `ed_man_043_l2_f4e4` | error F4E4 OR L2 | `supply` | confirm |
| `ed_ms_015_not_drying_moisture_airflow` | chip:not_drying AND moisture bad AND airflow bad | `vent` | +28 |

### Gas ignition

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `gd_man_010_ignitor_range` | measurement:hotSurfaceIgniterOhms in critical | `igniter` | confirm |
| `gd_man_011_flame_sensor` | field:gas_ignition.flame_sensor=no AND field:functional_checks.ignition=no | `flame_sensor` | confirm |
| `gd_man_012_glow_no_fire` | field:functional_checks.ignition=no AND igniter ohms normal | `flame_sensor` | confirm |
| `gd_man_013_valve_coil_mismatch` | measurement:gasValveCoilOhms in critical | `gas_valve` | confirm |
| `gd_man_014_thermal_fuse_gas` | measurement:dryerThermalFuseOhms critical AND chip:no_heat | `thermal_fuse` | confirm |

### Control / UI

| Rule ID | When | Target | Effect |
|---------|------|--------|--------|
| `ed_man_050_f2e1_ui` | error F2E1 | `user_interface` | confirm |
| `ed_man_051_f6_comm` | error F6E1 OR F6E2 | `ccu` | +22 suspect |
| `ed_man_052_f1e1_ccu` | error F1E1 | `ccu` | confirm |

**Total drafts:** 30 rules above + 14 existing multi-signal = room for phased merge.

---

## 11. DMA error code seed additions (dryer-specific)

Add or enrich under `equipment_subtype: "dryer"` (manufacturer Whirlpool + generic aliases):

```json
[
  {"code": "F2 E2", "meaning": "UI software error (EEPROM read)", "recommended_fix": "Verify CCU-UI connections; replace UI"},
  {"code": "F2 E3", "meaning": "UI software error (not programmed)", "recommended_fix": "Replace UI"},
  {"code": "F3 E2", "meaning": "Exhaust thermistor shorted", "common_causes": ">250°F or <500 Ω", "recommended_fix": "TEST #4a; replace outlet thermistor"},
  {"code": "F3 E3", "meaning": "Inlet thermistor open", "recommended_fix": "TEST #4a; replace inlet thermistor"},
  {"code": "F3 E4", "meaning": "Inlet thermistor shorted", "recommended_fix": "TEST #4a; replace inlet thermistor"},
  {"code": "F3 E5", "meaning": "Inlet and exhaust thermistor open", "common_causes": "Thermistor harness P14 unplugged", "recommended_fix": "Reseat P14; check harness"},
  {"code": "F3 E6", "meaning": "Moisture sensor open", "recommended_fix": "TEST #5 moisture sensor"},
  {"code": "F3 E7", "meaning": "Moisture sensor shorted", "recommended_fix": "TEST #5; check harness and strips"},
  {"code": "F4 E1", "meaning": "Heater relay or connector fault", "recommended_fix": "Check heater wiring and CCU relays"},
  {"code": "F4 E4", "meaning": "L2 line voltage low (<30 V)", "recommended_fix": "Breaker, cord, terminal block, CCU relay"},
  {"code": "F6 E1", "meaning": "UI to CCU communication error", "recommended_fix": "Harness, TEST #1, replace UI/CCU"},
  {"code": "F6 E2", "meaning": "CCU to UI communication error", "recommended_fix": "Replace UI then CCU"},
  {"code": "AF", "meaning": "Restricted airflow (customer)", "recommended_fix": "Clean lint screen and exhaust duct"}
]
```

Enrich existing F3E1: "Exhaust thermistor open — temp <18°F, >50 kΩ".

---

## 12. Disassembly access map (for recommendation text)

| Component | Access |
|-----------|--------|
| UI, CCU, inlet thermistor (gas) | Top panel |
| Heater, thermal cut-off, high-limit, inlet thermistor (electric) | Rear panel |
| Motor, belt switch, thermal fuse, outlet thermistor, moisture strips | Front panel + bulkhead |
| Gas valve, ignitor, flame sensor | Rear panel (gas) |
| Myst valve | Rear + console |

Use in `diagnosis.recommended_repair` snippets: "Remove front bulkhead for thermal fuse / moisture sensor."

---

## 13. Implementation phases (recommended)

1. **Phase A — Knowledge only:** DMA seed + field guidance + measurement threshold updates (low risk).
2. **Phase B — Fields:** Door switch, belt switch, thermistor ohms, thermal cut-off, flame sensor.
3. **Phase C — Evidence:** Merge rules in batches of 8–10; tune weights on completed jobs.
4. **Phase D — Chips:** `heats_when_shouldnt`, optional `wont_start`, steam if product supports.

---

## 14. Source fidelity notes

- PDF filename on disk is `whirlpool-electric-gas-dryers.pdf.pdf` (double extension).
- Pages 25–26 wiring diagrams are image-only in extraction; strip circuits page 22 captured text.
- Page 2 control panel figure is garbled (rotated text); skipped for knowledge.
- Part numbers (DPAOR NTO…) on page 1 are manual metadata, not model-specific parts.

---

*Generated from manual extraction session. Regenerate text with `backend/docs/manuals/extract_pdf.py` if the PDF is updated.*
