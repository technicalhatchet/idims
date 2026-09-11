# Samsung RF28 French-door refrigerator — extraction

**Source:** `backend/docs/manuals/samsung rf28 fddeli.pdf`  
**Extracted text:** `backend/docs/manuals/samsung rf28 fddeli-extracted.txt`  
**Manual ID:** `SAMSUNG-RF28-FRIDGE`  
**Platform:** `samsung_fridge_rf28`  
**Template:** `refrigerator`  
**Knowledge batch:** 44  
**Status:** Procedure seeds generated + ASC20170602002 frozen ice room bulletin (2 procedures)

**Bulletin:** [SAMSUNG_ICE_MAKER_BULLETIN_EXTRACTION.md](./SAMSUNG_ICE_MAKER_BULLETIN_EXTRACTION.md) — `samsungrf28-ice-room-frozen-prep`, `samsungrf28-ice-room-frozen-service`

---

## Models

| Pattern | Examples / notes |
|---------|------------------|
| `RF28R*` | RF28R7201SR/AA, RF28R8211SR/AA — 28 cu ft French door + external dispenser |
| `RF28*` | Broader RF28 family (confirm suffix for region: `/AA`, `/SA`, `/EU`) |

**Not on this platform:** `RF23BB*`, `RF32CG*` → `samsung_fridge_bespoke`; `RF260*` → `samsung_sxs`.

Compressor: BLDC inverter (NF54M7151AN). Refrigerant R600a. Flex Zone + fridge ice maker (FF).

---

## Service mode entry (§4-1-1, §4-1-2, §4-1-3)

### Test mode (manual operation / forced defrost)

1. Press **Fridge** + **FlexZone** simultaneously ≥6 s — display blinks 0.5 s interval.
2. Release and press **FlexZone** to enter Test Mode.
3. Within 15 s, press any key to cycle: `FF` (manual op 1) → `OF r` (manual op 2) → `rd` (R defrost) → `Fd` (F+R defrost) → cancel (all off).
4. Manual operation runs comp + F-fan 24 h; alarm beeps until complete. Power cycle cancels.

### Self-diagnostic function

1. During normal operation: **Fridge** + **FlexZone** ≥6 s — temp display blinks 4 s.
2. Continue holding to **10 s total** (includes 6 s phase) → ding-dong → fault LEDs display 30 s.
3. Clear errors: fix sensor or hold **Fridge** + **FlexZone** 10 s.
4. At power-on: bad sensor blinks applicable LED 0.5 s (no beep).

### Load condition display (§4-1-3)

1. **Fridge** + **FlexZone** 6 s → all segments blink 4 s.
2. Press **Freezer** key → load condition mode (30 s). Only commanded loads blink — does not prove load actually runs.

### Option / demo

- `oP-Ch` repeats until option error cleared (§4-1-2).
- Demo mode 1: Cooling OFF (NA). Demo mode 2: Exhibition (non-NA).

---

## Self-diagnostic CHECK LIST (§4-1-2, pp. 56–61)

