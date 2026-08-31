# Samsung SxS refrigerator service manual extraction

**Source:** `backend/docs/manuals/samsung-refrigerator-sxs-svc manual.pdf` (128 pp., RS28T5B** dispenser SxS)  
**Extracted text:** `backend/docs/manuals/samsung-refrigerator-sxs-svc manual-extracted.txt`  
**Scope:** Brand-agnostic refrigeration troubleshooting + Samsung-specific harness/voltage tables.  
**Status:** Phase A + B + C merged (DMA, fields, measurements, evidence, elimination, chip routing).

Cross-reference: [INVENTORY_REFRIGERATOR.md](./INVENTORY_REFRIGERATOR.md), [SAMSUNG_DRYER_MANUAL_COMPARISON.md](./SAMSUNG_DRYER_MANUAL_COMPARISON.md) (methodology).

---

## 1. Universal pre-service checklist

| Check | Why it matters | Solomon field |
|-------|----------------|---------------|
| **Cooling Off / demo** | Compressor off, fans on — mimics sealed-system death | `commonly_missed.cooling_off_ruled_out`, chip `cooling_off` |
| **High voltage on inverter PCB** | DC bus to 310 V — shock risk | field help on `inverter_ipm_voltage` |
| **Force Run caution** | Comp starts without 7-min delay | guidance only |
| **Door-open fan behavior** | F-fan stops with door open; 1-min delay after close | `functional_checks.door_switch` |
| **Condenser / toe-kick airflow** | Heat rejection failure → warm freezer first | `commonly_missed.condenser_cleanliness` |
| **Disconnected ohms / voltage** | Accurate thermistor & heater tests | measurement fields |
| **ESD on boards** | Intermittent 41E/44E comm | `fans_and_electrical.board_notes` |

**Quick service concept:** Test mode (Fridge + Power Cool 6 s) → load display → self-diagnosis LED blink → pin voltage vs §4-2 table.

---

## 2. Complaint → cause routing

| Symptom cluster | Manual § | Priority causes | Chips | Gap closed |
|-----------------|----------|-----------------|-------|------------|
| Not cooling / warm | 5-1, 5-8 | Cooling Off; supply; inverter; defrost; sealed system | `not_cooling`, `cooling_off` | Demo elimination |
| Weak FF only | 5-6, damper | Damper RD; C-fan 22C; defrost; FF gasket | `weak_cooling_ff` | Damper evidence |
| Weak FZ / both warm | 5-8 | Condenser; inverter; sealed system | `weak_cooling_fz` | IPM voltage |
| Frost / no defrost | 5-2 | F-DEF sensor 5E; heater 63 Ω; bimetal | `frost_buildup` | Samsung heater band |
| Error on display | 4-2 | Per-code pin tests | `error_code` | 27 DMA rows + keywords |
| Door alarm | 5-4 | Door ajar; reed switch; gasket | `door_alarm` | **new chip** |
| Panel dead / keys | 5-5, 5-9 | Hinge LVDS; 21E; 41E | `display_dead` | **new chip** |
| Ice / water | 9-2 | Ice pipe 33E; 40E fan; fill tube | `ice_maker`, `water_dispenser` | 33E/40E rules |

---

## 3. Error codes (service LED + consumer)

### 3.1 Service LED checklist (§4-2)

| LED / item | Test | Consumer code |
|------------|------|---------------|
| F-Sensor | CN20 1–3, 4.5→1.0 V | — |
| R-Sensor | CN20 2–4 | **8E** |
| F-DEF-Sensor | CN20 5–7 | **5E/SE** |
| Ambient | CN40 18–20 | — |
| Ice maker sensor | CN90 11–13 | — |
| Humidity | CN40 14–20 | **14E** |
| F-FAN | CN20 15–17, 7–12 V | **22E** |
| C-FAN | CN20 22–24, 7–12 V | **22C** |
| F-DEF heater | 63 Ω ±7% CN70/CN85 | frost path |
| Damper heater | CN40 25–27, 7–12 V | **RD** |
| Ice pipe heater | CN90 1–5, 7–12 V | **33E** |
| 41Er | Main ↔ display | **41E** |
| 44Er | Main ↔ inverter | **44E** |
| 46Er | I/O expander | **46E** |
| 47Er | Dispenser panel | **47E** |
| 52Er | WiFi module | **52E** |
| Comp protect | IPM blink §5-8 | **84C/86E** |
| Cooling Off | O FF / Lock key | **O FF** |

