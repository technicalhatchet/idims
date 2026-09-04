# Whirlpool Duet Sport front-load washer — 8178558 extraction

**Source:** `backend/docs/manuals/jobaid-8178558-l-78 whirlpool fl washer 2013 era.pdf` (96 pp., Job Aid L-78 / Part 8178558)  
**Extracted text:** `backend/docs/manuals/jobaid-8178558-l-78 whirlpool fl washer 2013 era-extracted.txt` (PyMuPDF — text-heavy)  
**Scope:** Duet Sport™ CCU + MCU belt-drive front-load — WFW8300SW, WFW8500SW, WFW8500SR and Duet Sport Ht variants.  
**Status:** Phase A + B + C merged (DMA F01/F06/F20–F31, batch13 measurements, evidence, routing).

Cross-reference: [WHIRLPOOL_W11169652_WASHER_EXTRACTION.md](./WHIRLPOOL_W11169652_WASHER_EXTRACTION.md) (27" direct-drive ACU — F#E# codes, different Ω specs).

**Platform:** `whirlpool_duet_sport` — model patterns `WFW83`, `WFW85`, `WFW92`, `WFW94`, `WFW95`.  
**Note:** `whirlpool_fl_dd` now requires `WFW`/`MHW`/`CHW` model match; Duet Sport takes priority on overlapping prefixes.

---

## 1. Pre-service checklist

| Check | Why it matters |
|-------|----------------|
| 120 V dedicated circuit | CCU/MCU sensitive to voltage drop |
| Hot + cold faucets open, 20–100 PSI | F20 if no fill in 6 min |
| HE detergent only | Sd oversuds → drain faults → F21 |
| Shipping bolts removed | F25 motor tach false faults |
| Drain hose height / siphon | F21 long drain, Sd on pressure |
| Door opened between cycles | F26 after 3 closed cycles |

---

## 2. Error codes (F/xx LED display)

Status lights flash; some models have no alphanumeric display — use LED chart §6-4.

| Code | Meaning | First test |
|------|---------|------------|
| **F01** | CCU EEPROM error | Power cycle 2 min |
| **F06** | MCU internal fault | Motor-MCU-CCU harness |
| **F20** | No water / pressure not tripped | Inlet 750–850 Ω; PR6 |
| **Sd** | Oversuds | HE detergent; rinse/spin |
| **F21** | Long drain (>8 min) | Pump ~12.3 Ω; filter |
| **F22** | Door lock (6 failures) | DL3 60 Ω solenoids |
| **F23** | Heater failure (Ht) | HE2 10–15 Ω |
| **F24** | Wash NTC out of range | TH2 R/T table |
| **F25** | Motor tach error | Motor ~6 Ω; shipping bolts |
| **F26** | Door switch (3 cycles) | Open door; DS2 0 Ω closed |
| **F27** | Overflow | Inlet off; pump runs constantly |
| **F28** | CCU–MCU serial comm | MCU harness orientation |
| **F29** | Door unlock fail | Unlock solenoid 60 Ω |
| **F30** | Dispenser motor | DI6 1400 Ω |
| **F31** | MCU heat sink OT | Ventilation; drive drag |
| **rL** | Load in Clean Washer | Empty drum |

**DMA:** +14 Whirlpool `washing_machine` rows; enriched F0E2/Sd fix text.

---

## 3. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| Won't fill | F20; faucets; screens; VCH7 750–850 Ω; PR6 hose |
| Won't drain | Sd then F21; hose; pump 12.3 Ω; filter |
| Won't spin | Shipping bolts; belt; F25/F28; motor 6 Ω |
| Door lock | F22/F26/F29; DL3 60 Ω; manual unlock §6 |
| Leaking | Hoses; bellows; F27 overflow path |
| No heat (Ht) | F23/F24; HE2 + TH2 |

---

## 4. Measurements (batch13)

| Knowledge ID | Spec | CCU connector |
|--------------|------|---------------|
| `whirlpoolDuetSportWasherMotorOhms` | ~6 Ω all pairs | Motor 5-pin |
| `whirlpoolDuetSportWasherDrainPumpOhms` | ~12.3 Ω | DP2 |
| `whirlpoolDuetSportWasherInletValveOhms` | 750–850 Ω | VCH7 |
| `whirlpoolDuetSportWasherHeaterOhms` | 10–15 Ω | HE2 (Ht only) |
| `whirlpoolDuetSportWasherDoorLockSolenoidOhms` | 60 Ω lock/unlock | DL3 |
| `whirlpoolDuetSportWasherWashNtcOhms` | ~2.3 kΩ @ 70°F | TH2 |

**vs W11169652 DD:** motor 6–20 Ω, pump 18.5–21.5 Ω, inlet 1.1–1.35 kΩ — do not interchange.

---

## 5. Diagnostic modes

- **Error history** — display prior faults before automated test  
- **Manual diagnostic test** — §6-7 component exercise  
- **Quick entry** — bypass history  

---

## 6. Captured vs gaps

### Captured

- Full F/xx error table + LED status chart mapping  
- Component Ω at terminals and CCU connectors (VCH7, DP2, HE2, TH2, DL3, DS2, DI6)  
- Pressure switch PR6 level contacts  
- Motor belt-drive ~6 Ω (not DD stator)  
- Diagnostic test entry and error history  
- Platform split from `whirlpool_fl_dd`  

### Gaps

| Gap | Notes |
|-----|-------|
| F11 / F33 LED-only codes | No prose definition on sheet — LED chart only |
| Model coverage beyond WFW83/85 | Pattern may miss WFW70-era; extend patterns if needed |
| ECO valve specifics | Removal §4-19 — no dedicated Ω in extraction |
| Maytag MHWE rebadges | Same platform likely — patterns not added |

---

## 7. Re-seed & verify

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
cd frontend && npx tsc --noEmit
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/jobaid-8178558-l-78 whirlpool fl washer 2013 era.pdf"`*
