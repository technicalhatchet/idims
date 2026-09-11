# Samsung Bespoke French-door refrigerator — RF32CG family extraction

**Source:** `backend/docs/manuals/samsung fridge rf32cg.pdf`  
**Extracted text:** `backend/docs/manuals/samsung fridge rf32cg-extracted.txt`  
**Platform:** `samsung_fridge_bespoke` (shared with RF23BB)  
**Template:** `refrigerator`  
**Knowledge batch:** 30  
**Status:** Procedure seeds generated

---

## Models

| Pattern | Notes |
|---------|-------|
| `RF32CG*` | 4-door Bespoke (e.g. RF32CG5300SRAA) |
| `RF31CG*` | 4-door (e.g. RF31CG7200SRAA) |
| `RF26CG*` | 4-door (e.g. RF26CG7400SRAA) |
| `RF27CG*` | 3/4-door variants |

---

## Service mode entry

### Button UI (RF31CG7200, RF26CG7400)

1. **Fridge** + **--------** (dot line) ≥6 s → blink → press dot line → **Test Mode**.
2. Self-diagnosis cancel / run: Fridge + dot line **10 s**.

### Button UI (RF32CG5300)

1. **Fridge** + **AutoFill Pitcher** ≥6 s → blink → press AutoFill → **Test Mode**.
2. Self-diagnosis: Fridge + AutoFill **10 s**.

### Family Hub touch UI (§5-2)

1. Touch **A-B-A-B-A-B** within 3 s → Engineer mode popup.
2. Choose **Fridge Function Test** → Force Run / Self Diagnosis / Load condition.

Manual operation displays: `FF` → `FF F2` → `FF F1` → `FF A` → `Fd`.

---

## Self-diagnosis CHECK LIST (§5-1-2 / §5-2-2)

| LED | Item | Diagnostic method | Tags |
|-----|------|-------------------|------|
| F | F-Sensor | CN20 10↔12, 4.5–1.0 V | `freezer_sensor` |
| R | R-Sensor | CN20 9↔11, 4.5–1.0 V | `fridge_sensor` |
| — | F-DEF sensor | CN20 6↔8, 4.5–1.0 V | `defrost_sensor` |
| — | Ambient | CN40 18↔20, 4.5–1.0 V | `ambient_sensor` |
| — | Ice room sensor | CN40 18↔20, 4.5–1.0 V | `ice_room_sensor` |
| — | Humidity | CN40 14↔16, 4.5–1.0 V | `humidity_sensor` |
| — | IM sensor cubed | CN90 11↔13, 4.5–1.0 V | `ice_maker_sensor` |
| — | IM sensor fridge | CN90 11↔21, 4.5–1.0 V | `ice_maker_sensor` |
| F | F-FAN | CN20 16↔18, 7–12 V | `22E` |
| — | C-FAN | CN40 13↔15, 7–12 V | `22C` |
| — | Ice room fan | CN20 22↔24, 7–12 V | `ice_room_fan` |
| — | F-DEF heater (hi/lo) | CN70 5 ↔ CN81 1, **63(230) Ω ±7%** | `defrost_heater` |
| — | Damper heater | CN40 25↔27, **24 Ω ±7%** | `damper_heater` |
| — | Ice pipe cubed | CN20 19↔23, **24 Ω ±7%** | `ice_pipe_heater` |
| — | Fridge ice duct | CN90 1↔5, **63(230) Ω ±7%** | `ice_duct_heater` |
| — | Ice room heater | CN60 21↔23, **135 Ω ±7%** | `ice_room_heater` |
| — | Panel↔Main | pc-Er / 41Er | `41E` |
| — | Main↔Inverter | 44Er | `44E` |
| — | I/O expander | 46Er | `46E` |
| — | Dispenser panel | 47Er | `47E` |
| — | WiFi | 52Er | `52E` |
| — | Comp / IPM | Shorts; IPM <13.5 V | `compressor` |
| — | AutoFill overflow | CN90 11↔13 | `autofill` |

---

## RF32CG-specific procedures (vs RF23BB)

| ID | Delta from RF23BB |
|----|-------------------|
| `samsungbespoke-ice-room-fan` | CN20 22–24 feedback (new) |
| `samsungbespoke-damper-heater-24` | 24 Ω damper (not 135 Ω flex) |
| `samsungbespoke-ice-pipe-heater-24` | 24 Ω ice pipe (not 72 Ω) |
| `samsungbespoke-ice-duct-heater` | CN90 1–5, 63 Ω |
| `samsungbespoke-ice-room-heater` | CN60 21–23, 135 Ω |
| `samsungbespoke-freezer-defrost-heater` | CN70/CN81 path (same 63 Ω spec) |

Shared procedures cover thermistors, F-FAN, C-FAN (note pin change CN40 13–15), comm faults, compressor.

---

## Architecture decision

**Single platform `samsung_fridge_bespoke`** — both manuals share CN20/CN40 main PCB topology, inverter compressor, self-diagnosis LED checklist pattern, and 63/72/135 Ω heater families (RF32CG uses 24 Ω on damper/ice-pipe subsystems). UI entry differs (engineer mode keys vs Family Hub touch) — handled via service-mode bundles with `uiVariants`.

---

*Pipeline:* `python backend/scripts/generate_samsung_fridge_bespoke_procedure_seeds.py`
