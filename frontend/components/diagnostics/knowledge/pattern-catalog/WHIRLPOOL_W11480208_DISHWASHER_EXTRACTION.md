# Whirlpool filtration 24" dishwasher — W11480208 extraction

**Source:** `backend/docs/manuals/technical-manual-w11480208-revd WDT740SALB0.pdf` (W11480208 Rev D)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11480208-revd WDT740SALB0-extracted.txt`  
**Platform:** `whirlpool_dishwasher_acu` (second manual; shared with W11633848)  
**Measurements:** batch9 (shared ACU) + batch25 (filtration-specific)  
**Status:** W11480208 delta procedures generated — overlaps defer to W11633848 seeds

---

## 1. Service Diagnostics cycle (§2-3)

| Item | Detail |
|------|--------|
| Entry | Standby → press any 3 keys **1-2-3 × 3** (≤1 s; exclude Delay/Start/Cancel) |
| Start | **Press Key #2** (Run Service Test Cycle), then **close door** |
| Key #1 | User interface test (all LEDs on) |
| Key #3 | Error history; hold 5 s to clear |
| Advance | **START/RESUME** = rapid advance one interval |
| Pause | Door open pauses; close door resumes (no Start press) |
| Side effects | Clears status/history; forces sensor calibration on next regular cycle |
| Display | All LEDs on immediately after entry (display test) |

**Bundle:** `w11480208-service-diagnostic-entry` (differs from W11633848 — no separate 5 s LED-off before history)

**Loads exercised:** vent (visual), drain, fill, wash, dispenser, fan, heater, diverter + position, OWI internal check, third-level rack wash (TLR models).

---

## 2. Overlap with W11633848

| W11480208 § | Topic | W11633848 procedure | W11480208 action |
|-------------|-------|---------------------|------------------|
| 3-4 | F500 triac fuse | `w11633848-triac-fuse` | **Skip** — same <3 Ω |
| 3-7 | ACU power / DC | `w11633848-acu-power` | **Skip** — same P4 / 5 V / 13 V |
| 3-8 | Door switch | `w11633848-door-switch` | **New** — P12-9 & P12-11 (not P9) |
| 3-9 | Fill valve | `w11633848-fill-valve` | **Skip** — same P6-1 & P6-3, 1200–1600 Ω |
| 3-10 | Dispenser | `w11633848-dispenser` | **Skip** — same P12-5 & P12-7 |
| 3-11 | Heater | `w11633848-heater` | **New** — manual spec **10–40 Ω** (vs 8–30) |
| 3-12 | OWI | `w11633848-owi-sensor` | **Skip** — same P10-1 & P10-3; R/T table overlap |
| 3-13 | Overfill | `w11633848-overfill-switch` | **New** — **P11-6 & P11-7** only (no P6 float/fill strip) |
| 3-14 | Diverter motor | `w11633848-diverter-motor` | **New** — **P6-4 & P6-6**, **1100–1400 Ω** |
| 3-15 | Diverter sensor | `w11633848-diverter-sensor` | **Skip** — same P11-2 vs P10-2, 0–8–10 V |
| 3-16 | Wash motor SSM | `w11633848-wash-motor` | **Skip** — platform band covers 7–12 Ω |
| 3-17 | Wash motor VSM | — | **New** — P5-1 & P5-2, **16–18 Ω** |
| 3-18 | Drain motor SSM | `w11633848-drain-motor` | **Skip** — same P5-3 & P5-4, 27–33 Ω |
| 3-19 | Drain motor VSM | — | **New** — P5-5 & P5-6, **41–51 Ω** |
| 3-20 | DC fan | `w11633848-dc-fan` | **New** — **145–185 kΩ**, **13 VDC** (not 31–41 kΩ / 5 V) |
| 3-21 | Interior LED | — | **New** — P9 diode check + 13 V |
| 3-22 | UI / ACU LED | — | **Deferred** — no dedicated meter procedure |

**Vent wax motor:** F10E2 troubleshooting only — no §3 bench procedure (same gap as W11633848).

---

## 3. Generated W11480208 procedures

| ID | OEM § | Title |
|----|-------|-------|
| `w11480208-door-switch` | 3-8 | Door switch (P12) |
| `w11480208-heater` | 3-11 | Water heating / heat dry (10–40 Ω) |
| `w11480208-overfill-switch` | 3-13 | Overfill float (P11) |
| `w11480208-diverter-motor` | 3-14 | Diverter motor (P6) |
| `w11480208-wash-motor-vsm` | 3-17 | Variable-speed wash motor |
| `w11480208-drain-motor-vsm` | 3-19 | VSM-platform drain motor |
| `w11480208-dc-fan` | 3-20 | ProDry DC fan |
| `w11480208-interior-led` | 3-21 | Interior LED lighting |

**Bundle:** `w11480208-service-diagnostic-entry`

---

## 4. Measurement knowledge (batch25)

| knowledgeId | Connector / pins | Spec |
|-------------|------------------|------|
| `whirlpoolDishwasherFiltrationDiverterMotorOhms` | P6-4 & P6-6 | 1100–1400 Ω |
| `whirlpoolDishwasherFiltrationDcFanOhms` | P14-1 & P14-2 | 145–185 kΩ |
| `whirlpoolDishwasherFiltrationVsmWashMotorOhms` | P5-1 & P5-2 | 16–18 Ω |
| `whirlpoolDishwasherFiltrationVsmDrainMotorOhms` | P5-5 & P5-6 | 41–51 Ω |

Reused from batch9/batch4: `dishwasherDoorLatchSwitchOhms`, `dishwasherFloatSwitchOhms`, `whirlpoolDishwasherAcuHeaterOhms`.

---

## 5. Error code routing (filtration-specific highlights)

| Code | Primary W11480208 procedure | Fallback W11633848 |
|------|----------------------------|-------------------|
| F5E1 / F5E2 | `w11480208-door-switch` | — |
| F4E2 / F7E1 / F7E2 | `w11480208-heater` | OWI if heat persists → `w11633848-owi-sensor` |
| F6E4 / F8E4 (overfill) | `w11480208-overfill-switch` | Fill → `w11633848-fill-valve` |
| F9E1 / F10E5 | `w11480208-diverter-motor` | Sensor → `w11633848-diverter-sensor` |
| F4E3 (VSM wash) | `w11480208-wash-motor-vsm` | SSM → `w11633848-wash-motor` |
| F8E4 / F9E2 (VSM drain) | `w11480208-drain-motor-vsm` | SSM → `w11633848-drain-motor` |
| F10E3 | `w11480208-dc-fan` | — |

---

## 6. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11480208
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` with Whirlpool + **WDT740SALB0**.
