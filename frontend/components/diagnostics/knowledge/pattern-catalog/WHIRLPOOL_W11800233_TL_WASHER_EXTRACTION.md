# Whirlpool/Maytag 4.0–4.3 cu ft ACU belt-drive top-load washer — W11800233 extraction

**Source:** `backend/docs/manuals/technical-manual-W11800233-revc wtw4100.pdf` (W11800233 Rev C)  
**Extracted text:** `backend/docs/manuals/technical-manual-W11800233-revc wtw4100-extracted.txt`  
**Scope:** Whirlpool/Maytag 4.0–4.3 cu ft top-load; **belt-drive PSC motor + shifter** (not direct-drive BPM)  
**Models:** WTW41*, MVW41*, WTW40*  
**Platform:** `whirlpool_tl_dd_4100`  
**Status:** batch28 measurements, 9 TEST procedures (+3a/3b) + 2 service-mode bundles

Cross-reference: [WHIRLPOOL_W11416787_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W11416787_TL_WASHER_EXTRACTION.md) (5.1 cu ft **direct-drive** — different ACU pinouts and Ω specs). [WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md) (6.2 cu ft DD — do not reuse). [WHIRLPOOL_W11697231_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W11697231_TL_WASHER_EXTRACTION.md) (3.8 cu ft PSC — shares belt/shifter architecture but different connectors and valve Ω).

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

## 2. Service modes (pp. 48–65)

| Mode | Entry |
|------|-------|
| **Service Diagnostic** | Standby → any **3 buttons** (remember order) → press 1st, 2nd, 3rd within 8 sec → repeat sequence **2 more times** (3 rounds). Success: all HMI indicators on 1 sec, then off; status LEDs blink twice if no saved codes. |
| **HMI Test** | Service Diagnostic → press **Key 1** (encoder + button activation) |
| **Automatic Test Mode** | Service Diagnostic → press **Key 2**, then **START** (lid closed) |
| **Fault code scroll** | Service Diagnostic → press **Key 3** repeatedly |
| **Clear fault codes** | Hold **Key 3** 5 sec (must be in Fault Code Display mode) |
| **Software version** | Hold **Key 2** 5 sec |
| **Exit** | Hold **Key 1** 5 sec, or POWER |

**Auto Test sequence:** valves (fill to 70 mm) → drain pump (to 3 mm) → wash (shifter agitate) → spin (140/300/500 rpm).

**Deferred v1:** diagram crops (ACU pinout p. 80); Service Module 2.0 / Service App flows.

---

## 3. Error codes (F#E# routing)

| Code | Meaning | First test |
|------|---------|------------|
| **F1E1** | Main control (ACU) fault | TEST #1 ACU |
| **F2E1** | HMI stuck button | TEST #4 HMI |
| **F2E3** | ACU/HMI mismatch | TEST #1, #4 |
| **F3E2** | Pressure system fault | TEST #5 Water Level |
| **F5E1** | Lid switch fault (lid open while locked) | TEST #7 Lid Lock |
| **F5E3** | Lid lock will not unlock | TEST #7 Lid Lock |
| **F5E4** | Lid lock will not lock | TEST #7 Lid Lock |
| **F6E1** | HMI cannot hear ACU | TEST #1, #4 |
| **F7E1** | Tachometer missing/wrong signal | TEST #3a Shifter |
| **F7E3** | Basket engaged during wash | TEST #3a Shifter |
| **F7E4** | Basket re-engagement failure | TEST #3a Shifter |
| **F7E6** | Motor circuit open | TEST #3 / #3b |
| **F7E7** | Motor unable to reach target RPM | TEST #3 / #3b |
| LF / **F8E1** | Long fill | TEST #2, #5 |
| **F8E3** | Overflow / flood | TEST #2, #5 |
| **F8E6** | Water hazard (lid open, water in tub) | TEST #2, #5, #7 |
| dr / **F9E1** | Long drain | TEST #6 Drain |

**Bold** = primary procedure routing tags in seeds.

---

## 4. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't power | Outlet; cord J1; ACU status LED; HMI J5; TEST #1, #4 |
| Won't fill | Supply; screens; valves; TEST #2, #5 |
| Won't drain | Hose height; obstructions; pump; TEST #6 |
| Won't agitate/spin | Water level; lid lock; shifter; motor; TEST #5, #7, #3a, #3b |
| HMI / encoder fail | HMI Test (Key 1); TEST #4 |

---

## 5. TEST index (Section 3, pp. 81–94)

| OEM | Procedure ID | Component focus | Key Ω / specs |
|-----|--------------|-----------------|---------------|
| #1 | `w11800233-test-01-acu-power` | ACU supply, status LED | 120 VAC J1-1↔J1-2; +12 VDC J5-1↔J5-4 |
| #2 | `w11800233-test-02-valves` | Inlet valves J8 | **1300–1540 Ω** J8-1 common to valve pin |
| #3 | `w11800233-test-03-drive-system` | Drive pre-test | Auto Test agitate + spin low |
| #3a | `w11800233-test-03a-shifter` | Shifter J6 + switch J2 | Shifter **2–3.5 kΩ** J6-2↔6; switch 0/+5 VDC J2-1 |
| #3b | `w11800233-test-03b-motor` | PSC motor J6 + run cap | **3.5–6 Ω** CW J6-4↔6; CCW J6-1↔6 |
| #4 | `w11800233-test-04-hmi` | HMI J5 | Harness J5 ↔ HMI J1 continuity |
| #5 | `w11800233-test-05-water-level` | Pressure transducer hose | Auto Test fill 70 mm / drain to 3 mm |
| #6 | `w11800233-test-06-drain-pump` | Drain pump J6 | **14–25 Ω** J6-3↔6 |
| #7 | `w11800233-test-07-lid-lock` | Lid lock J4 | Solenoid **50–160 Ω** J4-2↔1; switch states |

---

## 6. ACU connector pinout (p. 80)

| Conn | Function |
|------|----------|
| J1 | Power cord Line/Neutral |
| J5 | HMI (+12 V, comm, GND) |
| J8 | Water valves (GND J8-1 common) |
| J6 | Motor, shifter, drain pump |
| J4 | Lid lock |
| J2 | Shifter microswitch + tachometer |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11800233
cd frontend && npx tsc --noEmit
```

**WO smoke:** Whirlpool WTW4100 → `whirlpool_tl_dd_4100`; F5E3 → `w11800233-test-07-lid-lock`; F3E2 → `w11800233-test-05-water-level`.

**Do not reuse W10864849 or W11416787 specs:** BPM motor 8–10 Ω; valves 790–840 Ω or 890–1090 Ω; lid lock 35 Ω; J12/J14/J16 pinouts.
