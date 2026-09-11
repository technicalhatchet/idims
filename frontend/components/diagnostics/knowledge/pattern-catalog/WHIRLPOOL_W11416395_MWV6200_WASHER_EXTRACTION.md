# Maytag/Whirlpool 4.8 cu ft PSC top-load washer — W11416395 extraction

**Source:** `backend/docs/manuals/service-manual-w11416395-revb mvw6200.pdf` (W11416395B)  
**Extracted text:** `backend/docs/manuals/service-manual-w11416395-revb mvw6200-extracted.txt`  
**Scope:** Maytag 4.8 cu ft top-load; rotary-knob HMI; PSC motor + run capacitor; splutch shifter; integrated ACU pressure transducer  
**Models:** MVW6200* (6XXX = 4.7–4.8 cu ft), Whirlpool WTW62* equivalents  
**Platform:** `whirlpool_mvw6200` — **not** `whirlpool_tl_dd` (BPM direct-drive W10864849; different pinouts and Ω specs)  
**Status:** batch18 measurements, 10 TEST procedures + 2 service-mode bundles

Cross-reference: [WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md) (6.2 cu ft BPM DD — do not reuse J-connector or Ω values).

---

## 1. Pre-service checklist

| Check | Solomon field / chip |
|-------|---------------------|
| 120 VAC dedicated circuit | `motor_electrical.supply_voltage` |
| Hot and cold supply on; screens clear | field help on fill |
| HE detergent only | `commonly_missed.he_detergent` |
| Drain hose height 39"–8' (991 mm–2.4 m) | `functional_checks.drain_install` |
| Lid closed/locked for agitate/spin | `functional_checks.lid_lock_operation` |
| ESD wrist strap on ACU work | procedure safety notes |

---

## 2. Service modes (pp. 11–16)

| Mode | Entry |
|------|-------|
| **Service Diagnostic** | Standby → press Key 1, Key 2, Key 3 within 8 sec → repeat sequence **2 more times** (3 rounds). Success: all indicators on 1 sec then off; saved fault codes flash if present. |
| **Button Activation & Encoder Test** | In Service Diagnostic: press **Key 1** (encoder + button toggle test) |
| **Service Test Mode** | In Service Diagnostic: press **Key 2**, then press **START** — all LEDs on |
| **Fault code scroll** | In Service Diagnostic: press **Key 3** repeatedly (binary LED display) |
| **Clear fault codes** | Hold **Key 3** 5 sec |
| **Software version** | Hold **Key 2** 5 sec — ACU/HMI/settings file in binary on status LEDs |
| **Exit** | Hold **Key 1** 5 sec, or POWER |

Service Test auto-sequence (p. 14): water valves → drain pump → wash (agitate CW/CCW) → spin (140/300/500 rpm) → end. Key 1 repeats prior step; Key 2 skips.

Sensor Feedback (referenced in tests): Inlet Thermistor, Water Level Pressure Sensor, Motor Speed Tachometer, Lid Lock (Load Control).

---

## 3. Error codes (F#E#)

| Code | Meaning | First test |
|------|---------|------------|
| F0E2 | Oversuds | HE detergent; pressure hose; mechanical friction |
| F0E3 | Overload | Reduce load; basket friction |
| F0E4 | Spin limited by water temp | TEST #2 Valves |
| F0E5 / F0E9 | Off-balance | Suspension; load distribution |
| F0E7 | Load in Clean Washer cycle | Remove load |
| F0E8 | Water ring | Drain & Spin |
| **F1E1** | Main control fault | TEST #1 ACU |
| **F2E1** | HMI stuck button | TEST #4 HMI |
| **F2E2** | HMI disconnected | TEST #4 HMI |
| **F3E2** | Pressure system fault | TEST #6 Water Level |
| **F3E3** | Inlet thermistor fault | TEST #5 Thermistor |
| **F5E1** | Lid switch fault (lid open while locked) | TEST #8 Lid Lock |
| **F5E3** | Lid lock will not unlock | TEST #8 Lid Lock |
| (unnamed) | Lid lock will not lock | TEST #8 Lid Lock |
| **F5E4** | Lid not opened between cycles | TEST #8 Lid Lock |
| **F6E1** | HMI cannot hear ACU | TEST #1, #4 |
| **F7E1** | Tach missing/wrong signal | TEST #1; Sensor Feedback tach |
| **F7E3** | Basket engaged during wash | TEST #3a Shifter |
| **F7E4** | Basket re-engagement failure | TEST #3a Shifter |
| **F7E6** | Motor circuit open | TEST #3 / #3b |
| **F7E7** | Motor unable to reach RPM | TEST #3b Motor |
| LF / **F8E1** | Long fill | TEST #2, #6 |
| **F8E3** | Overflow / flood | TEST #2, #6 |
| F8E6 | Water hazard | TEST #2, #6, #8 |
| dr / **F9E1** | Long drain | TEST #7 Drain Pump |

