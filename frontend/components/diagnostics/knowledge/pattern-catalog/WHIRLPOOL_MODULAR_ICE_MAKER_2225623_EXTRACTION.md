# Whirlpool modular ice maker 2225623 service sheet extraction

**Source:** `backend/docs/manuals/whirlpoolmodularicemakerservicesheet-2225623.pdf` (2 pp., image scan)  
**Extracted text:** `backend/docs/manuals/whirlpoolmodularicemakerservicesheet-2225623-extracted.txt` (manual transcription — PyMuPDF 0 chars)  
**Scope:** Company-wide **modular ice maker** (part 2225623, 120 V) — Whirlpool, Maytag, KitchenAid, Amana top-mount, SxS, and French-door units using this module.  
**Status:** Phase A + B + C merged (DMA IME2–IME5, batch12 measurements, `ice_maker_diagnostics` fields, evidence, elimination, routing).

Cross-reference: [WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md](./WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md) (test 56 E0–E5 display semantics), [WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md](./WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md) (IM fuse in §6).

**Platform:** `whirlpool_modular_ice_maker` — brand-wide (no model pattern); fields show on `ice_maker` complaint chip.

---

## 1. Module test points

Stamped on circuit module: **L, N, M, T, H, V** (3 Phillips screws for removal).

| Points | Component | Unpowered Ω | Powered (line V = ON) |
|--------|-----------|-------------|------------------------|
| L–N | Module power | — | Power OK vs no power |
| T–H | Bimetal | — | Open vs closed (0 V) |
| L–H | Mold heater | **72 Ω** (on support) | Heater ON vs OFF |
| L–M | Motor | **8800 Ω** (off support) | Motor ON vs OFF |
| N–V | Water valve | — | Fill ON vs OFF |

**Service notes:** Ejector blades in park for Ω tests; do not manually start cycle — initiate electrically only; align "D" coupling on reinstall.

---

## 2. Specifications

| Item | Spec |
|------|------|
| Mold heater | 185 W @ 120 V → **72 Ω** L–H |
| Motor | 1.5 W → **8800 Ω** L–M (disconnected from support) |
| Bimetal | Closes ≤17°F ±3°; opens 32°F ±3° |
| Water fill | **140 cc / 7.5 sec** |
| Fill adjustment | CW **decreases** fill; ½ turn ≈ 20 cc; max 1 turn |

---

## 3. Error codes (test 56 — electronic models)

Modular sheet has no flash codes; French-door UI shows these during **service test 56**:

| Code | Meaning | 2225623 test focus |
|------|---------|-------------------|
| E2 / IME2 | Motor home not found | L–M 8800 Ω; cam coupling |
| E3 / IME3 | Mold heater time-out | L–H 72 Ω; T–H bimetal; IMFUSE |
| E4 / IME4 | Dry cycle — no water | N–V valve; fill 140 cc / 7.5 s |
| E5 / IME5 | Thermistor fault | Electronic models; modular uses bimetal T–H |

**DMA:** New Whirlpool + KitchenAid `refrigerator` rows `IME2`–`IME5`; enriched `IMFUSE` fix text.

---

## 4. Measurement knowledge (batch12)

| Knowledge ID | Spec | Field binding |
|--------------|------|---------------|
| `whirlpoolModularIceMakerMoldHeaterOhms` | 72 Ω L–H | `ice_maker_diagnostics.mold_heater_ohms` |
| `whirlpoolModularIceMakerMotorOhms` | 8800 Ω L–M | `ice_maker_diagnostics.motor_ohms` |
| `whirlpoolModularIceMakerBimetalOhms` | Continuity cold | `ice_maker_diagnostics.bimetal_continuity` |
| `whirlpoolModularIceMakerHarnessFuseOhms` | 0 Ω closed | `ice_maker_diagnostics.harness_fuse_ohms` |

Voltage fields: `module_power_v`, `bimetal_voltage_state`, `heater_voltage_state`, `motor_voltage_state`, `valve_voltage_state`, `fill_adjustment_turns`, `ice_maker_notes`.

---

## 5. Complaint routing

| Symptom | Priority causes | Chips / tokens |
|---------|-----------------|----------------|
| No ice / no harvest | Motor open; heater open; fuse; valve; fill tube | `ice_maker` |
| Small / hollow cubes | Fill adjustment CW; low pressure | `ice_maker`, fill fields |
| Test 56 E2–E5 | See table §3 | `error_code`, routing tokens |

---

## 6. Captured vs gaps

### Captured

- Full L/N/M/T/H/V test-point matrix (Ω + live voltage)
- Mold heater 72 Ω, motor 8800 Ω, bimetal temps, fill 140 cc / 7.5 s
- Fill adjustment direction and cc-per-turn
- Module removal / cover / cam alignment notes
- DMA IME2–IME5 + IMFUSE enrichment
- Solomon `ice_maker_diagnostics` section + batch12 + evidence/elimination

### Gaps

| Gap | Notes |
|-----|-------|
| Harvest service test entry (jumper / UI test 57–59) | French-door platform doc only — not on 2-page modular sheet |
| Optics / feeler arm / shut-off arm diagnostics | Not on this sheet |
| In-door or dual ice maker variants | Different modules — not 2225623 |
| OCR / vector layer | Pure scan — transcription in `-extracted.txt` |

---

## 7. Re-seed & verify

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
cd frontend && npx tsc --noEmit
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

*Regenerate PDF meta: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/whirlpoolmodularicemakerservicesheet-2225623.pdf"`*
