# Whirlpool/Maytag 27" front-load steam dryer — W11169659 extraction

**Source:** `backend/docs/manuals/service-manual-w11169659 wedmed9620.pdf` (Part W11169659 Rev L-98)  
**Extracted text:** `backend/docs/manuals/service-manual-w11169659 wedmed9620-extracted.txt`  
**Scope:** 6.7 cu ft Medallion steam dryer — console + LCD-in-door HMI, steam water valve, drum LED, WiFi on some models  
**Models:** WED9620*, MED9620*, WGD9620*, MGD9620*; also WED5620*, WED7*, MED7*, WGD7*, MGD7* (27" FL console/LCD family)  
**Platform:** `whirlpool_ccu_dryer` — third manual on shared ACU/CCU platform (after W10680150 tech sheet + W10881701 WED9500)  
**Access manual:** W11737351 — component-access crops attach to shared W10881701 / W11169659 procedure steps (see [WHIRLPOOL_W11737351_FL_DRYER_ACCESS_EXTRACTION.md](./WHIRLPOOL_W11737351_FL_DRYER_ACCESS_EXTRACTION.md))  
**Status:** Reuses W10881701 procedures where identical; 4 manual-specific variants + 2 service-mode bundles

Cross-reference: [WHIRLPOOL_W10881701_DRYER_EXTRACTION.md](./WHIRLPOOL_W10881701_DRYER_EXTRACTION.md), [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md).

**Do not** reuse W10881701 dual-element ≤50 Ω relay check for W11169659 electric heat — this manual uses **~10 Ω** thermal cut-off to heater path (single element, same family as ACU TL W11798430).

---

## 1. Platform decision

| Check | W10881701 (WED9500) | W11169659 (MED9620) |
|-------|---------------------|---------------------|
| Connector prefix | J* | J* (same) |
| TEST #1 +5 VDC | J2-1 vs J2-3 | **J2-2 vs J2-4** |
| TEST #1 +12.7 VDC | Not in procedure | **J2-1 vs J2-4** (like W10680150) |
| Electric heat quick check | Dual ≤50 Ω at relays | **~10 Ω** cut-off to heater |
| Moisture TEST #5 | Bench J13 harness only | **Service mode wet cloth first**, then bench |
| Drum LED current | ~150 mA J6 1–3 | **150–370 mA** J6 1–3 |
| Steam valve | 510–590 Ω J8-1–J9-2 | Same |
| TEST #5a dryness | DRYNESS hold adjust | **Not in manual** |
| TEST #10 service LEDs | UI underside LEDs | **Not in manual** |

**Verdict:** Extend `whirlpool_ccu_dryer`. Explicit FL console/LCD patterns `/WED56/i`, `/WED66/i`, `/WED562/i`, `/MED56/i`, `/MED66/i` (electric) and `/WGD56/i`, `/WGD66/i` (gas) precede the broad `/WED/i` catch-all. WED7*/MED7*/WGD7*/MGD7* also resolve here (W11737351 access pairs with this catalog). Reuse 10 W10881701 procedure seeds; generate 4 `w11169659-*` deltas only.

---

## 2. Service modes (pp. 2-4 – 2-7)

| Mode | Entry |
|------|-------|
| **Service Diagnostic** | Standby → any 3 buttons (not POWER/START) × 3 rounds within 8 sec → “888” 5 sec |
| **Key Activation & Encoder Test** | 1st diagnostic button (momentary) |
| **Service Test Mode** | 2nd diagnostic button → START; L1/L2/heater/airflow; **step 8 = water spray** |
| **Fault scroll** | 3rd button momentary |
| **Clear faults** | Hold 3rd button 5 sec |
| **Software version** | Hold 2nd button 5 sec |
| **Exit** | Hold 1st button 5 sec or POWER |

LCD-in-door models also expose **Component Activation** factory test (pp. 2-10) — deferred v1; console 3-button path is primary.

---

## 3. Error codes (selected)

| Code | Meaning | Procedure |
|------|---------|-----------|
| F1E1 | Motor/heater relay or connector | TEST #1, #3 |
| F3E1 | Exhaust thermistor | TEST #4a |
| **F3E2** | Moisture sensor 1 (service mode only) | TEST #5 |
| F3E3 | Inlet thermistor | TEST #4a |
| **F3E5** | Moisture sensor 2 (Quad Sense / rear J23) | TEST #5 |
| F6E1 / F6E2 | ACU↔HMI comm | TEST #1, #6 |
| FCE1 | WiFi module comm | HMI / WiFi board |

---

## 4. TEST index & procedure IDs

| OEM | ID | Notes |
|-----|-----|-------|
| #1 | `w11169659-acu-power` | **Delta** — +5 VDC J2-2/J2-4; +12.7 VDC J2-1/J2-4; J14 thermistor isolation |
| #2 | `w10881701-supply-connections` | **Shared** |
| #3 | `w10881701-motor-circuit` | **Shared** — 1–6 Ω J8-4–J9-1; 3.3–3.6 / 2.7–3.0 Ω windings |
| #4 electric | `w11169659-heater-electric` | **Delta** — ~10 Ω cut-off to heater; outlet NTC at J14 |
| #4 gas | `w10881701-heater-gas` | **Shared** |
| #4a–#4d | `w10881701-thermistors`, `-thermal-fuse`, `-thermal-cutoff`, `-gas-valve` | **Shared** |
| #5 | `w11169659-moisture-sensor` | **Delta** — service mode wet cloth, then J13/J23 bench |
| #6 | `w10881701-button-indicator` | **Shared** |
| #7 | `w10881701-door-switch` | **Shared** |
| #8 | `w11169659-drum-led` | **Delta** — 150–370 mA J6 pins 1–3 |
| #9 | `w10881701-water-valve` | **Shared** — 510–590 Ω; Service Test step 8 |

**Bundles:** `w11169659-diagnostic-entry`, `w11169659-service-test-mode`

**Not in W11169659:** TEST #5a dryness adjust, TEST #10 service LEDs (W10881701 only).

---

## 5. Measurement specs (W11169659-specific)

| Knowledge ID | Spec | Test point |
|--------------|------|------------|
| `dryerMotorCircuitOhms` | 1–6 Ω | J8-4–J9-1 (shared) |
| `dryerDrumMotorWindingOhms` | Main 3.3–3.6; start 2.7–3.0 | Motor switch (shared) |
| Electric element path | **~10 Ω** | Thermal cut-off red to heater red/white |
| `whirlpoolCcuDryerSteamValveOhms` | 510–590 Ω | J8-1–J9-2 (shared) |
| Drum LED driver | **150–370 mA** | J6 pins 1–3, door open, live |

No new measurement batch — existing `whirlpool_ccu_dryer` knowledge covers motor, thermistors, gas valve, steam valve.

---

## 6. Complaint routing

| Complaint | Lead procedure |
|-----------|----------------|
| No power / dead UI | #1 → #2 → #6 |
| No heat (electric) | `w11169659-heater-electric` → #4a |
| No heat (gas) | `w10881701-heater-gas` → #4a–#4d |
| Long dry / moisture | #5 → #4a |
| No steam / no water spray | #9 (+ service test bundle) |
| Drum light out | #8 (also validates door sense with #7) |
| F3E2 / F3E5 | #5 |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11169659
cd frontend && npx tsc --noEmit
```

WO smoke: WED9620 or WED5620 or WED7120 + Whirlpool → `whirlpool_ccu_dryer`; F3E2 → `w11169659-moisture-sensor`; steam → `w10881701-water-valve`.

---

## Overlap summary

| vs W10881701 | Overlap |
|--------------|---------|
| Identical (10 procs) | #2, #3, #4 gas, #4a–d, #6, #7, #9 |
| Delta (4 procs) | #1 (+12.7 VDC, J2 pinout), #4 electric (~10 Ω), #5 (service mode first), #8 (150–370 mA) |
| W10881701 only | #5a dryness, #10 service LEDs |

| vs W10680150 | Overlap |
|--------------|---------|
| Same platform | P* = J* connector functions |
| W11169659 adds | Steam #8/#9, J* naming, service test water spray |
| W10680150 unique | CCU P-connector labels; no steam tests |

*Regenerate text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/service-manual-w11169659 wedmed9620.pdf"`*
