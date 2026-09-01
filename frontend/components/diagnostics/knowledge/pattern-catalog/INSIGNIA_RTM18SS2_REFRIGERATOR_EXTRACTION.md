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
