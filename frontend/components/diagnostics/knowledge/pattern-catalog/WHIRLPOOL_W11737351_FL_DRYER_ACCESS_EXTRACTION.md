# Maytag 27" front-load dryer — W11737351 component access extraction

**Source:** `backend/docs/manuals/technical-manual-w11737351-reva access manual fl dryers.pdf`  
**Extracted text:** `backend/docs/manuals/technical-manual-w11737351-reva access manual fl dryers-extracted.txt`  
**Platform:** `whirlpool_ccu_dryer` — access diagrams attach to W10881701 / W11169659 procedure steps  
**Paired technical manual:** W11169659 (WED5620/WED7*/WED96* family) reuses W10881701 TEST #2–9  
**Scope:** Component access photos and disassembly steps — **no TEST # procedures, fault table, or Ω specs in this manual**  
**Status:** Access diagram crops shipped; attached to `whirlpool_ccu_dryer` procedures via `attach_w11737351_access_procedure_diagrams.py`

---

## Model routing

WED7*/MED7*/WGD7*/MGD7* and WED5620/WED56*/WED66* resolve to **`whirlpool_ccu_dryer`** (not a separate access-only platform).

| templateId | modelPatterns | Platform |
|------------|---------------|----------|
| `electric_dryer` | `/WED56/i`, `/WED66/i`, `/WED562/i`, `/MED56/i`, `/MED66/i` | `whirlpool_ccu_dryer` (explicit, before `/WED/i` catch-all) |
| `gas_dryer` | `/WGD56/i`, `/WGD66/i` | `whirlpool_ccu_dryer` (explicit) |
| both | `/WED7/i`, `/MED7/i`, `/WGD7/i`, `/MGD7/i`, `/WED/i`, … | `whirlpool_ccu_dryer` (broad catch-all) |

Manual title/branding is **Maytag® 27" Front-Load Gas and Electric Dryer** (©2024). ACU connector labels on p.10 (J6, J8, J14) align with W10881701/W11169659 service-manual pinouts.

---

## Access sections (PDF pp. 5–19)

| PDF p. | Section | Attached to procedures |
|--------|---------|------------------------|
| 8 | Top panel and console/HMI | `w10881701-button-indicator`, `w11169659-acu-power` |
| 10 | ACU | `w10881701-acu-power`, `w11169659-acu-power`, thermistor/motor steps |
| 11 | Front panel and door switch | `w10881701-door-switch` |
| 12 | Drum light and moisture sensor | `w10881701-moisture-sensor`, `w11169659-moisture-sensor`, `w11169659-drum-led` |
| 14 | Drive motor; thermal fuse and outlet thermistor | `w10881701-motor-circuit`, `w10881701-thermal-fuse`, `w10881701-thermistors` |
| 15 | Heater, hi-limit, thermal cutoff (electric) | `w10881701-heater-electric`, `w11169659-heater-electric`, thermal steps |
| 16–17 | Gas ignitor/flame sensor; burner coils | `w10881701-heater-gas`, `w10881701-gas-valve` |
| 19 | Water valve (steam) | `w10881701-water-valve` |

---

## Diagram assets

```bash
python backend/scripts/crop_w11737351_access_figures.py
python backend/scripts/attach_w11737351_access_procedure_diagrams.py
```

Output: `frontend/public/images/procedures/whirlpool_fl_dryer_access/w11737351-access-*.png` (15 crops).

---

## Pipeline

Access diagrams run after W11169659/W10881701 strip-circuit attach:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11169659
```

Ship gate: `validate_procedure_seed.py` + `cd frontend && npx tsc --noEmit`
