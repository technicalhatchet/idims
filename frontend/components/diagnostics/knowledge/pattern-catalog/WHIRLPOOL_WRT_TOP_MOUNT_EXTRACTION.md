# Whirlpool WRT top-mount refrigerator job aid extraction

**Source:** `backend/docs/manuals/w10330404-r-111.pdf` (91 pp., Job Aid W10330404 R-111)  
**Extracted text:** `backend/docs/manuals/w10330404-r-111-extracted.txt` (PyMuPDF — text-heavy, not scan-heavy)  
**Scope:** Whirlpool / Maytag / Amana 14–22 cu.ft. top-mount refrigerators (WRT, W8T, W4T families). Component-level diagnostics — mechanical defrost timer, ADC, PTC start, modular ice maker.  
**Status:** Phase A + B + C merged (DMA enrich, fields, measurements batch10, evidence, routing).

Cross-reference: [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md), [LG_LRMVS3006S_EXTRACTION.md](./LG_LRMVS3006S_EXTRACTION.md), [WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md](./WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md) (electronic-display codes).

**Follow-up manual (model-specific):** [WRT311FDZT00_W10674984_EXTRACTION.md](./WRT311FDZT00_W10674984_EXTRACTION.md) — ADC 2000 wiring sheet (WRT311* heater 30–42 Ω, voltage test points).

---

## 1. Universal pre-service checklist

| Check | Why it matters | Solomon field |
|-------|----------------|---------------|
| **Cold control not OFF** | Unit will not cool at all | `commonly_missed.cold_control_not_off` |
| **Defrost in progress** | Normal 20-min pause; recheck in 30 min | `functional_checks.defrost_cycle_observed` |
| **Heavy warm load / hot room** | Long run times mimic failure | `temperature_checks.ambient_room_temp`, chip `running_often` |
| **Door opening / packaging** | Frost and long run | `commonly_missed.door_alignment`, `gasket_sealing` |
| **Static vs forced-air condenser** | Static = no condenser fan; poor airflow at rear | `visual_inspection.condenser_condition` |
| **Power disconnected for Ω tests** | Safety + accurate readings | field guidance on defrost/compressor fields |

**Platform:** `whirlpool_wrt_top_mount` — model patterns `WRT`, `W8T`, `W4T`, `MRT`, `ART`.

---

## 2. Complaint → cause routing

| Symptom cluster | Manual § | Priority causes | Chips | Gap closed |
|-----------------|----------|-----------------|-------|------------|
| Not cooling | §8-2 | Control OFF; defrost cycle; PTC/OL; sealed system | `not_cooling` | `cold_control_not_off` field |
| Runs too much | §8-1, §8-2 | Warm load; hot room (>100°F); door openings | `running_often` | New chip |
| Frost / no defrost | §4 | Heater Ω; bimetal; timer/ADC | `frost_buildup` | WRT heater/bimetal batch10 |
| Compressor won't start | §5 | PTC open; overload; locked rotor | `compressor_wont_start` | PTC Ω field + routing |
| No ice | §6 | IM thermal fuse; water valve 30–120 PSI | `ice_maker` | IM fuse measurement |
| Error on display | — (not in this manual) | Use existing E0–F9 / RD / DF DMA | `error_code` | Enriched E3/F3, RD, DF |

---

## 3. Error codes / service tags

This job aid has **no consumer flash-code table**. Electronic WRT models may still show Whirlpool E/F-series codes (existing 19 DMA rows).

### Enriched existing DMA rows

| Code | Update |
|------|--------|
| **RD** | WRT heater ~30 Ω installed / ~33 Ω uninstalled |
| **DF** | Heater + bimetal + timer/ADC path |
| **E3 / F3** | Bimetal vs thermistor by platform |

### New service-concept DMA rows (+5)

