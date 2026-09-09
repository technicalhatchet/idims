# Whirlpool/Maytag Centennial dryer — 8178629 extraction

**Source:** `backend/docs/manuals/jobaid-8178629 wed4950.pdf` (Job Aid ML-4 / Part 8178629)  
**Extracted text:** `backend/docs/manuals/jobaid-8178629 wed4950-extracted.txt`  
**Scope:** Centennial™ electric & gas dryers — MED/MGD 5500–5900 series (2007 era). Mechanical timer + electronic control (not CCU LCD stack).  
**Status:** Phase A — platform split, batch21 measurements, 11 procedure seeds + diagnostic-entry bundle.

Cross-reference: [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) (W10680150 CCU TEST #1–7).  
**Not** CCU — different control architecture, pinouts, and Ω specs despite shared dual-element heater concept.

**Platform:** `whirlpool_centennial_dryer` — model patterns `MED55*`, `MGD55*`, `MED59*`, `MGD59*`, `WED55*`, `WGD55*`, `WED59*`, `WGD59*`, `WED4815`/`WGD4815` class.

---

## 1. Pre-service checklist

| Check | Why it matters |
|-------|----------------|
| 120 V (gas) / 240 V (electric) at outlet | Electronic control + timer motor sensitive to low voltage |
| Clean lint screen & vent | Thermal fuse opens at 196°F; restricted vent mimics thermistor faults |
| Gas shutoff open (gas) | No ignition before valve diagnosis |
| Door fully closed | Door switch pins 1–3; diagnostic mode needs defined switch states |
| Corrosion on connectors | Job aid stresses disconnect/reconnect during all tests |

---

## 2. Error / symptom routing (no F-xx display)

Centennial uses audible diagnostic mode (beeps on input change), not saved F-xx codes like CCU/MCE.

| Symptom | First OEM path |
|---------|----------------|
| Won't run | Supply connections → PTS → thermal fuse → door switch → motor relay (COM–P2-6) → motor |
| Won't heat (electric) | Dual element Ω → TCO → high-limit → thermal fuse → exhaust thermistor |
| Won't heat (gas) | Thermal fuse → TCO → high-limit → flame sensor → ignitor → gas coils |
| 3 beeps at PTS | Exhaust thermistor open/short — §6-7 thermistor test |
| Long dry / shuts off early | Thermistor functional test; moisture sensor strip circuit |
| Timer advances continuously | Timer motor 3 kΩ (±2); timer encoding table §6-4 |

---

## 3. Measurements (batch21)

| Knowledge ID | Spec | Notes |
|--------------|------|-------|
| `whirlpoolCentennialDryerMotorOhms` | Main 1.4–2.6 Ω; start 1.4–2.8 Ω | Pin 4–5 / pin 4–3 at motor switch — **not** Duet Sport 2.4–3.8 or CCU 3.3–3.6 |
| `whirlpoolCentennialDryerMotorCircuitOhms` | Motor relay COM to P2-6: 1–6 Ω | §6-4 motor test at control |
| `whirlpoolCentennialDryerHeaterElementOhms` | COM–term1 or COM–term2: 15–25 Ω | Dual element per leg |
| `whirlpoolCentennialDryerHeaterDualParallelOhms` | Terminals 1–2: 30–50 Ω | Both elements series — **not** CCU ≤50 Ω relay parallel check |
| `whirlpoolCentennialDryerExhaustThermistorKohm` | R/T table §5-2 / §6-7 (~12 kΩ @ 70°F) | 3-beep PTS failure = open/short |
| `whirlpoolCentennialDryerInletThermistorKohm` | R/T table §5-5 (~62 kΩ @ 68°F) | Electric only — on high-limit assembly |
| `whirlpoolCentennialDryerIgnitorOhms` | 50–500 Ω | Wider than Duet Sport 50–250 |
| `whirlpoolCentennialDryerGasValveCoilOhms` | 1–2: 1365±25; 1–3: 560±25; 4–5: 1220±50 | §6-8 diagnostic table |
| `whirlpoolCentennialDryerTimerMotorOhms` | BU–PT-1: 3 kΩ (±2) | Mechanical timer motor |

---

## 4. Diagnostic mode (§6-1 / §6-2)

**Less Dry test:** Door closed, Timer Less Dry, Temp High, Signal Louder → PTS → timer advances to Off in ~16 s.

**Diagnostic test entry:**
- Door **open**, Temp **Air Fluff**, Signal **Louder**, Timer Timed or Sensor Drying
- Wrinkle Prevent **Off → On three times within 5 s**
- Single beep, pause, single beep = test mode active
- Each input change beeps (door, moisture sensor, temp, wrinkle, PTS, timer)

Bundle: `w8178629-diagnostic-entry`

---

## 5. Procedure index (generated)

| ID | OEM section | templateIds | Tags |
|----|-------------|-------------|------|
| `w8178629-supply-connections` | §6-3 | both (fuel split) | supply_issue, no_power |
| `w8178629-timer-motor` | §6-4 Timer Test | both | hmi_check, timer_issue |
| `w8178629-door-switch` | §5-1 / §6-5 | both | door_switch_check |
| `w8178629-thermal-fuse-exhaust` | §5-2 | both | no_heat, thermistor |
| `w8178629-electric-heater` | §5-4 dual element | electric_dryer | no_heat, heating_element_check |
| `w8178629-electric-tco-inlet` | §5-5 | electric_dryer | no_heat, thermistor |
| `w8178629-gas-hilimit-cutoff` | §5-2 gas | gas_dryer | no_heat |
| `w8178629-flame-sensor` | §5-3 | gas_dryer | ignition_issue |
| `w8178629-gas-coils` | §5-3 / §6-8 | gas_dryer | gas_valve_check |
| `w8178629-gas-ignitor` | §5-4 | gas_dryer | igniter_check |
| `w8178629-drive-motor` | §5-6 / §6-4 | both | motor_check, wont_spin |

**Bundle:** `w8178629-diagnostic-entry` (Less Dry + Diagnostic Test activation)

---

## 6. Relation to W10680150 (CCU)

| Aspect | W8178629 Centennial | W10680150 CCU |
|--------|---------------------|---------------|
| Control | Timer + electronic control board | Machine Control Electronics (CCU) |
| Test structure | Component Tests §5 + Diagnostics §6 | TEST #1–7 numbered tech sheet |
| Heater (electric) | Dual element 15–25 Ω per leg; 30–50 Ω series | Dual element ≤50 Ω at heater relays |
| Motor windings | 1.4–2.6 / 1.4–2.8 Ω | 3.3–3.6 / 2.7–3.0 Ω |
| Motor circuit at control | COM–P2-6: 1–6 Ω | P8-4–P9-1: 1–6 Ω |
| Neutral path | P2-1 (electric) / P1-2 (gas) to plug N | P8-3 to plug N |
| L1 path | Timer BK to plug L1 | P9-2 to plug L1 |
| Fault codes | Audible diagnostic; 3-beep thermistor | F1E1, F3Ex, F4Ex, F6Ex, F7E6, etc. |
| Diagnostic entry | Wrinkle Prevent ×3 (door open) | 3-button ×3 LCD Diagnostics Home |
| Platform ID | `whirlpool_centennial_dryer` | `whirlpool_ccu_dryer` |

Shared concepts (different pinouts/specs): thermal fuse, exhaust thermistor R/T shape, gas coil families, ignitor cold ohms band.

---

## 7. Gaps / deferred

| Gap | Notes |
|-----|-------|
| Moisture sensor bench test | Strip circuit only — no §5 ohms procedure |
| PTS / temperature / signal switch procedures | §6-5 tables — fold into diagnostic mode beep check v2 |
| Diagram crops | Deferred — no pinout figures in `public/images/procedures/` |
| DMA error-code rows | No display codes — complaint routing only |

---

## 8. Re-seed & verify

```bash
python backend/scripts/generate_w8178629_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

WO smoke: `MED5500TW0` + Maytag → `whirlpool_centennial_dryer`; `WED4815BW` + Whirlpool → Centennial (not CCU).

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/jobaid-8178629 wed4950.pdf"`*
