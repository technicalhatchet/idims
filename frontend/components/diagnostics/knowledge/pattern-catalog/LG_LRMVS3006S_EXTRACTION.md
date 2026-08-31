# LG LRMVS3006S refrigerator service manual extraction

**Source:** `backend/docs/manuals/Lg-lrmvs3006s-refrigerator-svc manual.pdf` (138 pp., LRMVS3006* InstaView 4-door French door)  
**Extracted text:** `backend/docs/manuals/Lg-lrmvs3006s-refrigerator-svc manual-extracted.txt` (PyMuPDF — image-heavy ManualsLib scan)  
**Scope:** Brand-agnostic refrigeration troubleshooting + LG-specific harness/voltage tables for linear-compressor R-600a platform.  
**Status:** Phase A + B + C merged (DMA, fields, measurements, evidence, routing).

Cross-reference: [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md) (methodology), [INVENTORY_REFRIGERATOR.md](./INVENTORY_REFRIGERATOR.md).

---

## 1. Universal pre-service checklist

| Check | Why it matters | Solomon field |
|-------|----------------|---------------|
| **Display / demo mode** | Panel shows OFF — all cooling disabled (lamp/UI only) | `commonly_missed.cooling_off_ruled_out`, chip `cooling_off` |
| **Error clear window** | Ice Plus + Freezer clears code within 3 h only | `customer_complaint.error_codes` guidance |
| **Test Mode access** | Main PCB test button — fans, damper, forced defrost | field help on `lg_fan_voltage`, `lg_defrost_heater_voltage` |
| **R-600a charge** | Flammable refrigerant — sealed-system precautions | guidance on CH/CL codes |
| **Condenser grille** | Blocked coils → E CF, warm cabinets | `commonly_missed.condenser_cleanliness` |
| **Manual defrost for F dH** | Heavy ice may need 1–3 day power-off defrost | `functional_checks.defrost_cycle_observed` |

**Quick service concept:** PCB test button ×1 (all loads) → ×2 (damper closed) → ×3 (forced defrost, display `33 33`) → pin voltage vs §8 flowcharts.

---

## 2. Complaint → cause routing

| Symptom cluster | Manual § | Priority causes | Chips | Gap closed |
|-----------------|----------|-----------------|-------|------------|
| Not cooling / warm | §8, §13 | Display mode OFF; E CF; defrost; sealed system CH/CL | `not_cooling`, `cooling_off` | LG demo elimination |
| Weak FF only | E rF | R-fan; iced air tower; gasket | `weak_cooling_ff` | rF evidence |
| Weak FZ / both warm | E FF, E CF | Condenser; sealed system | `weak_cooling_fz` | CF + CH/CL routing |
| Frost / no defrost | F/r dH, F/r dS | Heater Ω/V; defrost sensor | `frost_buildup` | LG heater bands batch7 |
| Error on display | §8 | Per-code flowcharts | `error_code` | **30** DMA rows |
| Ice / Craft Ice | E IF, E ID, E IU | Icing fan; tray sensor; I/M kit | `ice_maker` | IF/ID/IU rules |
| Panel / WiFi | E CO, E Od | Hinge CON101; ThinQ modem | `display_dead`, `error_code` | CO/Od rules |

---

## 3. Error codes (consumer display)

LG shows two-letter clusters, often prefixed with compartment (`F`, `r`) or `E`:

| Display | Meaning | Test focus |
|---------|---------|------------|
| **F dH** / **r dH** | Defrost heater failure | Test Mode 3: 112–116 V CON9; F heater 62–70 Ω, R heater 103–119 Ω |
| **F dS** / **r dS** | Defrost sensor | CON4 thermistor Ω tables §8-4/8-5 |
| **E FS** | Freezer temp sensor | CON4 pins 18–17 §8-1 |
| **E rS** | Fridge temp sensor | §8-2 |
| **E IS** | Icing room sensor | §8-3 |
| **E rF** | Refrigerator evap fan | CON3 28–25 = 11.4–12.6 V §8-8 |
| **E FF** | Freezer evap fan | CON3 16–13 §8-9 |
| **E IF** / **ER** | Icing fan | CON3 24–21 §8-10 |
| **E CF** | Condenser fan | CON3 12–9 §8-11 |
| **E CO** | Main ↔ display comm | CON101 12 V / 5 V §8-12 |
| **E CH** / **E CL** | Sealed-system leak cycle | UV leak §8-22 |
| **E CS** | Convert drawer sensor | Pantry thermistor §8-22 |
| **E Od** | WiFi modem comm | J1/J3 §8-20 |
| **E ID** | Ice tray sensor | Ice maker connector |
| **E IU** | Ice maker kit electrical | §8-24 |
| **OFF** / **O** | Display mode | Ice Plus ×3 + hold Fridge §13-1-15 |

