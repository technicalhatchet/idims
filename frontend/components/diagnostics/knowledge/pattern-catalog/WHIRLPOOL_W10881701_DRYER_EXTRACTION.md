# Whirlpool/Maytag 9.2 cu ft steam dryer — W10881701 extraction

**Source:** `backend/docs/manuals/servicemanual-w10881701-l-91 wed9500.pdf` (Part W10881701 Rev L-91)  
**Extracted text:** `backend/docs/manuals/servicemanual-w10881701-l-91 wed9500-extracted.txt`  
**Scope:** 9.2 cu ft steam dryer — capacitive UI, steam refresh, water valve, drum LED, rear moisture sensor (some Maytag)  
**Models:** WED9500E*, WGD9500E*, MEDB955F*, MGDB955F*  
**Platform:** `whirlpool_ccu_dryer` — same ACU/CCU family as W10680150 tech sheet; connector **J** prefix (J8/J9/J14/J13) = **P** prefix on tech sheet  
**Status:** batch9 steam valve knowledge; 16 TEST procedures + 2 service-mode bundles

Cross-reference: [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) (W10680150 tech sheet), [WHIRLPOOL_W11416805_DRYER_EXTRACTION.md](./WHIRLPOOL_W11416805_DRYER_EXTRACTION.md) (ACU TL — different pinouts).

**Do not** reuse Duet Sport MCE specs (single 7–12 Ω element) or W11416805 TL specs (single ~10 Ω element).

---

## 1. Platform decision

| Check | W10680150 | W10881701 |
|-------|-----------|-----------|
| L1 at control | P9-2 vs P8-3 | J9-2 vs J8-3 |
| +5 VDC | P2-1 vs P2-3 | J2-1 vs J2-3 |
| Motor path | P8-4–P9-1 1–6 Ω | J8-4–J9-1 1–6 Ω |
| Dual electric heat | ≤50 Ω relay violet–violet | ≤50 Ω same |
| Gas valve coils | 1400/570/1300 Ω | Same |
| Moisture | P13 | J13 (+ optional J23 rear Maytag) |

**Verdict:** Extend `whirlpool_ccu_dryer` (not `whirlpool_ccu_dryer_premium`). W10881701 adds steam-only tests #8–#10.

---

## 2. Service modes (pp. 2-4 – 2-7)

| Mode | Entry |
|------|-------|
| **Service Diagnostic** | Standby → any 3 buttons (not POWER) × 3 rounds within 8 sec → “888” 5 sec / fault flash |
| **Key Activation & Encoder Test** | 1st diagnostic button (momentary) |
| **Service Test Mode** | 2nd diagnostic button → START; auto L2 → L1 → heater → airflow; **step 8 = water spray** |
| **Fault scroll** | 3rd button momentary |
| **Clear faults** | Hold 3rd button 5 sec |
| **Software version** | Hold 2nd button 5 sec |
| **Exit** | Hold 1st button 5 sec or POWER |

---

## 3. Error codes (selected)

| Code | Meaning | Procedure |
|------|---------|-----------|
| F1E1 | Motor relay stuck / ACU fault | TEST #1 |
| F1E3 | Wrong controller (electric) | TEST #1 / replace ACU+UI |
| F2E1 | UI stuck button | TEST #6 |
| F2E3–F2E5 | UI mismatch / software | TEST #6, #10 |
| F3E1 | Exhaust thermistor | TEST #4a |
| **F3E2** | **Moisture sensor** (not F3E6 on this manual) | TEST #5 |
| F3E3 | Inlet thermistor | TEST #4a |
| F3E7 | Rear moisture (Maytag) | TEST #5 |
| F4E1 / F4E2 | Heater relay / connector | TEST #4 electric |
| F4E4 | L2 low (electric) | TEST #2; gas: J14 pins 4–5 loopback |
| F6E2 / F6E3 | UI↔ACU comm | TEST #1, #6, #10 |

---

## 4. TEST index & procedure IDs

