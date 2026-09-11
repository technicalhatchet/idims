# Samsung RF260B / RF261B side-by-side refrigerator — extraction

**Source:** `backend/docs/manuals/samsung frdige rf260b.pdf`  
**Extracted text:** `backend/docs/manuals/samsung frdige rf260b-extracted.txt`  
**Scope:** Bottom-mount freezer SxS — RF260B*, RF261B* (2012 era)  
**Platform:** `samsung_sxs` (shared with newer RS28 family field/measurement bindings)  
**Status:** Complete — §4-1 test mode + §4-1-3 self-diagnostic checklist procedures  
**Knowledge:** batch6 (thermistor voltage, evap fan feedback, IPM, FZ defrost 63 Ω) + batch29 (FF defrost, damper, ice pipe)

Cross-reference: [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md) (RS28 newer manual — shared voltage/fan patterns).

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| RF260* | RF260BEAESR/AA, RF260BEAEBC/AA |
| RF261* | RF261BEAESR/AA, RF261BEAEBC/AA |

Make: **Samsung** only. Template: `refrigerator`.

---

## 2. Service modes (§4-1-1, §4-1-3)

| Mode | Entry |
|------|-------|
| **Test mode** (manual operation / forced defrost) | **Power Freezer + Fridge** keys simultaneously **8 s** → all displays off → press any key to cycle FF → OF-r → rd (R defrost) → fd (F+R defrost) |
| **Self-diagnostic** | **Power Freezer + Power Fridge** keys **8 s** during normal operation → ding-dong → error LEDs blink 30 s |
| **Load condition display** | Power Freezer + Power Fridge **6 s** → Fridge key → load LEDs blink |
| **Cancel test** | Power cycle, or during fd defrost press key again to exit |

Manual operation runs compressor + F-fan 24 h at FF -8°F / FZ 34°F setpoints. Alarm beeps continuously until canceled.

---

## 3. Communication / option errors (§4-1-2)

| Display | Meaning | Procedure |
|---------|---------|-----------|
| **Pc-Er** | Panel ↔ MAIN MICOM comm error (0.5 s ALL ON/OFF) | Panel communication |
| **OP-Er** | Panel ↔ MAIN MICOM option error | Option error |

---

## 4. Self-diagnostic checklist (§4-1-3)

| LED item | Test point | Spec | Procedure ID |
|----------|------------|------|--------------|
| FZ-Sensor | CN30-4 ↔ CN76-1 | 4.5→1.0 V | `samsungrf260b-fz-sensor` |
| FF-Sensor | CN30-5 ↔ CN76-1 | 4.5→1.0 V | `samsungrf260b-ff-sensor` |
| FZ-DEF-Sensor | CN30-5 ↔ CN76-1 | 4.5→1.0 V | `samsungrf260b-fz-def-sensor` |
| FF-DEF-Sensor | CN30-8 ↔ CN76-1 | 4.5→1.0 V | `samsungrf260b-ff-def-sensor` |
| Ambient | CN78-8 ↔ CN78-12 | 4.5→1.0 V | `samsungrf260b-ambient-sensor` |
| Pantry | CN78-9 ↔ CN76-1 | 4.5→1.0 V | `samsungrf260b-pantry-sensor` |
| Humidity | CN30-3 ↔ CN76-1 | 4.5→1.0 V | `samsungrf260b-humidity-sensor` |
| Ice maker (F) sensor | CN90-8 ↔ CN90-9 | 4.5→1.0 V | `samsungrf260b-ice-maker-sensor` |
| FZ-FAN | CN76-3 ↔ CN76-1 | 7–12 V | `samsungrf260b-fz-fan` |
| FF-FAN | CN76-4 ↔ CN76-1 | 7–12 V | `samsungrf260b-ff-fan` |
| C-FAN | CN76-5 ↔ CN76-1 | 7–12 V | `samsungrf260b-c-fan` |
| FZ-DEF heater | CN70 Brown ↔ Gray | **63 Ω ±7%** | `samsungrf260b-fz-defrost-heater` |
| FF-DEF heater | CN70 White ↔ Gray | **120/440 Ω ±7%** | `samsungrf260b-ff-defrost-heater` |
| Ice maker function | Replace + verify | functional | `samsungrf260b-ice-maker-function` |
| Pc-Er | Panel harness | oscilloscope / replace | `samsungrf260b-panel-communication` |
| OP-Er | Option mismatch | panel + main PCB | `samsungrf260b-option-error` |

