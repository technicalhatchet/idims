# Frigidaire Professional PRMC2285AF extraction

**Source:** `ServiceDataSheet-PRMC2285AF.pdf`  
**Extracted text:** `backend/docs/manuals/ServiceDataSheet-PRMC2285AF-extracted.txt`  
**Scope:** Frigidaire Professional French door; column evaporator; FFIM; VCZ; dispenser UI  
**Status:** Phase A + B + C merged (Er t* + demo routing/evidence).

---

## Error codes (Er t* family)

| Display | Meaning |
|---------|---------|
| Er t1 | Freezer temp sensor open/short |
| Er t2 | FZ defrost sensor open/short |
| Er t3 | Fresh food temp sensor open/short |
| Er t4 | FF defrost sensor open/short |
| Er t5 | VCZ (variable zone) temp sensor |
| Er t6 | FFIM tray sensor open/short |
| Er CE | UI ↔ main board communication |
| *(no code)* | Chute flapper not closed — beep + blink cube/crush |

---

## Special modes

| Mode | Activate |
|------|----------|
| Manual defrost dF | Hold + and Air Filter 10 s |
| Cube size menu | Hold FREEZE BOOST + Ice Maker 10 s |
| Demo | Hold − and Water Filter 10 s |
| Sabbath Sb | Hold − and Temp F-C 5 s |
| Service | Hold − and + 10 s |

---

## FFIM self-test

Hold TEST during first tray rotation (simulate full bin) → second rotation empty → solid green POWER = pass; rapid blink = internal IM failure.

---

## Complaint routing

| Symptom | Route |
|---------|-------|
| Er t1–t5 | NTC at listed zone; harness pin-backouts |
| Er t6 | FFIM tray sensor; ice maker |
| Er CE | Dispenser UI harness |
| No crushed/cubed | Chute flapper mechanical |
| Warm zone | Map t-code to zone sensor |

---

## Measurements

Compressor and fan tables on sheet (EMD variant); TID contact before main board replacement per sheet note.

---

## Phase B/C (deferred)

- Manufacturer: Frigidaire; chips `er_t_sensor`, `chute_flapper`
- Demo mode elimination (like Samsung Cooling Off)
- Evidence: per-zone thermistor

**DMA:** Er t1–t6 + Er CE in batch append.
