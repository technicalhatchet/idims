# Whirlpool/Maytag Multimedia Enhanced PSC top-load washer — W11428632 extraction

**Source:** `backend/docs/manuals/technical-manual-w11428632-revC.pdf` (W11428632C)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11428632-revC-extracted.txt`  
**Scope:** Whirlpool Multimedia Enhanced top-load; LCD HMI; PSC motor + run capacitor; splutch shifter; integrated ACU pressure transducer  
**Models:** WTW/MVW with 4-digit feature set 4616–8500 (e.g. WTW5057LW, MVW6230HW)  
**Platform:** `whirlpool_tl_psc_washer` — **not** `whirlpool_tl_dd` (BPM direct-drive) or `whirlpool_mvw6200` (4.8 cu ft MVW6200 routing)  
**Status:** batch18 measurements (shared PSC specs with MVW6200), 9 TEST procedures (+3a/3b) + 2 service-mode bundles

Cross-reference: [WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md](./WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md) (same J-connector architecture and Ω specs). [WHIRLPOOL_W11455152_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W11455152_TL_WASHER_EXTRACTION.md) (WTW6157 class — same TEST #1–7 layout, no inlet thermistor test).

---

## Platform choice rationale

| Factor | W11428632 | W10864849 (`whirlpool_tl_dd`) |
|--------|-----------|-------------------------------|
| Motor | PSC + run capacitor, J6 5–9.5 Ω | BPM MCU, J2 8–10 Ω |
| HMI | J5 (+12 VDC) | J5 (+12 VDC) different harness |
| Valves | J8 890–1090 Ω | J2 790–840 Ω |
| Shifter | J6 2–3.5 kΩ + J2 status | J9 120 VAC shifter |
| Drain | J6-3↔6 17.8–21.8 Ω | J6 drain + recirc |
| Lid lock | J4 50–160 Ω | J12 50–160 Ω |
| TEST count | #1–7 (+3a/3b), **no heater/thermistor test** | #1–9 (+3a/3b) |

**Decision:** New platform `whirlpool_tl_psc_washer` for WTW5–8 / MVW5–7 model routing (4616–8500 feature set). Reuses `whirlpoolMvw6200*` measurement knowledge (batch18) — identical Ω ranges and connector roles.

---

## 1. Pre-service checklist

| Check | Solomon field / chip |
|-------|---------------------|
| 120 VAC dedicated circuit | `motor_electrical.supply_voltage` |
| Hot/cold faucets open; hoses unobstructed | fill routing |
| HE detergent only | `commonly_missed.he_detergent` |
| Drain hose height 39"–8' (991 mm–2.4 m) | `functional_checks.drain_install` |
| Lid closed/locked for agitate/spin | `functional_checks.lid_lock_operation` |

---

## 2. Service modes (pp. 14–18)

| Mode | Entry |
|------|-------|
| **Service Diagnostic** | Standby → Key 1, Key 2, Key 3 within 8 sec → repeat **2 more times** (3 rounds). Success: all indicators on 1 sec then off; saved fault codes flash if present. |
| **UI Test** | Service Diagnostic → press Key 1 (encoder rotation + button activation) |
| **Automatic Test Mode** | Service Diagnostic → Key 2, then START — auto valves → drain → wash → spin |
| **Fault code display** | Service Diagnostic → Key 3 (binary LED display) |
| **Clear fault codes** | Hold Key 3 5 sec |
| **Software version** | Hold Key 2 5 sec — ACU/HMI/settings file in binary on status LEDs |
| **Exit** | Hold Key 1 5 sec, or POWER |

Sensor Feedback (referenced in tests): Water Level Pressure Sensor, Motor Speed Tachometer, Lid Lock (Load Control).

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
| **F3E2** | Pressure system fault | TEST #5 Water Level |
| **F5E1** | Lid switch fault | TEST #7 Lid Lock |
| **F5E3** | Lid lock will not unlock | TEST #7 Lid Lock |
| (unnamed) | Lid lock will not lock | TEST #7 Lid Lock |
| **F5E4** | Lid not opened between cycles | TEST #7 Lid Lock |
| **F6E1** | HMI cannot hear ACU | TEST #1, #4 |
| **F7E1** | Tach missing/wrong signal | TEST #1; TEST #3a optical sensor |
| **F7E3** | Basket engaged during wash | TEST #3a Shifter |
| **F7E4** | Basket re-engagement failure | TEST #3a Shifter |
| **F7E6** | Motor circuit open | TEST #3 / #3b |
| **F7E7** | Motor unable to reach RPM | TEST #3b Motor |
| LF / **F8E1** | Long fill | TEST #2, #5 |
| **F8E3** | Overflow | TEST #2, #5 |
| F8E6 | Water hazard | TEST #2, #5, #7 |
| dr / **F9E1** | Long drain | TEST #6 Drain Pump |

**Bold** = primary procedure routing tags in seeds.

---

## 4. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't power | Outlet; cord J1; ACU LED; HMI J5; TEST #1, #4 |
| Won't start | Lid lock; START; TEST #7, #4 |
| Won't fill | Supply; screens; valves; TEST #2, #5 |
| Won't drain | Hose height; obstructions; pump J6; TEST #6 |
| Won't agitate/spin | Water level; lid lock; shifter; motor/cap; TEST #5, #7, #3a, #3b |
| Leaking / overfill | Pressure hose; valves; TEST #5, #2 |

---

## 5. TEST index (Section 3, pp. 28–32)

| OEM | Procedure ID | Component focus | Key Ω / specs |
|-----|--------------|-----------------|---------------|
| #1 | `w11428632-test-01-acu-power` | ACU supply, diagnostic LED | 120 VAC J1-1↔J1-2; +12 VDC J5-1↔J5-4 |
| #2 | `w11428632-test-02-valves` | Inlet valves J8 | **890–1090 Ω** (J8-1 common to coil pin) |
| #3 | `w11428632-test-03-drive-system` | Drive pre-test | Component Activation wash/spin |
| #3a | `w11428632-test-03a-shifter` | Shifter J6-2↔6, switch J2-1 | **2–3.5 kΩ** shifter; 0/+5 VDC shifter status |
| #3b | `w11428632-test-03b-motor` | PSC motor J6 | **5–9.5 Ω** CW J6-4↔6, CCW J6-1↔6; run capacitor |
| #4 | `w11428632-test-04-hmi` | HMI J5 | UI Test Key 1; harness J5↔HMI J1 continuity |
| #5 | `w11428632-test-05-water-level` | Pressure transducer hose | Sensor Feedback water level cycle |
| #6 | `w11428632-test-06-drain-pump` | Drain pump J6-3↔6 | **17.8–21.8 Ω** |
| #7 | `w11428632-test-07-lid-lock` | Lid lock J4 | Solenoid **50–160 Ω** J4-2↔3; switch states |

**No TEST #5 thermistor** on this platform (unlike MVW6200 W11416395).

---

## 6. ACU connector pinout (Figure 4–5 p. 27; strip circuits Figure 7 p. 32)

| Conn | Function |
|------|----------|
| J1 | Power cord Line/Neutral |
| J5 | HMI (+12V, WIN_DATA, AGND) |
| J2 | Tach / shifter status |
| J4 | Lid lock |
| J6 | PSC motor, shifter, drain pump |
| J8 | Valves |

---

## 7. Measurement knowledge (batch18 reuse)

| Knowledge ID | Spec | J-connector |
|--------------|------|-------------|
| `whirlpoolMvw6200WasherInletValveOhms` | 890–1090 Ω | J8 |
| `whirlpoolMvw6200WasherMotorWindingOhms` | 5–9.5 Ω | J6 |
| `whirlpoolMvw6200WasherShifterOhms` | 2–3.5 kΩ | J6-2↔6 |
| `whirlpoolMvw6200WasherDrainPumpOhms` | 17.8–21.8 Ω | J6-3↔6 |
| `whirlpoolMvw6200WasherLidLockSolenoidOhms` | 50–160 Ω | J4-2↔3 |
| `whirlpoolMvw6200WasherAcu12Vdc` | +12 VDC | J5-1↔4 |
| `supplyVoltage120` | 120 VAC | J1 |

Platform bindings in `resolveFieldKnowledge.ts` for `whirlpool_tl_psc_washer`.

---

## 8. Pipeline

```bash
python backend/scripts/crop_w11428632_procedure_figures.py
python backend/scripts/run_procedure_manual_pipeline.py --manual W11428632
cd frontend && npx tsc --noEmit
```

**WO smoke:** Whirlpool WTW5057LW → `whirlpool_tl_psc_washer`; F5E3 → `w11428632-test-07-lid-lock`.
