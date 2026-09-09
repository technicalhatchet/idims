# Whirlpool ACU top-load dryer — W11798430 extraction

**Source:** `backend/docs/manuals/technical-manual-w11798430-revc wed4100.pdf` (Part W11798430 Rev C)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11798430-revc wed4100-extracted.txt`  
**Scope:** 7.0 cu. ft. top-load electric and gas dryers — WED4100, WGD4100 family.  
**Status:** batch24 measurements, 12 TEST procedures + diagnostic-entry bundle.

Cross-reference: [WHIRLPOOL_W11416805_DRYER_EXTRACTION.md](./WHIRLPOOL_W11416805_DRYER_EXTRACTION.md) (WED5100 cousin — J8/J9/J14 connectors, moisture sensor, steam valve).

**Platform:** `whirlpool_acu_tl_dryer` — model patterns `WED41*`, `WGD41*`, `MED41*`, `MGD41*` (shares platform with WED51*).

---

## 1. Pre-service checklist

| Check | Why it matters |
|-------|----------------|
| 120 V (gas) / 240 V (electric) at outlet | ACU status LED and +5/+12 VDC depend on L1 path |
| Clean lint screen + vent | Poor airflow trips hi-limits, F3E1 thermistor faults |
| Gas shutoff open (gas) | No ignition before valve diagnosis |
| Door fully closed | J7-3 to J7-5 door switch 0–2 Ω |
| Service Module 2.0 optional | Back-of-console port for Service Matters app fault history |

---

## 2. Error codes (F# E# binary LEDs)

| Code | Meaning | First test |
|------|---------|------------|
| **F1E1** | ACU fault / heater or motor circuit | TEST #1, #3, or #4 |
| **F1E1-1** | Heater circuit fault | TEST #4 heat system |
| **F1E1-3** | Motor circuit fault | TEST #3 motor |
| **F2E1** | HMI stuck button | TEST #5 HMI |
| **F3E1** | Exhaust thermistor open/short (J4) | TEST #4a |
| **F3E3** | Inlet thermistor open/short (J4) | TEST #4a |
| **F6E1** | HMI ↔ ACU comm error | TEST #1 + TEST #5 |
| **F6E2** | ACU comm failure | TEST #1 |

No F3E2 moisture sensor on this platform (knob/HMI era, no moisture strips).

---

## 3. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| No power / won't wake | Outlet, TEST #2 supply, TEST #1 ACU +5/+12 VDC |
| Won't start | Door switch TEST #6, belt/motor TEST #3, thermal fuse TEST #4b |
| No heat (electric) | Element ~10 Ω cut-off to high-limit, thermistors J4, limits |
| No ignition (gas) | TEST #4c cut-off, high-limit, gas valve TEST #4d |
| Long dry / shuts off early | Outlet/inlet NTC TEST #4a |
| Heat won't shut off | Outlet/inlet NTC, element short, heater relay TEST #4 |
| Drum light won't turn on | TEST #7 drum light |

---

## 4. ACU connectors (W4100)

| Connector | Function |
|-----------|----------|
| **J7** | L1 (J7-3), Neutral (J7-4), Motor (J7-1), Door (J7-5) |
| **J4** | Thermistors: outlet J4-1/2, inlet J4-3/4; +5 VDC J4-1/2 when unplugged |
| **J2** | WIN bus +12 VDC (J2-1), HMI data |

**Do not** use W11416805 J8/J9/J14 pinouts on WED41*.

---

## 5. Measurements (batch24 + shared batch17/5)

| Knowledge ID | Spec | Notes |
|--------------|------|-------|
| `whirlpoolAcuTlDryerHeaterOhms` | ~10 Ω | Cut-off black to high-limit red |
| `whirlpoolAcuTlDryer4100MotorMainWindingOhms` | 3.1–3.8 Ω | Motor pin 4 to copper off pin 5 |
| `whirlpoolAcuTlDryer4100MotorStartWindingOhms` | 2.5–3.2 Ω | Motor pin 4 to copper on pin 3 |
| `dryerMotorCircuitOhms` | 1–6 Ω | J7-1 to J7-3 at ACU |
| `dryerExhaustThermistorOhms` | OEM outlet table | J4-1 to J4-2 |
| `dryerInletThermistorOhmsElectric` | OEM inlet table | J4-3 to J4-4 |
| `gasValveCoilOhms` | 1-2: 1350±67.5; 1-3: 570±28.5; 4-5: 1300±65 | Gas only |
| `whirlpoolAcuTlDryer4100IgniterOhms` | 40–200 Ω | Gas only @ ~75°F |

---

## 6. Service diagnostic entry

1. Standby — plugged in, all LEDs off.  
2. Within 8 s: press/release **Key 1, Key 2, Key 3** — repeat sequence 2 more times (9 presses).  
3. All HMI indicators illuminate 1 s; STATUS LEDs blink twice if no saved faults.  
4. Key 1 → HMI Test; Key 2 → Service Test Mode; Key 3 → fault codes / clear (hold 5 s).

Bundle: `w11798430-diagnostic-entry` on motor, thermistors, HMI, door switch.

---

## 7. TEST # index

| OEM | Procedure ID | templateIds | Tags / codes |
|-----|--------------|-------------|--------------|
| TEST #1 | `w11798430-acu-power` | both | F1E1, F6E1, F6E2, no_power |
| TEST #2 | `w11798430-supply-connections` | both | supply_issue |
| TEST #3 | `w11798430-motor-circuit` | both | motor_check, F1E1 |
| TEST #4 electric | `w11798430-heater-electric` | electric_dryer | no_heat, F1E1 |
| TEST #4 gas | `w11798430-heater-gas` | gas_dryer | no_heat, ignition_issue |
| TEST #4a | `w11798430-thermistors` | both | F3E1, F3E3 |
| TEST #4b | `w11798430-thermal-fuse` | both | no_spin, motor_check |
| TEST #4c | `w11798430-thermal-cutoff` | both | no_heat |
| TEST #4d | `w11798430-gas-valve` | gas_dryer | gas_valve_check, igniter_check |
| TEST #5 | `w11798430-hmi` | both | F2E1, F6E1, F6E2, hmi_check |
| TEST #6 | `w11798430-door-switch` | both | door_switch_check |
| TEST #7 | `w11798430-drum-light` | both | drum_light_check |

**vs W11416805:** No TEST #5 moisture sensor, no TEST #9 steam valve. Connector naming J7/J4 vs J8/J9/J14.

**Deferred:** ACU pinout diagram crops.

---

## 8. Re-seed & verify

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11798430
cd frontend && npx tsc --noEmit
```

WO smoke: WED4100 + Whirlpool → `whirlpool_acu_tl_dryer`; F3E1 → `w11798430-thermistors`.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/technical-manual-w11798430-revc wed4100.pdf"`*