**Bold** = primary procedure routing tags in seeds.

---

## 4. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't power | Outlet; cord J1; ACU LED; HMI J5; TEST #1, #4 |
| Won't start | Lid lock; START; TEST #8, #4 |
| Won't fill | Supply; screens; valves; TEST #2, #6 |
| Won't drain | Hose height; obstructions; pump J6; TEST #7 |
| Won't agitate/spin | Water level; lid lock; shifter; motor/cap; TEST #6, #8, #3a, #3b |
| Wrong temp | Hoses; thermistor J8; valves; TEST #5, #2 |
| Leaking / overfill | Pressure hose; valves; calibration; TEST #6, #2 |

---

## 5. TEST index (Section 3, pp. 25–29)

| OEM | Procedure ID | Component focus | Key Ω / specs |
|-----|--------------|-----------------|---------------|
| #1 | `w11416395-test-01-acu-power` | ACU supply, diagnostic LED | 120 VAC J1-1↔J1-2; +12 VDC J5-1↔J5-4 |
| #2 | `w11416395-test-02-valves` | Inlet valves J8 | **890–1090 Ω** (J8-1 common to coil pin) |
| #3 | `w11416395-test-03-drive-system` | Drive pre-test | Service Test wash/spin sequence |
| #3a | `w11416395-test-03a-shifter` | Shifter J6-2↔6, switch J2-1 | **2–3.5 kΩ** shifter; 0/+5 VDC shifter status |
| #3b | `w11416395-test-03b-motor` | PSC motor J6 | **5–9.5 Ω** CW J6-4↔6, CCW J6-1↔6; run capacitor |
| #4 | `w11416395-test-04-hmi` | HMI J5 | Harness J5↔HMI J1 continuity |
| #5 | `w11416395-test-05-temp-thermistor` | Inlet NTC J8-8↔9 | R/T table (50 kΩ @ 77°F / 25°C) |
| #6 | `w11416395-test-06-water-level` | Pressure transducer hose | Sensor Feedback water level cycle |
| #7 | `w11416395-test-07-drain-pump` | Drain pump J6-3↔6 | **17.8–21.8 Ω** |
| #8 | `w11416395-test-08-lid-lock` | Lid lock J4 | Solenoid **50–160 Ω** J4-2↔3; switch states |

**Deferred v1:** diagram crops (ACU pinout p. 24); motor run capacitor µF bench spec (charge/discharge ohms only in manual).

---

## 6. ACU connector pinout (Figure 4–5, p. 24)

| Conn | Function |
|------|----------|
| J1 | Power cord Line/Neutral |
| J5 | HMI (+12V, 5V, WIN_DATA, AGND) |
| J2 | Tach / shifter status |
| J4 | Lid lock |
| J6 | PSC motor, shifter, drain pump |
| J8 | Valves & inlet thermistor |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11416395
cd frontend && npx tsc --noEmit
```

**WO smoke:** Maytag MVW6200KW → `whirlpool_mvw6200`; F5E3 → `w11416395-test-08-lid-lock`.