| Code | Meaning | Test focus |
|------|---------|------------|
| **PTCOPEN** | PTC start device failed | ~5 Ω cold → 100kΩ+ hot; 10 min cool-down |
| **OL** | Compressor overload open | Cool-down; PTC + windings |
| **IMFUSE** | Ice maker harness fuse | 0 Ω closed |
| **TIMER** | Defrost timer contacts | 1-2 / 1-4 cool vs defrost |
| **CONTROLOFF** | Cold control at OFF | Customer setting |

---

## 4. Measurement specifications

| Knowledge ID | Spec | Field binding |
|--------------|------|---------------|
| `whirlpoolWrtDefrostHeaterOhms` | ~30 Ω installed / ~33 Ω uninstalled | `defrost_circuit.defrost_heater_ohms` |
| `whirlpoolWrtDefrostBimetalOhms` | <1 Ω closed when frosted (<40°F) | `defrost_circuit.defrost_thermostat` |
| `whirlpoolWrtPtcStartOhms` | ~5 Ω cold | `compressor_sealed_system.ptc_start_ohms` |
| `whirlpoolWrtCondenserFanOhms` | ~700 Ω shaded pole | (reference — no dedicated template field) |
| `whirlpoolWrtIceMakerThermalFuseOhms` | 0 Ω closed | ice maker harness test |

**Defrost timer contact cheat sheet (mechanical timer only):**

| Mode | 1–2 | 1–4 |
|------|-----|-----|
| Cool | 0 Ω | OL |
| Defrost | OL | 0 Ω |

~8 hr run / ~20 min defrost (continuous timer); cumulative timer ties to compressor run time.

---

## 5. Phase B — fields & chips

**Fields added:**

| Field | Type | Purpose |
|-------|------|---------|
| `commonly_missed.cold_control_not_off` | chk | Control not at OFF |
| `defrost_circuit.defrost_timer_test` | text | Timer contact states |
| `compressor_sealed_system.ptc_start_ohms` | text | PTC cold resistance |

**Chips added:** `running_often`, `compressor_wont_start`  
**Keywords extended:** `error_code` chip — RD, DF, PTC, IM FUSE, TIMER, CONTROL OFF

**Routing:** `routingEngine.ts` — Whirlpool WRT token block after LG refrigerator section.

---

## 6. Phase C — evidence

### Evidence rules added (~10)

Prefixes: `ref_ms_wp_wrt_*` (measurements), `ref_kw_wp_*` (keywords).

Highlights:
- WRT defrost heater / bimetal / PTC / IM fuse measurement confirms
- RD / DF / PTC / IM FUSE / CONTROL OFF keyword routing
- Frost + open heater multi-signal

### Elimination

- `wrt_heater_*`, `wrt_bimetal_*` measurement rules
- `wrt_cold_control_off` when cold control checkbox unchecked

---

## 7. Captured vs gaps

### Captured

- Defrost heater, bimetal, timer contact logic, ADC note (ESD)
- PTC start device cold/hot behavior
- Compressor winding ID procedure
- Condenser fan ~700 Ω (shaded pole); stepper = no ohm test
- Ice maker thermal fuse + water valve 30–120 PSI
- §8 symptom troubleshooting (warm load, door, OFF control, defrost pause)
- Wiring diagram references (W8TXNWMWQ ADC, W4TXNWFWQ timer)

### Gaps (not in W10330404)

| Gap | Follow-up |
|-----|-----------|
| Model-specific thermistor Ω tables | Not on W10674984 wiring sheet — separate tech sheet if needed |
| Electronic display E0–F9 pin-level tests | French-door tech sheets / separate manual |
| Modular ice maker full test procedure (harvest, service test 56) | [WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md](./WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md) |
| Inverter / variable-capacity compressor | §5-7 overview only — no WRT pinouts |
| Evaporator fan Ω (stepper vs shaded pole) | Functional test only for stepper |
| Cabinet thermistor R/T for ADC models | Per-model tech sheet |

---

## 8. Re-seed & verify

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
cd frontend && npx tsc --noEmit
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/w10330404-r-111.pdf"`*
