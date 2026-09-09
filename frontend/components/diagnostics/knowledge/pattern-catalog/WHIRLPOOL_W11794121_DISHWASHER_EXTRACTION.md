# JennAir 24" Filtration dishwasher — W11794121 extraction

**Source:** `backend/docs/manuals/technical-manual-W11794121-revb.pdf` (W11794121 Rev B, ©2025)  
**Extracted text:** `backend/docs/manuals/technical-manual-W11794121-revb-extracted.txt`  
**Platform:** `whirlpool_dishwasher_acu` (fourth manual; shared with W11633848 + W11480208 + W11499711)  
**Models:** JennAir 24" Filtration (`JDP*` tall-tub-plus per W11480208 nomenclature)  
**Measurements:** batch9 (shared ACU) + batch25 (filtration pinouts from W11480208)  
**Status:** W11794121 delta — one new D.O.S. procedure; overlaps defer to existing seeds

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

**Bundle:** `w11480208-service-diagnostic-entry` (identical entry to W11480208 / W11499711)

**Loads exercised:** vent (visual), drain, fill, wash, dispenser, fan, heater, diverter + position, OWI internal check, third-level rack wash (TLR models), **D.O.S.** (auto door open).

---

## 2. Overlap with W11633848 / W11480208 / W11499711

| W11794121 § | Topic | Connector / spec | Existing procedure | W11794121 action |
|-------------|-------|------------------|---------------------|------------------|
| 3-4 | F500 triac fuse | < 3 Ω | `w11633848-triac-fuse` | **Reuse** |
| 3-6 | ACU power / DC | P4 / 5 V / 13 V | `w11633848-acu-power` | **Reuse** |
| 3-7 | Door switch | P12-9 & P12-11, ≤3 Ω | `w11480208-door-switch` | **Reuse** |
| 3-8 | Fill valve | P6-1 & P6-3, 1200–1600 Ω | `w11633848-fill-valve` | **Reuse** |
| 3-9 | Dispenser | P12-5 & P12-7, 310–380 Ω | `w11633848-dispenser` | **Reuse** |
| 3-10 | Heater | P4-2 & P4-3, **10–40 Ω** | `w11480208-heater` | **Reuse** |
| 3-11 | OWI | P10-1 & P10-3; R/T table | `w11633848-owi-sensor` | **Reuse** |
| 3-12 | Overfill | P11-6 & P11-7 | `w11480208-overfill-switch` | **Reuse** |
| 3-13 | Diverter motor | P6-4 & P6-6, 1100–1400 Ω | `w11480208-diverter-motor` | **Reuse** |
| 3-14 | Diverter sensor | P11-2 vs P10-2, 0–8–10 V | `w11633848-diverter-sensor` | **Reuse** |
| 3-15 | Wash motor SSM | P5-1 & P5-2, **10–15 Ω** + cap | `w11499711-wash-motor-ssm` | **Reuse** — identical spec |
| 3-16 | Drain motor SSM | P5-3 & P5-4, 27–33 Ω | `w11633848-drain-motor` | **Reuse** |
| 3-17 | DC fan | P14-1 & P14-2, 145–185 kΩ, **13 VDC** | `w11480208-dc-fan` | **Reuse** |
| 3-18 | Interior LED | — | — | **Not in manual** — skip |
| 3-19 | Door Opening System | P9-1 & P9-2, **12 VDC ± 5%** | — | **New** `w11794121-door-opening-system` |
| — | UI / ACU LED | — | — | **Deferred** — no dedicated meter procedure |

**Not on W11794121:** W11480208 VSM wash/drain (`w11480208-wash-motor-vsm`, `w11480208-drain-motor-vsm`). Filtration platform uses SSM motors only.

**Vent wax motor:** F10E2 troubleshooting only — no §3 bench procedure (same gap as siblings).

---

## 3. Generated W11794121 delta

| ID | OEM § | Title | Notes |
|----|-------|-------|-------|
| `w11794121-door-opening-system` | 3-19 | Door Opening System (D.O.S.) | P9-1 & P9-2; 12 VDC → replace DOS module; no voltage → replace ACU |

All other W11794121 component sections map to existing procedure IDs listed above (13 reused + 1 new seed JSON).

---

## 4. Measurement knowledge

| knowledgeId | Connector / pins | W11794121 spec |
|-------------|-------------------|----------------|
| (new procedure) | P9-1 & P9-2 | 12 VDC ± 5% during D.O.S. interval — visual checkpoint only |
| (reused) `whirlpoolDishwasherAcuWashMotorOhms` | P5-1 & P5-2 | 10–15 Ω via `w11499711-wash-motor-ssm` |
| (reused) batch9/batch25 | fill, OWI, drain, door, float, heater, diverter, fan | same as W11480208 / W11499711 |

No new measurement batch required.

---

## 5. Error code routing (JennAir filtration highlights)

| Code | Primary procedure | Notes |
|------|-------------------|-------|
| F5E1 / F5E2 | `w11480208-door-switch` | P12 door circuit |
| F4E2 / F7E1 / F7E2 | `w11480208-heater` | 10–40 Ω element |
| F6E4 / F8E4 (overfill) | `w11480208-overfill-switch` | P11 float |
| F9E1 / F10E5 | `w11480208-diverter-motor` | Sensor → `w11633848-diverter-sensor` |
| F4E3 (SSM wash) | `w11499711-wash-motor-ssm` | 10–15 Ω + capacitor path |
| F8E4 / F9E2 (SSM drain) | `w11633848-drain-motor` | 27–33 Ω |
| F10E3 | `w11480208-dc-fan` | ProDry 13 VDC fan |
| Auto door open fault | `w11794121-door-opening-system` | D.O.S. P9 drive |

---

## 6. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11794121
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` with JennAir + **JDP** model (24" Filtration with Auto Door Open).
