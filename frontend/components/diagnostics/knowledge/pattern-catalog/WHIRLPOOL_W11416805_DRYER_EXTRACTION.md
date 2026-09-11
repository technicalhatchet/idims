# Whirlpool/Maytag ACU top-load dryer — W11416805 extraction

**Source:** `backend/docs/manuals/technical-manual-w11416805-revb wed5100 wgd5100.pdf` (Part W11416805 Rev B)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11416805-revb wed5100 wgd5100-extracted.txt`  
**Scope:** 7.4 / 8.8 cu ft top-load electric and gas dryers — WED5100, WGD5100 family (27" and 29").  
**Status:** batch17 measurements, 14 TEST procedures + diagnostic-entry bundle.

Cross-reference: [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) (CCU W10680150 — dual-element ≤50 Ω, P-connector naming).  
**Not** Duet Sport MCE — see `whirlpool_duet_sport_dryer` / W8178559.

**Platform:** `whirlpool_acu_tl_dryer` — model patterns `WED51*`, `WGD51*`, `MED51*`, `MGD51*`.  
**Note:** `whirlpool_ccu_dryer` catch-all still matches other WED/WGD; 51-prefix wins via explicit pattern order.

---

## 1. Pre-service checklist

| Check | Why it matters |
|-------|----------------|
| 120 V (gas) / 240 V (electric) at outlet | ACU LED and +5/+12.7 VDC depend on L1 path |
| Clean lint screen + vent | Poor airflow trips hi-limits, F3E1 thermistor faults |
| Gas shutoff open (gas) | No ignition before valve diagnosis |
| Door fully closed | J8-3 to J8-4 door switch 0–2 Ω |
| Clear fault history before diagnostic cycle | Stale codes mask new failures |

---

## 2. Error codes (F# E# display)

| Code | Meaning | First test |
|------|---------|------------|
| **F1E1** | ACU fault / no heater relay voltage | TEST #1 ACU power |
| **F2E1** | HMI stuck button (service menu only) | TEST #6 HMI |
| **F2E2** | HMI internal fault | TEST #6 HMI |
| **F3E1** | Exhaust thermistor open/short | TEST #4a — >50 kΩ open, <500 Ω short |
| **F3E2** | Moisture sensor open/short | TEST #5 |
| **F3E3** | Inlet thermistor open/short | TEST #4a — >245 kΩ open, <328 Ω short |
| **F3E5** | Rear moisture sensor (some models) | TEST #5 |
| **F6E1** | HMI ↔ ACU comm error | TEST #1 + TEST #6 |

Customer notifications (not stored faults): power failure, check vent.

---

## 3. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| No power / won't wake | Outlet, TEST #2 supply, TEST #1 ACU +5/+12.7 VDC |
| Won't start | Door switch TEST #7, belt/motor TEST #3, thermal fuse (electric) |
| No heat (electric) | Element ~10 Ω cut-off to heater red, thermistors, limits |
| No ignition (gas) | TEST #4b fuse (29" only), cut-off, gas valve TEST #4d |
| Long dry / shuts off early | Moisture TEST #5, exhaust NTC TEST #4a |
| Heat won't shut off | Outlet NTC, element short, heater relay TEST #4 |
| No steam (some models) | Water supply, TEST #9 valve 510–590 Ω |

---

## 4. Measurements (batch17 + shared)

| Knowledge ID | Spec | Notes |
|--------------|------|-------|
| `whirlpoolAcuTlDryerHeaterOhms` | ~10 Ω | Cut-off red to heater red — single element |
| `whirlpoolAcuTlDryerSteamValveOhms` | 510–590 Ω | J8-1 to J9-2 (steam models) |
| `dryerMotorCircuitOhms` | 1–6 Ω | J8-4 to J9-1 at ACU |
| `dryerDrumMotorWindingOhms` | Main 3.3–3.6 Ω; start 2.7–3.0 Ω | Motor switch pins 4-5 / 4-3 |
| `dryerExhaustThermistorOhms` | ~12 kΩ @ 70°F | J14-3 to J14-6; OEM R/T table §3-9 |
| `dryerInletThermistorOhmsElectric` | ~62 kΩ @ 68°F | J14-1 to J14-2 electric table |
| `dryerInletThermistorOhmsGas` | ~58–68 kΩ @ 68°F | J14-1 to J14-2 gas table |
| `gasValveCoilOhms` | 1-2: 1400±70; 1-3: 570±28.5; 4-5: 1300±65 | Gas only |
| `hotSurfaceIgniterOhms` | 50–500 Ω | Gas only |

**Do not** reuse CCU dual-element ≤50 Ω or Duet Sport 7–12 Ω specs on WED51*.

---

## 5. Service diagnostic entry

1. Standby — plugged in, indicators off.  
2. Select any 3 buttons (not POWER). Within 8 s: press/release each once, repeat sequence 2 more times (9 presses).  
3. LCD shows "This area is for Service Technicians only."  
4. Press Select/Enter (Key 2) to enter Service Mode.  
5. Navigate: Service Diagnostics → HMI Test / Component Activation / Sensor Feedback / Diagnostic Cycle.

Unsuccessful entry → retry different buttons; stuck button → replace HMI; no indicators → TEST #1.

Bundle: `w11416805-diagnostic-entry` attached to motor, moisture, thermistors, HMI, door switch.

---

## 6. TEST # index

| OEM | Procedure ID | templateIds | Tags / codes |
|-----|--------------|-------------|--------------|
| TEST #1 | `w11416805-acu-power` | both | F1E1, F6E1, no_power |
| TEST #2 | `w11416805-supply-connections` | both | supply_issue |
| TEST #3 | `w11416805-motor-circuit` | both | motor_check, wont_spin |
| TEST #4 electric | `w11416805-heater-electric` | electric_dryer | no_heat, F1E1 |
| TEST #4 gas | `w11416805-heater-gas` | gas_dryer | no_heat, ignition_issue |
| TEST #4a | `w11416805-thermistors` | both | F3E1, F3E3 |
| TEST #4b | `w11416805-thermal-fuse` | both | no_heat, no_spin |
| TEST #4c | `w11416805-thermal-cutoff` | both | no_heat |
| TEST #4d | `w11416805-gas-valve` | gas_dryer | gas_valve_check, igniter_check |
| TEST #5 | `w11416805-moisture-sensor` | both | F3E2, F3E5, long_dry |
| TEST #6 | `w11416805-hmi` | both | F2E1, F2E2, F6E1, hmi_check |
| TEST #7 | `w11416805-door-switch` | both | door_switch_check |
| TEST #8 | `w11416805-drum-light` | both | drum_light_check |
| TEST #9 | `w11416805-water-valve` | both | steam_valve_check |

**Deferred:** diagram crops (ACU pinout page 3-3), rear moisture sensor J23 variant detail.

---

## 7. Re-seed & verify

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11416805
cd frontend && npx tsc --noEmit
```

WO smoke: WED5100 + Whirlpool → `whirlpool_acu_tl_dryer`; F3E1 → `w11416805-thermistors`.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/technical-manual-w11416805-revb wed5100 wgd5100.pdf"`*
