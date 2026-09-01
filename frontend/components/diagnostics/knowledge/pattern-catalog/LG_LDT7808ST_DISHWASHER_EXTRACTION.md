# LG LDT7808ST dishwasher extraction

**Source:** `backend/docs/manuals/LDT7808ST.pdf`  
**Extracted text:** `backend/docs/manuals/LDT7808ST-extracted.txt`  
**Scope:** LG top-control dishwasher; multi-motion spray; vario valve diverter; QuadWash  
**Status:** Phase A + B + C merged (VARIO + AE/BE routing/evidence).

---

## Display error messages (§7-1)

| Message | Meaning | Checks |
|---------|---------|--------|
| IE / INLET ERROR | Fill fault | Water supply; inlet valve; float |
| OE / DRAIN ERROR | Drain fault | Filter; drain hose; pump |
| AE / LEAKAGE ERROR | Leak detected | Sump; door; hose clamps |
| BE / BUBBLE ERROR | Excess suds | Detergent type |
| tE / THERMAL ERROR | Over-temp | Heater; thermistor |
| HE / HEATER ERROR | Heater circuit | Heater; relay |
| motor error | Wash motor | Motor; harness |
| **VARIO ERROR** | Vario cam position | Vario switch assembly; motor 4 kΩ |

**AE checklist:** Document cycle count and when AE appeared (manual §7-1).

---

## Internal codes (service)

E005, E010, and additional EEPROM codes in extracted §9 — map to display messages above.

---

## Vario valve service

1. Remove 2 screws; pull vario motor/cam
2. Verify vario switch position and motor operation
3. Reassemble switch or replace motor

---

## Complaint routing

| Symptom | Route |
|---------|-------|
| Won't fill | IE; inlet; water pressure |
| Won't drain | OE; filter; impeller |
| Leak on floor | AE; door gasket; sump |
| Poor wash top rack | Vario position; spray arms |
| Suds overflow | BE; wrong detergent |

---

## Phase B/C (deferred)

- Chip keywords: `vario_error`, `bubble_error`, `leak_ae`
- Evidence: vario motor resistance ~4 kΩ
- Cross-ref LG washer OE/IE patterns where helpful

**DMA:** `VARIO ERROR` enrichment row in batch append (IE/OE may exist from other LG sources).
