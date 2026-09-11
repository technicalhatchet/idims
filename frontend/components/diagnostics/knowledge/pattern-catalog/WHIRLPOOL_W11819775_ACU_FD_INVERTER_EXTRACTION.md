# Whirlpool ACU inverter French door — W11819775 extraction

**Source:** `backend/docs/manuals/technical-manual-w11819775-revb 2026 frenchdoor.pdf`  
**Scope:** 36 in 31 cu ft French door; built-in inverter ACU (CN* connectors); side UI service diagnostics.  
**Platform:** `whirlpool_acu_fd_inverter` — **new** (not `whirlpool_ka_french_door`).

## Platform decision vs W11509412 (KA)

| Factor | W11509412 KA | W11819775 |
|--------|--------------|-----------|
| Board | ACU P1/P5/P8 | ACU **CN20/CN6/CN4/CN18** |
| Compressor | EMD55CLT relay 5.3/7.7 Ω | **Inverter 11.7 Ω, 150 VAC U/V/W** |
| Thermistors | 2700 Ω @ 77°F | **2k Ω cabinet; 5k IM tray** |
| Defrost | 36.2 Ω + bimetal test 6 | **58 Ω; test 38 only** |
| Service tests | 1–6, 19, 36–59; SW1+SW2 entry | **01/03–07/10/23–28/38/40–46**; Ref+Frz+Mode ×3 |
| Ice maker | E0–E5 via test 56 | **FBEB/FBEC + Lock/Mode IM test** |

**Verdict:** Separate platform — pinout, specs, test numbering, and UI entry differ materially from KA ACU.

## Service tests (captured)

| Test | Function |
|------|----------|
| 01 | RC thermistor °C |
| 03 | FC thermistor |
| 04 | Flipper mullion thermistor |
| 05 | FC evap thermistor |
| 07 | IM tray thermistor |
| 10 | RH sensor % |
| 23 | Compressor speed ramp 0–4500 rpm |
| 25 | RC damper cycle |
| 27 | FC evap fan PWM |
| 28 | Condenser fan PWM |
| 38 | Defrost heater 5 min / 60°F |
| 40 | Vertical mullion heater |
| 41 | Forced defrost (exit SM to run) |
| 43–46 | Door switches |

## Fault codes

F3E1 RC thermistor; F3E2 FC; F3E4 FC evap; F3E8 RH; F3E9 ambient; F3EC mullion; F4E1 defrost; F6E1 comm; FBEB IM tray; FBEC IM malfunction.

## Measurements (batch47)

- `whirlpoolAcuFdInverterThermistorOhms` — 2k NTC
- `whirlpoolAcuFdInverterImTrayThermistorOhms` — 5k NTC
- `whirlpoolAcuFdInverterDefrostHeaterOhms` — 58 Ω
- `whirlpoolAcuFdInverterCompressorOhms` — 11.7 Ω
- `whirlpoolAcuFdInverterMullionHeaterOhms` — 11.4 Ω

## Procedures (13 + 2 bundles)

Generator: `backend/scripts/generate_w11819775_acu_fd_inverter_procedure_seeds.py`

**Deferred:** Diagram crops (CN pinout pages available); auto-test mode N/A on this manual.