§4-2-4 alternate heater pins: F-DEF CN70-3 Brown ↔ CN72-3 Gray **63 Ω**; R-DEF CN70-1 White ↔ CN72-3 Gray **120 Ω**.

---

## 5. Measurements

| Knowledge ID | Spec | Connector |
|--------------|------|-----------|
| `refrigeratorThermistorVoltage` | 4.5→1.0 V | CN30/CN76/CN78/CN90 per sensor |
| `refrigeratorEvapFanFeedbackVoltage` | 7–12 V | CN76-x ↔ CN76-1 |
| `refrigeratorInverterIpmVoltage` | >13.5 V DC | IPM / compressor start path |
| `samsungRefrigeratorDefrostHeaterOhms` | 63 Ω ±7% | CN70 Brown ↔ Gray (FZ) |
| `samsungRf260bFfDefrostHeaterOhms` | 120 Ω @115 V / 440 Ω @230 V ±7% | CN70 White ↔ Gray |
| `samsungRf260bDamperHeaterOhms` | 135 Ω ±7% | CN77 Black ↔ Brown |
| `samsungRf260bIcePipeHeaterOhms` | 102 Ω ±7% | CN79 Yellow ↔ Pink |

---

## 6. Procedure index (generated)

| ID | OEM | Tags |
|----|-----|------|
| `samsungrf260b-fz-sensor` | §4-1-3 | thermistor, sensor_check |
| `samsungrf260b-ff-sensor` | §4-1-3 | thermistor, sensor_check |
| `samsungrf260b-fz-def-sensor` | §4-1-3 | thermistor, defrost |
| `samsungrf260b-ff-def-sensor` | §4-1-3 | thermistor, defrost |
| `samsungrf260b-ambient-sensor` | §4-1-3 | thermistor, sensor_check |
| `samsungrf260b-pantry-sensor` | §4-1-3 | thermistor, sensor_check |
| `samsungrf260b-humidity-sensor` | §4-1-3 | thermistor, sensor_check |
| `samsungrf260b-ice-maker-sensor` | §4-1-3 | ice_maker, thermistor |
| `samsungrf260b-fz-fan` | §4-1-3 | evap_fan, airflow |
| `samsungrf260b-ff-fan` | §4-1-3 | evap_fan, airflow |
| `samsungrf260b-c-fan` | §4-1-3 | evap_fan, condenser_fan, airflow |
| `samsungrf260b-fz-defrost-heater` | §4-1-3 | defrost_heater, frost_buildup |
| `samsungrf260b-ff-defrost-heater` | §4-1-3 | defrost_heater, frost_buildup |
| `samsungrf260b-ice-maker-function` | §4-1-3 | ice_maker, no_ice |
| `samsungrf260b-panel-communication` | §4-1-2 | Pc-Er, hmi_check |
| `samsungrf260b-option-error` | §4-1-2 | OP-Er, hmi_check |

**Bundle:** `samsungrf260b-test-mode-entry` (§4-1-1 Power Freezer + Fridge 8 s)

---

## 7. Pipeline

```bash
python backend/scripts/generate_samsung_rf260b_fridge_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

WO smoke: RF260BEAESR + Samsung → `samsung_sxs`; frost complaint → `samsungrf260b-fz-defrost-heater`.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/samsung frdige rf260b.pdf"`*
