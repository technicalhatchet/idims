# Midea / Insignia refrigerator & freezer extraction

**Sources:**
- `NS-RSS26SS Service Manual.pdf` — SxS refrigerator (OEM UR-BCD746WE-DT)
- `NS-UZ21WH0 insignia freezer.pdf` — upright freezer (OEM HS-772FWE)

**Status:** Phase A — **Phase B/C not merged**  
Cross-reference: [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md), [LG_LRMVS3006S_EXTRACTION.md](./LG_LRMVS3006S_EXTRACTION.md) for duplicate *patterns* only.

---

## Shared Midea E-code family

| Code | RSS26 (fridge) | UZ21 (freezer) |
|------|----------------|----------------|
| E0 | Ice maker | N/A |
| E1 | RC temp sensor | N/A (convert SKUs only) |
| E2 | FZ temp sensor | FZ temp sensor |
| E4 | RC defrost | N/A |
| E5 | FZ defrost | FZ defrost |
| E6 | Display↔main CN9 | Display↔main |
| E7 | Ambient | Ambient |
| E9 | High temp FZ | High temp |
| EE, EH, EF, CA, EP | Ice/dispenser subset | N/A |

**VFD inverter** (RSS26): LED blink codes for overcurrent, overvoltage, undervoltage, LOCK, overload.

---

## Measurements (both)

- NTC **B3839** R/T table (§8.4 / §9.4)
- FZ defrost heater 240 W (RSS26) / 320 W (UZ21)
- Compressor: DZ120V1U (RSS26 inverter) / EZ90H1A fixed (UZ21)

---

## Phase B/C (deferred)

- New chips unlikely — route via `error_code` + manufacturer filter in DMA lookup
- Elimination: E9 high temp → door gasket before sealed system
- **Subtype:** `refrigerator` vs `freezer` in DMA for UZ21 rows

**DMA:** Full Insignia E-family in batch append (new manufacturer).
