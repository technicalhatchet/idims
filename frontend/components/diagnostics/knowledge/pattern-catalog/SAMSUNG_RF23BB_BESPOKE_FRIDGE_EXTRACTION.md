# Samsung Bespoke French-door refrigerator — RF23BB family extraction

**Source:** `backend/docs/manuals/samsung fridge rf23bb.pdf`  
**Extracted text:** `backend/docs/manuals/samsung fridge rf23bb-extracted.txt`  
**Platform:** `samsung_fridge_bespoke` (shared with RF32CG)  
**Template:** `refrigerator`  
**Knowledge batch:** 30 (bespoke-specific IDs)  
**Status:** Procedure seeds generated

---

## Models

| Pattern | Notes |
|---------|-------|
| `RF23BB*` | 4-door counter-depth digital inner display (RF23BB8**) |
| `RF24BB*` | 3-door counter-depth inner display |
| `RF29BB*` | 4-door full-size digital inner display |
| `RF30BB*` | 3-door full-size inner display |

---

## Service mode entry

### Inner display (RF24BB6**, RF30BB6**)

1. Press `<` + `>` simultaneously ≥6 s — display blinks 0.5 s interval.
2. Press `>` → **Engineer Mode**.
3. Select mode with `<`/`>` then `O`:
   - **1** = Test Mode (manual operation / forced defrost)
   - **3** = Self-diagnostic function
   - **7** = Load condition display
   - **9** = Option setting

### Digital inner display (RF23BB8**, RF29BB8**)

1. Press **Fridge** + **FlexZone** ≥6 s — display blinks.
2. Press **FlexZone** → **Test Mode** directly (no engineer menu on this path).
3. Self-diagnosis: Fridge + FlexZone held **10 s** (includes 6 s blink phase).

Test mode sequence per key press: `FF` → `FF r` → `FF F` → `FF A` → `Fd` (forced F/R defrost) → cancel.

---

## Self-diagnosis CHECK LIST (§5-1-2)

| LED | Item | Diagnostic method | Tags |
|-----|------|-------------------|------|
| F | Freezer sensor | CN20 10↔12, 4.5–1.0 V | `freezer_sensor` |
| R | Fridge sensor | CN20 9↔11, 4.5–1.0 V | `fridge_sensor` |
| — | F-DEF sensor | CN20 6↔8, 4.5–1.0 V | `defrost_sensor` |
| — | R-DEF sensor | CN20 5↔7, 4.5–1.0 V | `defrost_sensor` |
| — | External air | CN60 3↔5, 4.5–1.0 V | `ambient_sensor` |
| — | Flex-Zone (opt) | CN40 18↔20, 4.5–1.0 V | `flex_sensor` |
| — | Humidity | CN60 3↔7, 4.5–1.0 V | `humidity_sensor` |
| — | IM sensor cubed | CN90 14↔26, 4.5–1.0 V | `ice_maker_sensor` |
| — | IM sensor ice bites | CN90 2↔4, 4.5–1.0 V | `ice_maker_sensor` |
| F | F-FAN | CN20 16↔18, 7–12 V | `22E`, `evap_fan` |
| R | Fridge fan | CN20 15↔17, 7–12 V | `evap_fan` |
| — | C-FAN | CN40 11↔13, 7–12 V | `22C`, `evap_fan` |
| — | F-DEF heater | CN20 6↔8, **63(230) Ω ±7%** | `defrost_heater` |
| — | Flex damper heater | CN40 25↔27, **135 Ω ±7%** | `damper_heater` |
| — | Ice pipe cubed | CN20 19↔23, **72 Ω ±7%** | `ice_pipe_heater` |
| — | Ice pipe ice bites | CN20 21↔23, **72 Ω ±7%** | `ice_pipe_heater` |
| — | Main↔Panel | Harness / scope | `41E` |
| — | Main↔Inverter | Harness / scope | `44E` |
| — | I/O expander | Replace main PBA | `46E` |
| — | WiFi module | Harness / scope | `52E` |
| — | Comp start / IPM | Terminal shorts; IPM <13.5 V | `84C`, `compressor` |
| — | AutoFill overflow | CN90 11↔13: 0–4.5 V overflow | `autofill` |

---

## Procedure index (generated)

| ID | OEM ref | Focus |
|----|---------|-------|
| `samsungbespoke-freezer-sensor` | §5-1-2 | F sensor voltage |
| `samsungbespoke-fridge-sensor` | §5-1-2 | R sensor voltage |
| `samsungbespoke-freezer-defrost-sensor` | §5-1-2 | F-DEF NTC |
| `samsungbespoke-fridge-defrost-sensor` | §5-1-2 | R-DEF NTC |
| `samsungbespoke-ambient-sensor` | §5-1-2 | CN60 ambient |
| `samsungbespoke-flex-sensor` | §5-1-2 | Flex-Zone optional |
| `samsungbespoke-humidity-sensor` | §5-1-2 | CN60 humidity |
| `samsungbespoke-ice-maker-sensor` | §5-1-2 | CN90 IM sensors |
| `samsungbespoke-freezer-fan` | §5-1-2 | F-FAN feedback |
| `samsungbespoke-fridge-fan` | §5-1-2 | Fridge fan feedback |
| `samsungbespoke-convertible-fan` | §5-1-2 | C-FAN |
| `samsungbespoke-freezer-defrost-heater` | §5-1-2 | 63 Ω CN20 6–8 |
| `samsungbespoke-damper-heater-135` | §5-1-2 | 135 Ω CN40 |
| `samsungbespoke-ice-pipe-heater-72` | §5-1-2 | 72 Ω CN20 |
| `samsungbespoke-compressor-inverter` | §5-1-2 / §6-7 | IPM / comp faults |
| `samsungbespoke-main-panel-comm` | §5-1-2 | 41Er |
| `samsungbespoke-main-inverter-comm` | §5-1-2 | 44Er |
| `samsungbespoke-autofill-overflow` | §5-1-2 | CN90 overflow |

---

## Complaint routing

| Symptom | Lead procedures |
|---------|-------------------|
| Not cooling / warm FF or FZ | `compressor-inverter`, defrost heater, fan procedures |
| Frost / no defrost | `freezer-defrost-heater`, `freezer-defrost-sensor` |
| Fan error LED / 22E | `freezer-fan`, `fridge-fan`, `convertible-fan` |
| Ice maker fault | `ice-maker-sensor`, `ice-pipe-heater-72` |
| Display / comm codes | `main-panel-comm`, `main-inverter-comm` |
| AutoFill overflow | `autofill-overflow` |

---

*Pipeline:* `python backend/scripts/generate_samsung_fridge_bespoke_procedure_seeds.py`