### DMA seed

`backend/data/dma_error_codes_seed.json` — **30** LG `refrigerator` rows (replaced 4 incorrect legacy rows: ER/FF as warm temps, OFF/O generic).

---

## 4. Measurement specifications

| Knowledge ID | Spec | Field binding |
|--------------|------|---------------|
| `lgRefrigeratorFanVoltage` | 11.4–12.6 V Test Mode 1 | `fans_and_electrical.lg_fan_voltage` |
| `lgDefrostHeaterVoltage` | 112–116 V Test Mode 3 | `defrost_circuit.lg_defrost_heater_voltage` |
| `lgDefrostHeaterOhmsFreezer` | 62–70 Ω (F heater) | note on `defrost_circuit.defrost_heater_ohms` |
| `lgDefrostHeaterOhmsFridge` | 103–119 Ω (R heater) | same |
| `cabinetThermistorOhms` | kΩ tables §8-1–8-5 | thermistor fields |
| `defrostHeaterOhms` | Generic widened + LG note in registry | `defrost_circuit.defrost_heater_ohms` |

**CON3 fan pin cheat sheet (Test Mode 1, vs GND):**

| Fan | Pins | Expected V |
|-----|------|------------|
| F-fan | 16–13 | 11.4–12.6 |
| R-fan | 28–25 | 11.4–12.6 |
| C-fan | 12–9 | 11.4–12.6 |
| I-fan | 24–21 | 11.4–12.6 |

---

## 5. Phase B — fields & chips

Reuses Samsung-era refrigerator template fields (`cooling_off_ruled_out`, `door_switch`, `fans_on_compressor_off`, `display_panel`, thermistor/fan voltage fields).

**Fields added for LG:**

| Field | Type | Purpose |
|-------|------|---------|
| `fans_and_electrical.lg_fan_voltage` | text | BLDC fan supply in Test Mode 1 |
| `defrost_circuit.lg_defrost_heater_voltage` | text | Heater line voltage Test Mode 3 |

**Chips:** existing `error_code`, `cooling_off` — keywords extended for LG codes and display mode.

**Routing:** `routingEngine.ts` — LG token expansion block + `hasStructuredErrorCode` patterns for F/r dH, E FF, etc.

---

## 6. Phase C — evidence

### Evidence rules added (~22)

Prefixes: `ref_lg_kw_*` (LG error keywords), `ref_ms_lg_*` (measurements + multi-signal).

Highlights:
- Full §8 error code keyword routing (dH, dS, FF, rF, IF, CF, CO, CH, CL, FS, rS, IS, CS, Od, ID, IU)
- Display mode keyword → demo confirm
- Fan voltage + E FF multi-signal
- F dH + open F heater Ω multi-signal

Reuses existing elimination hypotheses (`cooling_off_active/cleared`) — LG OFF maps to same demo pattern.

---

## 7. Implementation phases (completed)

1. **Phase A** — PyMuPDF extract, DMA 30 rows, `extract_pdf.py` PyMuPDF preference, routing tokens  
2. **Phase B** — Template fields batch7, chip keywords, field guidance, fieldBindings  
3. **Phase C** — ~22 evidence rules, registry normalize notes  

### Follow-ups (not in scope)

- Structured Test Mode UI wizard (button press counter)  
- Full LG thermistor kΩ lookup from §8 tables  
- Craft Ice / InstaView door-specific harness diagrams  
- Cross-model LG fridge manual merge (other series codes)  

---

## 8. Re-seed & verify

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

```bash
cd frontend && npx tsc --noEmit
```
