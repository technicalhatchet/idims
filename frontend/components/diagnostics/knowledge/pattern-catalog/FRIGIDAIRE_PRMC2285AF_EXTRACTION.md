# Frigidaire Professional PRMC2285AF extraction

**Source:** `ServiceDataSheet-PRMC2285AF.pdf`  
**Extracted text:** `backend/docs/manuals/ServiceDataSheet-PRMC2285AF-extracted.txt`  
**Scope:** Frigidaire Professional French door; column evaporator; FFIM; VCZ; dispenser UI  
**Status:** **Complete** — 9 procedures + 1 service-mode bundle

| Field | Value |
|-------|-------|
| platformId | `frigidaire_prmc_french_door` |
| templateId | `refrigerator` |
| Models | `PRMC*`, `FRMC*` |
| PDF | `ServiceDataSheet-PRMC2285AF.pdf` |
| Knowledge | `cabinetThermistorOhms` (registry default 5–16 kΩ) |
| Pipeline | `python backend/scripts/generate_frigidaire_prmc_fridge_procedure_seeds.py` |

---

## Error codes (Er t* family)

| Display | Meaning | Procedure |
|---------|---------|-----------|
| Er t1 | Freezer temp sensor open/short | `frigidaireprmc-fz-temp-sensor` (svc test 30) |
| Er t2 | FZ defrost sensor open/short | `frigidaireprmc-fz-defrost-sensor` (test 39) |
| Er t3 | Fresh food temp sensor open/short | `frigidaireprmc-ff-temp-sensor` (test 29) |
| Er t4 | FF defrost sensor open/short | `frigidaireprmc-ff-defrost-sensor` (test 31) |
| Er t5 | VCZ (variable zone) temp sensor | `frigidaireprmc-vcz-temp-sensor` (test 32) |
| Er t6 | FFIM tray sensor open/short | `frigidaireprmc-ffim-tray-sensor` (test 45) |
| Er CE | UI ↔ main board communication | `frigidaireprmc-ui-communication` |
| *(no code)* | Chute flapper not closed — beep + blink cube/crush | deferred v1 |

---

## Special modes

| Mode | Activate | Procedure |
|------|----------|-----------|
| Manual defrost dF | Hold + and Air Filter 10 s | `frigidaireprmc-manual-defrost` |
| Service | Hold − and + 10 s | bundle `frigidaireprmc-service-mode-entry` |
| FFIM self-test | TEST button (2 rotations) | `frigidaireprmc-ffim-self-test` |
| Demo | Hold − and Water Filter 10 s | deferred (evidence `ref_kw_frig_demo`) |
| Cube size menu | Hold FREEZE BOOST + Ice Maker 10 s | deferred |
| Sabbath Sb | Hold − and Temp F-C 5 s | deferred |

---

## Service mode highlights

- Enter/exit: hold **−** and **+** 10 s; navigate with **+/−**; **FREEZE BOOST** toggles loads.
- Sensor tests 29–32, 39, 45 flash OP/SH for open/short.
- Load tests: defrost heaters (2, 71, 72), fans (15–18, 62, 70), compressor (38), chute flapper (36), FFIM harvest (50).

---

## Complaint routing

| Symptom | Route |
|---------|-------|
| Er t1–t5 | NTC at listed zone; harness pin-backouts; service mode OP/SH |
| Er t6 | FFIM tray sensor; ice maker self-test |
| Er CE | Dispenser UI harness |
| No crushed/cubed | Chute flapper mechanical (test 36) |
| Warm zone | Map t-code to zone sensor |

---

## Measurements

No pin-level Ω table on service data sheet — procedures use `cabinetThermistorOhms` (5–16 kΩ room temp). Contact TID before main board replacement per sheet note.

**DMA:** Er t1–t6 + Er CE in `supabase_dma_error_codes_seed.sql`.

**WO smoke:** PRMC2285AF + Frigidaire → `frigidaire_prmc_french_door`; Er t1 → `frigidaireprmc-fz-temp-sensor`.
