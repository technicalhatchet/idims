# Samsung RS22T/RS27T/RS28T5B SxS refrigerator — extraction

**Source:** `backend/docs/manuals/samsung-refrigerator-sxs-svc manual.pdf` (128 pp., RS5300TC project)  
**Extracted text:** `backend/docs/manuals/samsung-refrigerator-sxs-svc manual-extracted.txt`  
**Manual ID:** `SAMSUNG-RS22T-SXS`  
**Platform:** `samsung_sxs` (reuses `samsungrs28-*` procedures — same CN20/CN40/CN90 map)  
**Status:** Complete — model routing only; no delta procedures

Cross-reference: [SAMSUNG_RS28_FRIDGE_EXTRACTION.md](./SAMSUNG_RS28_FRIDGE_EXTRACTION.md), [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md).

---

## Platform decision

**Extend `samsung_sxs` — reuse all `samsungrs28-*` procedures.** RS22T/RS27T/RS28T5B share the LED-panel §4-2 self-diagnostic checklist (CN20/CN40/CN90) with RS28T5B from this manual. Pin map matches existing RS28 delta seeds; R-Sensor uses CN20 2↔4 (not RS28A500 CN20 10↔12) — already noted on `samsungrs28-r-sensor`.

Engineer mode entry (A-B-A-B-A-B within 3 s → Fridge Function Test) is identical to RS28 bundles — no new service-mode bundles.

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| RS22T5561* | RS22T5561SR (Family Hub + in-door ice) |
| RS22T520* | RS22T5200AW, RS22T5201SR |
| RS27T5561* | RS27T5561SR |
| RS27T520* | RS27T5200SR |
| RS28T5B00* | RS28T5B00SR (dispenser LED panel) |
| RS5300* | RS5300TC / RS5300T series name |

Make: **Samsung** only. Template: `refrigerator`.

---

## 2. Self-diagnostic checklist (§4-2, pp. 77–79)

Same connector map as `samsungrs28-*` — see [SAMSUNG_RS28_FRIDGE_EXTRACTION.md](./SAMSUNG_RS28_FRIDGE_EXTRACTION.md) §3.

| Item | Test point | Procedure ID (reused) |
|------|------------|----------------------|
| F-Sensor | CN20 1↔3 | `samsungrs28-f-sensor` |
| R-Sensor | CN20 2↔4 | `samsungrs28-r-sensor` |
| F-DEF-Sensor | CN20 5↔7 | `samsungrs28-f-def-sensor` |
| Ambient | CN40 18↔20 | `samsungrs28-ambient-sensor` |
| Humidity | CN40 14↔20 | `samsungrs28-humidity-sensor` |
| Ice maker sensor | CN90 11↔13 | `samsungrs28-ice-maker-sensor` |
| F-FAN | CN20 15↔17 | `samsungrs28-f-fan` |
| C-FAN | CN20 22↔24 | `samsungrs28-c-fan` |
| F-DEF heater | CN70-5 ↔ CN85-3 | `samsungrs28-f-defrost-heater` |
| Damper heater | CN40 25↔27 (7–12 V) | `samsungrs28-damper-heater` |
| Ice pipe heater | CN90 1↔5 | `samsungrs28-ice-pipe-heater` |
| Comm codes 41E–52E | harness / PCB | `samsungrs28-*-communication` |

---

## 3. Service modes (§4-2-1, §4-2-2)

| Mode | Entry | Bundle (reused) |
|------|-------|-----------------|
| Engineer / Fridge Function Test | A-B-A-B-A-B within 3 s | `samsungrs28-engineer-test-entry` |
| LED test / self-diagnostic | Fridge + Power Cool 6 s | `samsungrs28-led-test-mode-entry`, `samsungrs28-self-diagnostic-entry` |

---

## 4. Diagrams

§6-1/§6-2 (pp. 111–112) match RS28 manual connector layout. Reuse existing crops:

- `samsungrs28-main-pcb-layout.png` (RS28 manual p.100)
- `samsungrs28-main-pcb-connectors.png` (RS28 manual p.101)

No RS22T-specific diagram crops required.

---

## 5. Pipeline

No generator — procedures ship via `SAMSUNG-RS28-SXS` seeds.

```bash
cd frontend && npx tsc --noEmit
python backend/scripts/validate_procedure_seed.py
```

WO smoke: RS22T5561SR + Samsung → `samsung_sxs`; 5E → `samsungrs28-f-def-sensor`; 22E → `samsungrs28-f-fan`.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/samsung-refrigerator-sxs-svc manual.pdf"`*