| OEM | ID | Notes |
|-----|-----|-------|
| #1 | `w10881701-acu-power` | Green LED wake; +5 VDC only (no +12 V step); J14 thermistor isolation |
| #2 | `w10881701-supply-connections` | Same as W10680150 with J* connectors |
| #3 | `w10881701-motor-circuit` | Maytag run/start caps optional (189–227 µF / 22.3–24.7 µF) |
| #4 | `w10881701-heater-electric` / `-heater-gas` | Dual ≤50 Ω electric; gas 19.6 Ω strip path |
| #4a–#4d | thermistors, fuse, cutoff, gas-valve | Shared knowledge with W10680150 |
| #5 | `w10881701-moisture-sensor` | J13 harness bench (not wet-cloth service mode) |
| #5a | `w10881701-dryness-adjust` | Hold **DRYNESS** 3 sec; levels 0–4 |
| #6 | `w10881701-button-indicator` | Key Activation & Encoder Test |
| #7 | `w10881701-door-switch` | Drum light on/off + wiring |
| **#8** | `w10881701-drum-led` | J6; 150 mA driver check |
| **#9** | `w10881701-water-valve` | Service Test step 8; `whirlpoolCcuDryerSteamValveOhms` 510–590 Ω |
| **#10** | `w10881701-service-leds` | UI underside amber/blue/white service LEDs |

**Bundles:** `w10881701-diagnostic-entry`, `w10881701-service-test-mode`

---

## 5. Measurement specs (W10881701-specific)

| Knowledge ID | Spec | Test point |
|--------------|------|------------|
| `whirlpoolCcuDryerHeaterOhms` | ≤50 Ω | Heater relay violet–violet |
| `dryerDrumMotorWindingOhms` | Main 3.3–3.6; start 2.7–3.0 | Motor switch pins |
| `dryerMotorCircuitOhms` | 1–6 Ω | J8-4–J9-1 |
| `whirlpoolCcuDryerSteamValveOhms` | **510–590 Ω** | J8-1–J9-2 |
| Drum LED driver | ~150 mA | J6 pins 1–3, door open, live |

---

## 6. Complaint routing

| Complaint | Lead procedure |
|-----------|----------------|
| No power / dead UI | #1 → #2 → #6 → #10 |
| No heat | #4 (+ #4a–#4d gas) |
| Long dry / moisture | #5 → #5a → #4a |
| No steam / no water spray | #9 (+ service test bundle) |
| Drum light out | #8 (also validates door sense with #7) |
| F3E2 / F3E7 | #5 |

---

## 7. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10881701
cd frontend && npx tsc --noEmit
```

WO smoke: WED9500 + Whirlpool → `whirlpool_ccu_dryer`; F3E2 → `w10881701-moisture-sensor`; steam complaint → `w10881701-water-valve`.

---

## Diff vs W10680150

| Area | W10680150 (tech sheet) | W10881701 (steam manual) |
|------|------------------------|---------------------------|
| Procedures | 13 (+ deferred #8/#9) | **16** (includes #8 drum LED, #9 water, #10 service LEDs) |
| Control label | CCU / P* connectors | ACU / **J*** connectors (same pin functions) |
| TEST #1 | +5 VDC **and +12 VDC** (P5) | +5 VDC only; green LED hibernate note |
| Moisture F-codes | F3E6/F3E7 | **F3E2** (+ F3E7 rear Maytag) |
| Moisture test | Service mode wet cloth | **J13 harness bench** |
| Dryness #5a | Dryness Level hold on auto cycle | **DRYNESS** button standby adjust 0–4 |
| UI test #6 | UI Component Test | **Key Activation & Encoder Test** |
| Door #7 | P8 bench + service mode | Drum light functional + wiring |
| Service bundles | Diagnostic entry only | Diagnostic entry + **Service Test Mode** |
| Steam valve knowledge | Deferred | `whirlpoolCcuDryerSteamValveOhms` in batch9 |

*Regenerate text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/servicemanual-w10881701-l-91 wed9500.pdf"`*
