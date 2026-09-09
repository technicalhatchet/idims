# Insignia NS-RTM18SS2 top-freezer refrigerator extraction

**Source:** `NS-RTM18SS2 Service Manual.pdf` (Midea OEM service manual)  
**Extracted text:** `NS-RTM18SS2 Service Manual-extracted.txt` (51 pp., 44k chars)  
**Scope:** Insignia 18 cu ft top-freezer; LED error indication (no alphanumeric UI codes)  
**Status:** Phase A + B + C merged (LED E-family via shared refrigerator evidence).

Cross-reference: [MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md](./MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md) — same Midea E-family; RSS26 SxS adds ice/dispenser codes RTM18 lacks.

---

## Error codes (§9.6 — LED patterns)

| LEDs | Code | Fault |
|------|------|-------|
| LED① + LED② | E1 | Refrigerator chamber temp sensor |
| LED① + LED⑤ | E2 | Freezing chamber temp sensor |
| LED① + LED③ | E5 | Freezer defrost sensor |
| LED② + LED④ | E6 | Communication failure |
| LED① + LED④ | E7 | Ambient temperature sensor |

**Troubleshooting:** Terminals → sensor resistance → replace sensor → main PCB.

---

## Service modes

- **Standby:** Hold temp button 3 s
- **Test / forced defrost:** Hold freeze + refrigerator gear buttons 3 s; select mode via freeze button

---

## Phase B/C (deferred)

- Map LED pattern to `error_code` chip when user reports “lights blinking”
- Evidence: per-zone NTC (reuse Midea B3839 patterns from RSS26 doc)

**DMA:** E1/E2/E5/E6/E7 already seeded as Insignia `refrigerator` from RSS26 batch — no new rows unless LED aliases needed.

---

## Procedure index — `midea_rss` (INSIGNIA-RTM18-FRIDGE)

**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual INSIGNIA-RTM18-FRIDGE`  
**Platform:** `midea_rss` · NS-RTM* · template `refrigerator`  
**Approach:** Delta manifest on shared `midea_rss` seeds — RTM18 §9.6 troubleshooting matches RSS26 §10.8 for E1/E2/E5/E6/E7.

| ID | OEM | Status | Tags / codes |
|----|-----|--------|-----|
| `midearss-rc-temp-sensor` | §9.6 E1 | reused | E1, thermistor_check |
| `midearss-fz-temp-sensor` | §9.6 E2 | reused | E2, not_cooling |
| `midearss-fz-defrost-sensor` | §9.6 E5 | reused | E5, defrost, no_defrost |
| `midearss-communication` | §9.6 E6 | reused | E6, hmi_check |
| `midearss-ambient-sensor` | §9.6 E7 | reused | E7 |
| `mideartm18-test-mode-entry` | §9.7 | generated | forced_defrost |

**Not on RTM18:** E0/E4/E9/EE (ice/dispenser), VFD inverter (fixed-speed EZ65H1X), RC defrost sensor (no E4 code).

**Measurements:** `mideaB3839ThermistorKohm` (§8.4 R/T table). FZ defrost heater 215 W (~61 Ω) — within `mideaRssDefrostHeaterOhms` band if frost path needed later.

**Bundle:** `mideartm18-test-mode-entry` — freeze + refrigerator gear 3 s (not RSS26 LOCK+FRZ.TEMP mandatory mode).

**WO smoke:** NS-RTM18SS2 + Insignia → `midea_rss`; E5 → `midearss-fz-defrost-sensor`.
