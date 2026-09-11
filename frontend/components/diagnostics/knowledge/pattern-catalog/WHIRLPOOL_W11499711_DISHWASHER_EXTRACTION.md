# Whirlpool/KitchenAid/Maytag microfiltration dishwasher — W11499711 extraction

**Source:** `backend/docs/manuals/technical-manual-w11499711-reve WDT750SAKB0.pdf` (W11499711 Rev E)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11499711-reve WDT750SAKB0-extracted.txt`  
**Platform:** `whirlpool_dishwasher_acu` (third manual; shared with W11633848 + W11480208)  
**Models:** WDT75*, WDTA75* (KitchenAid/Maytag 24" microfiltration)  
**Measurements:** batch9 (shared ACU) + batch25 (filtration pinouts from W11480208)  
**Status:** W11499711 delta — one new SSM wash-motor procedure; overlaps defer to existing seeds

---

## 1. Service Diagnostics cycle (§2-3)

| Item | Detail |
|------|--------|
| Entry | Standby → press any 3 keys **1-2-3 × 3** (≤1 s; exclude Delay/Start/Cancel) |
| Start | **Press Key #2** (Run Service Test Cycle), then **close door** |
| Key #1 | User interface test (all LEDs on; tone on key press) |
| Key #3 | Error history; hold 5 s to clear |
| Advance | **START/RESUME** = rapid advance one interval |
| Pause | Door open pauses; close door resumes (no Start press) |
| Side effects | Clears status/history; forces sensor calibration on next regular cycle |
| Display | All LEDs on immediately after entry (display test) |

**Bundle:** `w11480208-service-diagnostic-entry` (identical entry to W11480208 / WDT740)

**Loads exercised:** vent (visual), drain, fill, wash, dispenser, fan, heater, diverter + position, OWI internal check, third-level rack wash (TLR models).

---

## 2. Overlap with W11633848 / W11480208

| W11499711 § | Topic | Existing procedure | W11499711 action |
|-------------|-------|---------------------|------------------|
| 3-4 | F500 triac fuse | `w11633848-triac-fuse` | **Reuse** — same <3 Ω |
| 3-6 | ACU power / DC | `w11633848-acu-power` | **Reuse** — same P4 / 5 V / 13 V |
| 3-7 | Door switch | `w11480208-door-switch` | **Reuse** — P12-9 & P12-11 |
| 3-8 | Fill valve | `w11633848-fill-valve` | **Reuse** — P6-1 & P6-3, 1200–1600 Ω |
| 3-9 | Dispenser | `w11633848-dispenser` | **Reuse** — P12-5 & P12-7, 310–380 Ω |
| 3-10 | Heater | `w11480208-heater` | **Reuse** — P4-2 & P4-3, **10–40 Ω** |
| 3-11 | OWI | `w11633848-owi-sensor` | **Reuse** — P10-1 & P10-3; R/T table |
| 3-12 | Overfill | `w11480208-overfill-switch` | **Reuse** — P11-6 & P11-7 |
| 3-13 | Diverter motor | `w11480208-diverter-motor` | **Reuse** — P6-4 & P6-6, 1100–1400 Ω |
| 3-14 | Diverter sensor | `w11633848-diverter-sensor` | **Reuse** — P11-2 vs P10-2, 0–8–10 V |
| 3-15 | Wash motor SSM | — | **New** — P5-1 & P5-2, **10–15 Ω** + capacitor path |
| 3-16 | Drain motor SSM | `w11633848-drain-motor` | **Reuse** — P5-3 & P5-4, 27–33 Ω |
| 3-17 | DC fan | `w11480208-dc-fan` | **Reuse** — P14-1 & P14-2, 145–185 kΩ, 13 VDC |
| 3-18 | Interior LED | `w11480208-interior-led` | **Reuse** — P9 diode + 13 V |
| 3-19 | UI / ACU LED | — | **Deferred** — no dedicated meter procedure |

**Not on W11499711:** W11480208 VSM wash (`w11480208-wash-motor-vsm`, 16–18 Ω) and VSM drain (`w11480208-drain-motor-vsm`, 41–51 Ω). WDT750 uses SSM motors only.

**Vent wax motor:** F10E2 troubleshooting only — no §3 bench procedure (same gap as siblings).

---

## 3. Generated W11499711 delta

| ID | OEM § | Title | Notes |
|----|-------|-------|-------|
| `w11499711-wash-motor-ssm` | 3-15 | Wash Motor (SSM, microfiltration) | 10–15 Ω; F501 fuse; capacitor retest branch |

All other W11499711 component sections map to existing procedure IDs listed above.

---

## 4. Measurement knowledge

| knowledgeId | Connector / pins | W11499711 spec |
|-------------|------------------|----------------|
| `whirlpoolDishwasherAcuWashMotorOhms` | P5-1 & P5-2 | 10–15 Ω (manual); platform band 5–15 Ω |
| (reused) `whirlpoolDishwasherFiltrationDiverterMotorOhms` | P6-4 & P6-6 | 1100–1400 Ω |
| (reused) `whirlpoolDishwasherFiltrationDcFanOhms` | P14-1 & P14-2 | 145–185 kΩ |
| (reused) batch9/batch4 | fill, OWI, drain, door, float, heater | same as W11633848 / W11480208 |

No new batch26 knowledge required — wash motor covered by batch9 platform band.

---

## 5. Error code routing (WDT750 highlights)

| Code | Primary procedure | Notes |
|------|-------------------|-------|
| F5E1 / F5E2 | `w11480208-door-switch` | P12 door circuit |
| F4E2 / F7E1 / F7E2 | `w11480208-heater` | 10–40 Ω element |
| F6E4 / F8E4 (overfill) | `w11480208-overfill-switch` | P11 float |
| F9E1 / F10E5 | `w11480208-diverter-motor` | Sensor → `w11633848-diverter-sensor` |
| F4E3 (SSM wash) | `w11499711-wash-motor-ssm` | **Not** VSM procedure |
| F8E4 / F9E2 (SSM drain) | `w11633848-drain-motor` | **Not** VSM drain |
| F10E3 | `w11480208-dc-fan` | ProDry 13 VDC fan |

---

## 6. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11499711
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` with Whirlpool/KitchenAid + **WDT750SAKB0**.
