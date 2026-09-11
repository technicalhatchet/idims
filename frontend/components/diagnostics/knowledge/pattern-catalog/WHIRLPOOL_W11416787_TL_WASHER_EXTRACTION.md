# Whirlpool/Maytag 4.7/5.3 cu ft top-load washer — W11416787 extraction

**Source:** `backend/docs/manuals/technical-manual-w11416787-revc wtw5100+.pdf` (W11416787 Rev C)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11416787-revc wtw5100+-extracted.txt`  
**Scope:** Whirlpool/Maytag 4.7/5.3 cu ft top-load; belt-drive **and** direct-drive variants — **procedure seeds cover Direct Drive TEST #1–9 only**  
**Models:** WTW51*, MVW51* (direct-drive subset)  
**Platform:** `whirlpool_tl_dd_5100`  
**Status:** batch23 measurements, 11 TEST procedures (+3a/3b) + 2 service-mode bundles

Cross-reference: [WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md](./WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md) (6.2 cu ft DD — different ACU pinouts and Ω specs). [WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md](./WHIRLPOOL_W11416395_MWV6200_WASHER_EXTRACTION.md) (PSC belt platform — shares valve/drain/lid Ω ranges but different drive).

---

## 1. Pre-service checklist

| Check | Solomon field / chip |
|-------|---------------------|
| 120 VAC dedicated circuit | `motor_electrical.supply_voltage` |
| Hot/cold faucets open; hoses unobstructed | fill routing |
| HE detergent only | `commonly_missed.he_detergent` |
| Drain hose height 39"–8' (0.99 m–2.4 m) | `functional_checks.drain_install` |
| Lid closed/locked for agitate/spin | `functional_checks.lid_lock_operation` |

---

## 2. Service modes (pp. 2-3 – 2-8)

| Mode | Entry |
|------|-------|
| **Service Mode** | Standby → any **3 buttons except POWER** → press 1st, 2nd, 3rd within 8 sec → repeat sequence **2 more times** (3 rounds). Success: LCD shows *"This area is for Service Technicians only"* and navigation instructions. |
| **Service Diagnostics** | From Service Mode home → Select/Enter → Service Diagnostics |
| **HMI Test** | Service Diagnostics → HMI Test (Key, LED, Display, Audio, Encoder) |
| **Component Activation** | Service Diagnostics → Component Activation (valves, pumps, motor spin/agitate, shifter, bulk pump) |
| **Sensor Feedback** | Service Diagnostics → Sensor Feedback (lid, water level, thermistor, detergent level, tach) |
| **Fault History** | Service Mode → Fault History / Clear Fault History |
| **Exit** | Navigate to Exit Service Mode or repeatedly press Back/Exit |

**Deferred v1:** Test #10 Faucet Switch (J8); belt-drive TEST sections; diagram crops (ACU pinout p. 3-8).

---

## 3. Error codes (F#E# — Direct Drive routing)

| Code | Meaning | First test |
|------|---------|------------|
| **F1E1** | Main control fault | TEST #1 ACU |
| **F1E2** | Motor drive over voltage | TEST #3b Motor |
| **F2E1** | HMI stuck button | TEST #4 HMI |
| **F2E2** | HMI disconnected | TEST #4 HMI |
| **F3E2** | Pressure system fault | TEST #6 Water Level |
| **F3E3** | Inlet water temperature | TEST #5 Thermistor |
| **F3E5** | Mini bulk / Load & Go sensor | TEST #9 Load & Go |
| **F5E1** | Lid switch fault | TEST #8 Lid Lock |
| **F5E3** | Lid lock will not unlock | TEST #8 Lid Lock |
| **F5E4** | Lid lock will not lock | TEST #8 Lid Lock |
| **F7E3** | Motor drive over current | TEST #3b Motor |
| **F7E4** | Motor drive over voltage | TEST #3b Motor |
| **F7E6** | Motor circuit open | TEST #3 / #3b |
| **F7E7** | Motor start failure | TEST #3 / #3b |
| **F7E8** | Motor stator over temp | TEST #3b Motor |
| **F7E9** | Locked rotor | TEST #3 / #3b |
| **F7EA** | Motor drive fault | TEST #3 / #3b |
| LF / **F8E1** | Long fill | TEST #2, #6 |
| **F8E3** | Overflow | TEST #2, #6 |
| dr / **F9E1** | Long drain | TEST #7 Drain |

**Bold** = primary procedure routing tags in seeds.

---

## 4. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't power | Outlet; cord J1; ACU LED; HMI J14; TEST #1, #4 |
| Won't fill | Supply; screens; valves; TEST #2, #6 |
| Won't drain | Hose height; obstructions; pump; TEST #7 |
| Won't agitate/spin | Water level; lid lock; shifter; motor; TEST #6, #8, #3a, #3b |
| Wrong temp | Hoses; thermistor; valves; TEST #5, #2 |
| Load & Go fail | Drawer filled; J9 sensor; J17 pump; TEST #9 |

---

## 5. TEST index — Direct Drive only (Section 3, pp. 3-19 – 3-24)

| OEM | Procedure ID | Component focus | Key Ω / specs |
|-----|--------------|-----------------|---------------|
| #1 | `w11416787-test-01-acu-power` | ACU supply, diagnostic LED | 120 VAC J1-1↔J1-2; +12.7 VDC J14-1↔J14-4 |
| #2 | `w11416787-test-02-valves` | Inlet valves J16 | **890–1090 Ω** common J16-1 |
| #3 | `w11416787-test-03-drive-system` | Drive pre-test | Component Activation Slow Agitate + Spin Low |
| #3a | `w11416787-test-03a-shifter` | Shifter J15-4 | 120 VAC J15-1↔J15-4; slider on drive |
| #3b | `w11416787-test-03b-motor` | BPM motor J3 | **8–10 Ω** J3 1-2, 1-3; motor 2-4, 2-3 |
| #4 | `w11416787-test-04-hmi` | UI J14 | Harness J14-1/3/4 ↔ HMI J1-1/3/4 |
| #5 | `w11416787-test-05-temp-thermistor` | Inlet NTC J16-4↔J16-8 | **50 kΩ @ 77°F (25°C)**; R/T table |
| #6 | `w11416787-test-06-water-level` | Pressure transducer hose | No Ω — hose routing, dome |
| #7 | `w11416787-test-07-drain-recirc-pump` | Pumps J15 | Drain **17.8–21.8 Ω** J15-1↔2; Recirc **26–32 Ω** J15-1↔3 |
| #8 | `w11416787-test-08-lid-lock` | Lid lock J6 | Solenoid **50–160 Ω** J6-2↔3; switch states |
| #9 | `w11416787-test-09-load-and-go` | Bulk sensor J9 + pump J17 | Sensor 4.75–15.25 / 1.4–3.10 VDC; pump **16–19 Ω** J17-2↔3 |

---

## 6. ACU connector pinout — Direct Drive (Figure 5, p. 3-8)

| Conn | Function |
|------|----------|
| J1 | Power cord Line/Neutral |
| J14 | HMI (+12.7 V, +5 V, WIN_DATA, GND) |
| J16 | Valves & inlet thermistor |
| J3 | BPM motor (MCU_M_U/W/V, RTN) |
| J15 | Drain/recirc pumps & shifter |
| J6 | Lid lock |
| J9 | Bulk level sensor |
| J17 | Bulk dispense pump |
| J8 | Faucet switch (Test #10 — deferred) |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11416787
cd frontend && npx tsc --noEmit
```

**WO smoke:** Whirlpool WTW5100 → `whirlpool_tl_dd_5100`; F5E3 → `w11416787-test-08-lid-lock`; F3E5 → `w11416787-test-09-load-and-go`.

**Do not reuse W10864849 specs:** valves 790–840 Ω (J2), lid lock 35 Ω, bulk REX 1485–1815 Ω, ACU J12/J18 pinouts.
