# Whirlpool / KitchenAid French door refrigerator platform

**Sources:**
- `WPL WRF757SD tech-sheet-w11509412-reva.pdf` (Whirlpool WRF757SD)
- `KRMF706EBS01 tech-sheet-w11501234-revB.pdf` (KitchenAid)
- `tech-sheet-w11050317-revb.pdf` (related WRF platform variant)

**Extracted text:** `*-extracted.txt` in `backend/docs/manuals/`  
**Scope:** ~27 cu ft French door; bottom freezer; dispenser UI + ACU; EMD55CLT compressor; RC ice-in-compartment  
**Status:** Phase A + B + C merged (ice maker E0–E5 evidence, routing).

Cross-reference: No consumer alphanumeric codes like Samsung/LG — **service test mode** + ice maker E-codes only.

---

## 1. Ice maker error codes (Service Test 56)

Displayed on UI during test 56:

| Code | Meaning |
|------|---------|
| E0 | No errors; functioning |
| E1 | No cooling — ice maker thermistor / sealed path |
| E2 | Motor lost position — home not found |
| E3 | Heater time-out — mold heater |
| E4 | Dry cycle — no water detected |
| E5 | Ice maker thermistor fault |

---

## 2. Service tests (high value)

| Test | Function |
|------|----------|
| 19 | Fill tube + fascia heater |
| 45 | Ice maker water fill state |
| 56 | Ice maker error display |
| 57–59 | Harvest / heater / motor |

**Entry:** Tech mode per sheet (varies by UI generation).

---

## 3. Complaint routing

| Symptom | Priority |
|---------|----------|
| No ice | E1–E5 via test 56; fill tube; water valve step 45 |
| Warm RC | Damper; condenser; sealed system (no display code) |
| Warm FZ | Evap fan; defrost; gasket |
| Dispenser dead | UI harness; ACU |

**Duplicate patterns only vs Samsung/LG:** Thermistor NTC troubleshooting, defrost heater verification, door gasket → warm zones — use merged Samsung/LG evidence patterns when Phase B merges.

---

## 4. Measurements

- Ice maker thermistor per test 56 E5 path
- Compressor EMD55CLT run state via service tests
- Refer to model-specific wiring on W11509412 / W11501234

---

## 5. Consolidation

**One platform doc** for Whirlpool + KitchenAid French door (same ice maker E0–E5 semantics). W11050317 is variant sheet — no separate extraction doc.

**DMA:** Ice maker E1–E5 as Whirlpool/KitchenAid `refrigerator` rows if not already present (batch may skip duplicates).

**Phase B/C:** Refrigerator template + service test guidance; no routingEngine tokens until merge.
