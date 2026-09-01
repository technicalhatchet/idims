# Midea / Insignia refrigerator & freezer extraction

**Sources:**
- `NS-RSS26SS Service Manual.pdf` — SxS refrigerator (OEM UR-BCD746WE-DT)
- `NS-UZ21WH0 insignia freezer.pdf` — upright freezer (OEM HS-772FWE)

**Status:** Phase A + B + C merged (E-family + Er t* routing/evidence).  
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

## Measurements (Phase D — brand-aware)

| knowledgeId | Spec | Field |
|-------------|------|-------|
| `mideaB3839ThermistorKohm` | B3839 NTC — ~2.0 kΩ @ 25°C (not generic 5–16 kΩ) | `fans_and_electrical.*_thermistor`, `defrost_circuit.defrost_thermistor` |
| `mideaRssDefrostHeaterOhms` | RSS26 115 V 240 W (~55 Ω) | `defrost_circuit.defrost_heater_ohms` |
| `mideaUz21DefrostHeaterOhms` | UZ21 115 V 320 W (~41 Ω) | `standalone_freezer` defrost heater |

Platform: `midea_rss` (NS-RSS, NS-RTM) · `midea_uz21` (NS-UZ freezer)

---

## Phase B/C

**DMA:** Full Insignia E-family in batch append (new manufacturer).
