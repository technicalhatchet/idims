# Whirlpool/Maytag 5.3 cu ft PSC top-load washer — W11455152 extraction

**Source:** `backend/docs/manuals/technical-manual-w11455152-reva wtw6157.pdf` (W11455152A Rev A)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11455152-reva wtw6157-extracted.txt`  
**Scope:** Whirlpool 5.3 cu ft (6.1 IEC) top-load; LCD HMI; PSC motor + run capacitor; splutch shifter; integrated ACU pressure transducer  
**Models:** WTW61*, MVW61* (6157 class)  
**Platform:** `whirlpool_tl_dd_6157` — **not** `whirlpool_tl_dd_5100` (BPM direct-drive) or `whirlpool_tl_dd` (W10864849 6.2 cu ft BPM)  
**Status:** batch18 measurements (shared PSC specs with MVW6200), 9 TEST procedures (+3a/3b) + 2 service-mode bundles

Cross-reference: [WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md](./WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md) (4.8 cu ft PSC — same J-connector architecture and Ω specs). [WHIRLPOOL_W11416787_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W11416787_TL_WASHER_EXTRACTION.md) (4.7/5.3 BPM DD — different pinouts).

---

## Platform choice rationale

| Factor | W11455152 (6157) | W11416787 (5100 DD) |
|--------|------------------|---------------------|
| Motor | PSC + run capacitor, J6 5–9.5 Ω | BPM MCU, J3 8–10 Ω |
| HMI | J5 (+12 VDC) | J14 (+12.7 VDC) |
| Valves | J8 890–1090 Ω | J16 890–1090 Ω |
| Shifter | J6 2–3.5 kΩ + J2 status | J15 120 VAC shifter |
| Drain | J6-3↔6 only (no recirc) | J15 drain + recirc |
| Lid lock | J4 50–160 Ω | J6 50–160 Ω |
| TEST count | #1–7 (+3a/3b) | #1–9 (+3a/3b) |

**Decision:** New platform `whirlpool_tl_dd_6157` for WTW61*/MVW61* model routing. Reuses `whirlpoolMvw6200*` measurement knowledge (batch18) — identical Ω ranges and connector roles.

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

**Deferred v1:** diagram crops (ACU pinout p. 27); bulk dispense / Load & Go (optional J9/J17 on some loads).

---

## 3. Error codes (F#E#)

| Code | Meaning | First test |
|------|---------|------------|
| **F1E1** | Main control fault | TEST #1 ACU |
| **F2E1** | HMI stuck button | TEST #4 HMI |
| **F2E2** | HMI disconnected | TEST #4 HMI |
| **F3E2** | Pressure system fault | TEST #5 Water Level |
| **F5E1** | Lid switch fault | TEST #7 Lid Lock |
| **F5E3** | Lid lock will not unlock | TEST #7 Lid Lock |
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
| Won't fill | Supply; screens; valves; TEST #2, #5 |
| Won't drain | Hose height; obstructions; pump; TEST #6 |
| Won't agitate/spin | Water level; lid lock; shifter; motor/cap; TEST #5, #7, #3a, #3b |
| Wrong temp | Hoses; valves; TEST #2 |

---

## 5. TEST index (Section 3, pp. 28–32)

| OEM | Procedure ID | Component focus | Key Ω / specs |
|-----|--------------|-----------------|---------------|
| #1 | `w11455152-test-01-acu-power` | ACU supply, diagnostic LED | 120 VAC J1-1↔J1-2; +12 VDC J5-1↔J5-4 |
| #2 | `w11455152-test-02-valves` | Inlet valves J8 | **890–1090 Ω** (J8-1 common to coil pin) |
| #3 | `w11455152-test-03-drive-system` | Drive pre-test | Component Activation Slow Agitate + Spin Low |
| #3a | `w11455152-test-03a-shifter` | Shifter J6-2↔6, switch J2-1 | **2–3.5 kΩ** shifter; 0/+5 VDC shifter status; optical tach J2-3 |
| #3b | `w11455152-test-03b-motor` | PSC motor J6 | **5–9.5 Ω** CW J6-4↔6, CCW J6-1↔6; run capacitor |
| #4 | `w11455152-test-04-hmi` | HMI J5 | UI Test Key 1; harness J5↔HMI J1 continuity |
| #5 | `w11455152-test-05-water-level` | Pressure transducer hose | Sensor Feedback water level cycle |
| #6 | `w11455152-test-06-drain-pump` | Drain pump J6-3↔6 | **17.8–21.8 Ω** |
| #7 | `w11455152-test-07-lid-lock` | Lid lock J4 | Solenoid **50–160 Ω** J4-2↔3; switch states |

---

## 6. ACU connector pinout (Figure 4–5, p. 27)

| Conn | Function |
|------|----------|
| J1 | Power cord Line/Neutral |
| J5 | HMI (+12 VDC, +5 V, WIN_DATA, GND) |
| J2 | Shifter status / tach power |
| J4 | Lid lock |
| J6 | PSC motor, shifter coil, drain pump |
| J8 | Valves & inlet NTC |
| J9 | Bulk level sensor (optional) |
| J17 | Bulk dispense pump (optional) |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11455152
cd frontend && npx tsc --noEmit
```

**WO smoke:** Whirlpool WTW6157 → `whirlpool_tl_dd_6157`; F5E3 → `w11455152-test-07-lid-lock`; F3E2 → `w11455152-test-05-water-level`.

**Do not reuse W11416787 specs:** BPM motor J3 8–10 Ω, J14 HMI, J16 valves, J15 drain/recirc, J6 lid lock.
