# Whirlpool Duet Sport dryer — 8178559 extraction

**Source:** `backend/docs/manuals/jobaid-8178559-l-79 whirlpool fl dryer 2013 era.pdf` (96 pp., Job Aid L-79 / Part 8178559)  
**Extracted text:** `backend/docs/manuals/jobaid-8178559-l-79 whirlpool fl dryer 2013 era-extracted.txt` (PyMuPDF)  
**Scope:** Duet Sport™ Machine Control Electronics (MCE) era — WED8300SW, WED8500SR (electric), WGD8300SW, WGD8500SR (gas).  
**Status:** Phase A + B + C merged (DMA F01/F02/F22/F23/F26/F28/F29 enriched + F26 new, batch14, evidence, routing).

Cross-reference: [WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md](./WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md) (washer pair — CCU/MCU belt-drive).  
**Not** CCU `F3Ex`/`F4Ex` stack — see `whirlpool_ccu_dryer` / DRYER_SERVICE_MANUAL extraction for newer controls.

**Platform:** `whirlpool_duet_sport_dryer` — model patterns `WED83`, `WED85`, `WGD83`, `WGD85`.  
**Note:** `whirlpool_ccu_dryer` scoped to `WED`/`WGD`/`MED`/`MGD`; Duet Sport wins on 83/85 prefixes.

---

## 1. Pre-service checklist

| Check | Why it matters |
|-------|----------------|
| 120 V dedicated circuit | MCE sensitive to voltage drop |
| Clean lint screen | Restricted airflow trips hi-limits / long dry |
| Gas shutoff open (gas) | No ignition path before valve diagnosis |
| Vent run ≤25 ft equiv. | Weak airflow mimics thermistor faults |
| Door fully closed | P8-3/P8-4 door switch 0–2 Ω |

---

## 2. Error codes (F-xx display)

| Code | Meaning | First test |
|------|---------|------------|
| **PF** | Power failure | Press START to continue |
| **F-01** | Primary control failure | Replace MCE |
| **F-02** | Keypad/UI (diag only) | TEST #5 stuck button |
| **F-22** | Exhaust thermistor open | TEST #3a — flashes in 60 s Timed Dry |
| **F-23** | Exhaust thermistor short | TEST #3a |
| **F-26** | Motor drive failure | TEST #2 motor + belt switch |
| **F-28** | Moisture sensor open (diag) | TEST #4 wet cloth |
| **F-29** | Moisture sensor short (diag) | TEST #4 |

**DMA:** +1 Whirlpool `dryer` row (F26); enriched F01/F02/F22/F23/F28/F29 fix text.

---

## 3. Complaint routing

| Symptom | Priority checks |
|---------|-----------------|
| No heat (electric) | Element 7–12 Ω; thermal fuse/cut-off; P14 thermistor |
| No ignition (gas) | Ignitor 50–250 Ω; coils; thermal fuse in valve circuit |
| Won't tumble | F-26; motor 2.4–3.8 Ω; belt switch |
| Long dry | Vent; moisture sensor F-28/F-29; exhaust NTC |
| Heat won't shut off | P14-3 to P14-6: 5–15 kΩ = MCE; >20 kΩ = thermistor |

---

## 4. Measurements (batch14)

| Knowledge ID | Spec | Notes |
|--------------|------|-------|
| `whirlpoolDuetSportDryerMotorOhms` | Main 2.4–3.6 Ω; start 2.4–3.8 Ω | At motor switch pins 4-5 / 4-3 |
| `whirlpoolDuetSportDryerHeaterOhms` | 7–12 Ω | Single element — not CCU ≤50 Ω dual |
| `whirlpoolDuetSportDryerExhaustThermistorKohm` | ~12 kΩ @ 70°F | R/T table §6 TEST #3a |
| `whirlpoolDuetSportDryerIgnitorOhms` | 50–250 Ω | Gas only |
| `whirlpoolDuetSportDryerGasValveCoilOhms` | 2-pin 1000–1300 Ω; 3-pin 1300–1400 / 500–600 Ω | Gas only |

---

## 5. Diagnostic mode

Enter via button hold sequence §6 — saved/active fault codes, component tests, moisture sensor wet-cloth test.

---

## 6. Captured vs gaps

### Captured

- Full F-xx fault table + TEST #2 motor / TEST #3 heat / TEST #3a thermistor / TEST #4 moisture  
- Electric heater 7–12 Ω vs CCU dual-element spec split  
- Gas ignitor + valve coil Ω at burner  
- Exhaust thermistor R/T table and P14 diagnostic thresholds  
- Routing disambiguation: washer F22/F26/F29 vs dryer F-22/F-26  
- Platform split from `whirlpool_ccu_dryer`  

### Gaps

| Gap | Notes |
|-----|-------|
| MED/MGD Maytag rebadges | Same MCE likely — patterns not added beyond WED/WGD |
| Models outside 83/85 prefix | Extend patterns if field data shows overlap |
| Inlet thermistor (F-25 on some platforms) | Not in Duet Sport display table — deferred |
| Flame sensor µA spec | Functional test only on job aid |

---

## 7. Re-seed & verify

```bash
python backend/scripts/regenerate_dma_error_codes_sql.py
cd frontend && npx tsc --noEmit
```

Re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/jobaid-8178559-l-79 whirlpool fl dryer 2013 era.pdf"`*