### 3.2 DMA seed

`backend/data/dma_error_codes_seed.json` — **27** Samsung `refrigerator` rows (enriched + 44E–52E, 21E, 8E, 14E).

---

## 4. Measurement specifications

| Knowledge ID | Spec | Field binding |
|--------------|------|---------------|
| `refrigeratorThermistorVoltage` | 4.5→1.0 V warm→cold | `fans_and_electrical.thermistor_voltage_v` |
| `refrigeratorEvapFanFeedbackVoltage` | 7–12 V BLDC feedback | `fans_and_electrical.evap_fan_feedback_voltage` |
| `refrigeratorInverterIpmVoltage` | >13.5 V DC | `fans_and_electrical.inverter_ipm_voltage` |
| `samsungRefrigeratorDefrostHeaterOhms` | 63 Ω ±7% | `defrost_circuit.defrost_heater_ohms` (note) |
| `defrostHeaterOhms` | Widened 15–75 Ω generic + Samsung note | same |
| `cabinetThermistorOhms` | 5–16 kΩ room (registry normalize) | thermistor fields |
| Full kΩ tables | pp. 94–95 DATA1 | manual archive only |

---

## 5. Phase B — fields added

| Field | Type | Purpose |
|-------|------|---------|
| `commonly_missed.cooling_off_ruled_out` | check | Exit demo before sealed-system work |
| `functional_checks.door_switch` | yn | Reed 5 V open / 0 V closed |
| `functional_checks.fans_on_compressor_off` | yn | Demo pattern detector |
| `functional_checks.display_panel` | gb | UI response |
| `fans_and_electrical.thermistor_voltage_v` | text | Board-side NTC voltage |
| `fans_and_electrical.evap_fan_feedback_voltage` | text | F/C-fan feedback |
| `fans_and_electrical.inverter_ipm_voltage` | text | Inverter DC bus |

**Chips added:** `cooling_off`, `door_alarm`, `display_dead` (+ existing `error_code`).

---

## 6. Phase C — evidence & elimination

### Components added (8)

`inverter_board`, `damper_motor`, `door_switch`, `display_panel`, `dispenser_panel`, `ice_maker_module`, `ice_pipe_heater`

### Evidence rules added (~30)

Prefixes: `ref_kw_*` (error keywords), `ref_ms_*` (multi-signal / measurements), `chip_*` (complaint boosts).

Highlights:
- Cooling Off confirm when fans-on-comp-off
- Full Samsung comm code keyword routing (41E–52E, 21E, PC ER)
- Damper + weak FF multi-signal
- Thermistor / fan feedback / IPM measurement confirms

### Elimination

New hypotheses: `cooling_off_active/cleared`, `damper_ok/failed`, `inverter_ok/failed`, `door_switch_ok/failed`.

Engine update: elimination rules support **AND** arrays in `when` (matches electric dryer pattern).

---

## 7. Implementation phases (completed)

1. **Phase A** — PDF extract, DMA 27 rows, extraction doc, routing tokens  
2. **Phase B** — Template fields, chips, visibility, measurements batch6, field guidance  
3. **Phase C** — Components, ~30 evidence rules, elimination expansion  

### Follow-ups (not in scope)

- Inverter LED blink count → structured field  
- Force Run / Force Defrost keystrokes in UI  
- Full thermistor kΩ lookup tool from DATA1 table  
- Whirlpool/LG fridge manual crosswalk  

---

## 8. Re-seed & verify

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/samsung-refrigerator-sxs-svc manual.pdf"`*
