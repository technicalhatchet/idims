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

---

## Procedure index — `midea_rss` (MIDEA-RSS-FRIDGE)

**Pipeline:** `python backend/scripts/generate_midea_rss_fridge_procedure_seeds.py`  
**Platform:** `midea_rss` · NS-RSS*, NS-RTM* · template `refrigerator`

| ID | OEM | Tags / codes |
|----|-----|-----|
| `midearss-rc-temp-sensor` | §10.8 E1 | E1, thermistor_check |
| `midearss-fz-temp-sensor` | §10.8 E2 | E2, E9, not_cooling |
| `midearss-rc-defrost-sensor` | §10.8 E4 | E4, defrost, frost_buildup |
| `midearss-fz-defrost-sensor` | §10.8 E5 | E5, defrost, no_defrost |
| `midearss-ambient-sensor` | §10.8 E7 | E7 |
| `midearss-fz-defrost-heater` | §6.3 / §8.6 | defrost_heater, E5, mideaRssDefrostHeaterOhms |
| `midearss-communication` | §10.8 E6 | E6, hmi_check |
| `midearss-high-temp-alarm` | §10.8 E9 | E9, high_temp_alarm |
| `midearss-ice-maker` | §10.8 E0 | E0, ice_maker |
| `midearss-ice-maker-sensor` | §10.8 EE | EE, ice_maker |
| `midearss-vfd-inverter` | §11.2 | inverter_fault, not_cooling |

**Bundle:** `midearss-mandatory-mode-entry` (LOCK + FRZ.TEMP 3 s, §10.5)

**WO smoke:** NS-RSS26SS + Insignia → `midea_rss`; E2 → `midearss-fz-temp-sensor`.

---

## Procedure index — `midea_uz21` (MIDEA-UZ21-FREEZER)

**Pipeline:** `python backend/scripts/generate_midea_uz21_freezer_procedure_seeds.py`  
**Platform:** `midea_uz21` · NS-UZ* · template `standalone_freezer`

| ID | OEM | Tags / codes |
|----|-----|-----|
| `mideauz21-fz-temp-sensor` | §9.6 E2 | E2, thermistor_check |
| `mideauz21-fz-defrost-sensor` | §9.6 E5 | E5, defrost, frost_buildup |
| `mideauz21-ambient-sensor` | §9.6 E7 | E7 |
| `mideauz21-fz-defrost-heater` | §5.1 / §7.6 | defrost_heater, E5, mideaUz21DefrostHeaterOhms |
| `mideauz21-communication` | §9.6 E6 | E6, hmi_check |
| `mideauz21-high-temp-alarm` | §9.6 E9 | E9, high_temp_alarm |
| `mideauz21-evap-fan` | §7.5 / E9 step 5 | evap_fan, E9, airflow |

**Bundles:** `mideauz21-test-mode-entry` (LOCK + − 3 s); `mideauz21-forced-defrost-entry` (Vacation in test mode)

**WO smoke:** NS-UZ21WH0 + Insignia → `midea_uz21`; E5 → `mideauz21-fz-defrost-sensor`.