| LED | Item | Diagnostic method | Procedure ID |
|-----|------|-------------------|--------------|
| F | Freezer sensor | CN20 10↔12, 4.5–1.0 V | `samsungrf28-freezer-sensor` |
| R | Fridge sensor | CN20 9↔11, 4.5–1.0 V | `samsungrf28-fridge-sensor` |
| — | F-DEF sensor | CN20 6↔8, 4.5–1.0 V | `samsungrf28-freezer-defrost-sensor` |
| — | R-DEF sensor | CN20 5↔7, 4.5–1.0 V | `samsungrf28-fridge-defrost-sensor` |
| — | External air | CN60 3↔5, 4.5–1.0 V | `samsungrf28-ambient-sensor` |
| — | Flex-Zone | CN40 18↔20, 4.5–1.0 V | `samsungrf28-flex-sensor` |
| — | Humidity | CN60 3↔7, 4.5–1.0 V | `samsungrf28-humidity-sensor` |
| — | Ice maker (fridge) sensor | CN90 14↔24, 4.5–1.0 V | `samsungrf28-ice-maker-sensor` |
| — | Ice room sensor | CN90 2↔4, 4.5–1.0 V | `samsungrf28-ice-room-sensor` |
| F | F-FAN | CN20 16↔18, 7–12 V | `samsungrf28-freezer-fan` |
| R | Fridge fan | CN20 15↔17, 7–12 V | `samsungrf28-fridge-fan` |
| — | C-FAN | CN40 11↔13, 7–12 V | `samsungrf28-convertible-fan` |
| — | F-DEF heater | CN70 5 ↔ CN71_1 5, **63(230) Ω ±7%** | `samsungrf28-freezer-defrost-heater` |
| — | R-DEF heater | CN70 3 ↔ CN71_1 5, **120 Ω ±7%** | `samsungrf28-fridge-defrost-heater` |
| — | Flex damper heater | CN40 25↔27, **135 Ω ±7%** | `samsungrf28-damper-heater` |
| — | Ice room fan | CN20 22↔24, 7–12 V | `samsungrf28-ice-room-fan` |
| — | Fridge ice duct heater | CN20 21↔23, **63(230) Ω ±7%** | `samsungrf28-ice-duct-heater` |
| — | Fridge ice room heater | CN20 19↔23, **135 Ω ±7%** | `samsungrf28-ice-room-heater` |
| — | Ice maker function | Re-plug power; verify harvest | `samsungrf28-ice-maker-function` |
| — | Main ↔ Panel | Harness / scope | `samsungrf28-main-panel-comm` |
| — | Main ↔ Inverter | Harness / scope | `samsungrf28-main-inverter-comm` |
| — | Main ↔ Dispenser panel | Harness / scope | `samsungrf28-dispenser-panel-comm` |
| — | AUTO FILL overflow | CN90 11↔13: 0–4.5 V overflow | `samsungrf28-autofill-overflow` |
| — | Comp / IPM faults | Terminal shorts; IPM &lt;13.5 V | `samsungrf28-compressor-inverter` |

**Note:** CHECK LIST table OCR lists R-DEF heater on CN20 6↔8 at 120 Ω — flowchart §4-2-5 uses **CN70 3 ↔ CN71_1 5** for R-DEF heater and **CN20 5↔7** for R-DEF *sensor* resistance. Procedures follow §4-2-5 for heaters.

---

## Flowchart pin reference (§4-2)

| Sensor | Resistance pins | Voltage pins (to ground) |
|--------|-----------------|--------------------------|
| R | CN20 9↔11 | CN20 9 ↔ 11 pin |
| R-DEF | CN20 5↔7 | CN20 5 ↔ 7 pin |
| F | CN20 10↔12 | CN20 10 ↔ 12 pin |
| F-DEF | CN20 6↔8 | CN20 6 ↔ 8 pin |
| Flex (Mid) | CN40 18↔20 | CN40 18 ↔ 20 pin |
| Ambient | CN60 5↔16 | CN60 5 ↔ 16 pin |
| Humidity | CN60 7↔16 | CN60 7 ↔ 16 pin |
| Ice maker | CN90 14↔24 | CN90 14 ↔ 13 pin |
| Ice room | CN90 2↔4 | CN90 2 ↔ 13 pin |

Voltage normal: 0.6–4.6 V (4.5 V warm → 1.0 V cold).

---

## Complaint routing

| Symptom | Lead procedures |
|---------|-------------------|
| Not cooling | `compressor-inverter`, defrost heaters, fan procedures |
| Frost / no defrost | `freezer-defrost-heater`, `fridge-defrost-heater`, defrost sensors |
| Fan LED / weak airflow | `freezer-fan`, `fridge-fan`, `convertible-fan`, `ice-room-fan` |
| No ice (fridge IM) | `ice-maker-function`, `ice-maker-sensor`, `ice-duct-heater`, `ice-room-heater` |
| Dispenser / panel dead | `dispenser-panel-comm`, `main-panel-comm` |
| AutoFill overflow | `autofill-overflow` |

---

## Diagrams

PCB layout (p. 98–99) and block/wiring diagrams (p. 100–102) — **no strip-circuit crops** in manual; diagram attach deferred.

---

*Pipeline:* `python backend/scripts/generate_samsung_rf28_fridge_procedure_seeds.py`
