# Whirlpool/Maytag direct-drive top-load washer — W10864849 extraction

**Source:** `backend/docs/manuals/w10864849-whirlpool-and-maytag-direct-drive-top-load-washer wtw9500.pdf` (W10864849, L-89)  
**Extracted text:** `backend/docs/manuals/w10864849-whirlpool-and-maytag-direct-drive-top-load-washer wtw9500-extracted.txt`  
**Scope:** Whirlpool/Maytag 6.2 cu ft direct-drive top-load; capacitive glass UI; clutch-coil shifter; optional heater, recirc, bulk dispense, basket light  
**Models:** WTW9500E*, MVWB955F* (and color variants)  
**Status:** batch16 measurements, procedure seeds, service-mode bundles

Cross-reference: [WHIRLPOOL_W11169652_WASHER_EXTRACTION.md](./WHIRLPOOL_W11169652_WASHER_EXTRACTION.md) (27" front-load DD — different platform, do not reuse Ω specs).

---

## 1. Pre-service checklist

| Check | Solomon field / chip |
|-------|---------------------|
| 120 VAC dedicated circuit | `motor_electrical.supply_voltage` |
| Hot water ≥120°F at tap | field help on fill |
| HE detergent only | `commonly_missed.he_detergent` |
| Drain hose height 39"–8' (991 mm–2.4 m) | `functional_checks.drain_install` |
| Lid closed/locked for agitate/spin | `functional_checks.lid_lock_operation` |
| Tilted service: drain basket, remove load, remove bulk drawer | procedure safety notes |

---

## 2. Service modes (pp. 2-2 – 2-4)

| Mode | Entry |
|------|-------|
| **Service Diagnostic** | Standby → choose any **3 buttons except POWER** → press 1st, 2nd, 3rd within 8 sec → repeat sequence **2 more times** (3 rounds). Success: all indicators on 5 sec, display **888**, tone. |
| **Key Activation & Encoder Test** | In Service Diagnostic: press **1st** button used for entry |
| **Service Test Mode** | In Service Diagnostic: press **2nd** button used for entry. START toggles selected function on/off. |
| **Fault code scroll** | In Service Diagnostic: press **3rd** button repeatedly |
| **Clear fault codes** | Hold **3rd** entry button 5 sec → display 888 + beep |
| **Exit** | Hold **1st** entry button 5 sec, or POWER once/twice |

Service Test function numbers (selected): 001–018 component toggles; 051 Service Diagnostics Verification Cycle; 052 Load Size Calibration. See manual chart pp. 2-4.

---

## 3. Error codes (F#E# + aliases)

| Code | Alias | Meaning | First test |
|------|-------|---------|------------|
| F0E2 | — | Oversuds | HE detergent; pressure hose; mechanical friction |
| F0E3 | — | Overload | Reduce load; basket friction |
| F0E4 | — | Spin limited by water temp | TEST #2 Valves |
| F0E5 | OFB | Off-balance | Suspension; load distribution |
| **F1E1** | — | Main control fault | TEST #1 ACU |
| **F1E2** | — | Motor control section fault | TEST #3b Motor |
| F2E1 | — | UI stuck button | Key Activation & Encoder; TEST #4 |
| F2E3 | — | UI mismatch | Verify ACU/UI part numbers |
| F2E4 | — | UI parameter file incompatible | Replace UI |
| F2E5 | — | UI parameter memory invalid | Replace UI |
| **F3E1** | — | Pressure system fault | TEST #6 Water Level |
| **F3E2** | — | Inlet water temp (thermistor) | TEST #5 Thermistor |
| **F3E4** | — | Bulk dispense / REX comm | TEST #12 Bulk/REX |
| **F4E1** | — | Heater stuck on | TEST #9 Heater |
| **F4E2** | — | Heater not turning on | TEST #9 Heater |
| **F5E1** | — | Lid switch fault (lid up while locked) | TEST #8 Lid Lock |
| **F5E2** | — | Lid lock will not lock | TEST #8 Lid Lock |
| **F5E3** | — | Lid lock will not unlock | TEST #8 Lid Lock |
| **F5E4** | — | Lid not opened between cycles | TEST #8 Lid Lock |
| F6E2 | — | UI cannot hear ACU | TEST #1, #4 |
| F6E3 | — | ACU cannot hear UI | TEST #1, #4 |
| **F7E0** | — | Loss of power | Outlet; cord; TEST #1 |
| F7E1 | — | Loss of power during spin | F7E0 checks |
| **F7E2** | — | Motor drive module over temp | TEST #3b Motor |
| **F7E3** | — | Motor drive module over current | TEST #3b Motor |
| **F7E4** | — | Motor drive module over voltage | TEST #3b Motor |
| **F7E5** | — | Shifter failure | TEST #3a Shifter |
| **F7E6** | — | Motor circuit open | TEST #3 / #3b |
| **F7E7** | — | Motor start failure | TEST #3 / #3b |
| **F7E8** | — | Motor stator over temp | Friction; calibration |
| **F7E9** | — | Locked rotor | TEST #3 / #3b |
| LF / **F8E1** | — | Long fill | TEST #2, #6 |
| **F8E3** | — | Overflow / flood | TEST #2, #6 |
| F8E6 | — | Water hazard (lid open, water in tub) | TEST #2, #6, #8 |
| dr / drn / **F9E1** | — | Long drain | TEST #7 Drain |
| **F9E2** | — | Water ring / pump drive | TEST #7 Drain |

**Bold** = primary procedure routing tags in seeds.

---

## 4. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't power | Outlet; cord J12; ACU LED; UI J18; TEST #1, #4, #10 |
| Won't start | Lid lock; START press-and-hold; TEST #8, #4 |
| Won't fill | Supply; screens; siphon; valves; TEST #2, #6 |
| Won't drain | Hose height; obstructions; pump; TEST #7 |
| Won't agitate/spin | Water level; lid lock; shifter; motor; TEST #6, #8, #3a, #3b |
| Wrong temp | Hoses; thermistor; valves; TEST #5, #2 |
| Leaking / overfill | Pressure hose; valves; calibration; TEST #6, #2 |
| Bulk dispense fail | REX J7; pump ohms; TEST #12 |
| No basket light | Lid switch; J19; TEST #11, #8 |

---

## 5. TEST index (Section 3)

| OEM | Procedure ID | Component focus | Key Ω / specs |
|-----|--------------|-----------------|---------------|
| #1 | `w10864849-test-01-acu-power` | ACU supply, diagnostic LED | 120 VAC J12-1↔J12-3; +5 VDC J18-1↔J18-3 |
| #2 | `w10864849-test-02-valves` | Inlet valves J2 | **790–840 Ω** each coil (J2-4 common) |
| #3 | `w10864849-test-03-drive-system` | Drive pre-test | Service Test: Fast Agitate; spin |
| #3a | `w10864849-test-03a-shifter` | Shifter J4-7 | 120 VAC shifter; harness continuity |
| #3b | `w10864849-test-03b-motor` | Motor J1 | **8–10 Ω** J1 1-3, 3-4; motor connector 2-3, 3-4 |
| #4 | `w10864849-test-04-keys-encoders` | UI J18/J17 | Harness continuity; replace UI |
| #5 | `w10864849-test-05-temp-thermistor` | Inlet NTC J2-1↔J2-2 | **10 kΩ @ 77°F (25°C)**; R/T table |
| #6 | `w10864849-test-06-water-level` | Pressure transducer hose | No Ω — hose routing, dome |
| #7 | `w10864849-test-07-drain-recirc-pump` | Pumps J4 | Drain **18–24 Ω** J4-1↔3; Recirc **26–32 Ω** J4-1↔5 |
| #8 | `w10864849-test-08-lid-lock` | Lid lock J6 | Motor **35 Ω ±5** J6-2↔3; switch states |
| #9 | `w10864849-test-09-heater` | Heater J5 | Abnormal = **infinity** |
| #10 | `w10864849-test-10-service-leds` | UI service LEDs | Amber/blue/white LED behavior |
| #11 | `w10864849-test-11-basket-light` | Basket light J19 | **~0.13 V** lid closed; **2.8–5.0 V** lid open |
| #12 | `w10864849-test-12-bulk-dispense` | REX + bulk pump | Pump **1485–1815 Ω** |

---

## 6. ACU connector pinout (Figure 2, p. 3-5)

| Conn | Function |
|------|----------|
| J12 | Power cord L1/N/Gnd |
| J18 | UI (+5V, Wide, Rtn) |
| J2 | Valves & inlet thermistor |
| J1 | Motor VS1/VS2/VS3 |
| J4 | Drain/recirc pumps & shifter |
| J5 | Heater element |
| J6 | Lid lock |
| J7 | Relay expansion (REX) board |
| J19 | Basket light |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10864849
cd frontend && npx tsc --noEmit
```

**WO smoke:** Whirlpool WTW9500 → `whirlpool_tl_dd`; F5E2 → `w10864849-test-08-lid-lock`.

**Deferred:** diagram crops (ACU pinout p. 3-5); flame-sensor N/A; optional recirc/heater/bulk model gating in UI.
