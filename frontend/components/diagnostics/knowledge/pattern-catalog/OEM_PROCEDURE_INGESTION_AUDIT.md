# OEM Procedure Ingestion Audit Report

**Date:** 2026-03-09  
**Reference depth:** W11169652 (17 TEST procedures + 6 service-mode bundles + diagram crops + diagnostic effects)  
**Ship gate:** `validate_procedure_seed.py` — **188 procedures / 29 bundles PASS** · `npx tsc --noEmit` PASS  
**Git:** All work **local only** (not pushed to `origin/master`)

---

## Summary

| Metric | Before overnight | After session 1 | After session 2 (today) |
|--------|------------------|-----------------|-------------------------|
| Manifest manuals | 4 | 11 | **15** |
| Procedure seeds | ~51 | ~135 | **188** |
| Service-mode bundles | ~12 | ~19 | **29** |
| Platforms with procedures | 4 | 8 | **12** |

---

## Reference tier (gold standard)

| Manual | Platform | Procs | Bundles | Diagrams | Notes |
|--------|----------|-------|---------|----------|-------|
| **W11169652** | `whirlpool_fl_dd` | 17 | 6 | 8 crops | Deepest — QSC, component activation, load tests |
| W8178558 | `whirlpool_duet_sport` | 9 | 2 | 8 crops | Job aid TEST #1–8 |
| W8178559 | `whirlpool_duet_sport_dryer` | 13 | 1 | 6 crops | Fuel-split electric/gas |
| W10680150 | `whirlpool_ccu_dryer` | 13 | 1 | — | CCU TEST #1–7; #8/#9 deferred |

---

## New platforms — session 1 (overnight batch)

| Manual | Platform | Procs | Bundles | vs reference | Gaps |
|--------|----------|-------|---------|--------------|------|
| W10864849 | `whirlpool_tl_dd` | 14 | 2 | **High** — TEST #1–12 | No diagram crops |
| W11416805 | `whirlpool_acu_tl_dryer` | 14 | 1 | **High** — TEST #1–9 | No diagrams; no 5a dryness |
| W11633848 | `whirlpool_dishwasher_acu` | 13 | 1 | **High** — §3 component tests | No vent wax motor; no UI F2E1 proc |
| W11416395 | `whirlpool_mvw6200` | 10 | 2 | **Good** — PSC TL, TEST #1–8 | No heater/bulk (N/A on platform) |
| NS-TDRE75W1 | `insignia_dryer_tdre` | 14 | 1 | **Good** — service test + components | No supply TEST #1; no dryness adjust |
| W10881701 | `whirlpool_ccu_dryer` | 16 | 2 | **High** — extends CCU + #8–#10 | Shares platform with W10680150 |

---

## New platforms — session 2 (today)

| Manual | Platform | Procs | Bundles | vs reference | Gaps |
|--------|----------|-------|---------|--------------|------|
| W11697231 | `whirlpool_tl_dd` | 10 | 2 | **Good** — WTW4950 PSC variant | No #9–12; different service entry |
| W11416787 | `whirlpool_tl_dd_5100` | 11 | 2 | **High** — WTW5100+ DD + Load&Go | Belt-drive section skipped; no #10 faucet |
| SAMSUNG-FL-BB8700-WASHER | `samsung_fl_washer_bb8700` | 10 | 3 | **Good** — error-code driven | No numbered TEST #; Smart Install entry |
| SAMSUNG-FL-BB8700-DRYER | `samsung_fl_dryer_bb8700` | 11 | 2 | **Good** — electric + gas split | Heat-pump HC paths partial |
| W8178629 | `whirlpool_centennial_dryer` | 11 | 1 | **Good** — §5/§6 component tests | Timer-era; not CCU TEST format |

---

## Platform map (all procedure-enabled)

| platformId | Template(s) | Manuals | Model hints |
|------------|-------------|---------|-------------|
| `whirlpool_fl_dd` | washer | W11169652 | WFW*, MHW* |
| `whirlpool_duet_sport` | washer | W8178558 | WFW83/85, MHW* |
| `whirlpool_duet_sport_dryer` | electric + gas dryer | W8178559 | WED83/85, WGD83/85 |
| `whirlpool_tl_dd` | washer | W10864849, W11697231 | WTW9500, WTW4950 |
| `whirlpool_tl_dd_5100` | washer | W11416787 | WTW51*, MVW51* |
| `whirlpool_mvw6200` | washer | W11416395 | MVW62*, WTW62* |
| `whirlpool_ccu_dryer` | electric + gas dryer | W10680150, W10881701 | WED/WGD (non-83/85) |
| `whirlpool_acu_tl_dryer` | electric + gas dryer | W11416805 | WED51*, WGD51* |
| `whirlpool_centennial_dryer` | electric + gas dryer | W8178629 | MED55/59*, WED4815* |
| `whirlpool_dishwasher_acu` | dishwasher | W11633848 | WDT*, MDB* |
| `insignia_dryer_tdre` | electric + gas dryer | NS-TDRE75W1 | TDRE*, TDRG* |
| `samsung_fl_washer_bb8700` | washer | SAMSUNG washer | WF50/53BB*, WF51CG* |
| `samsung_fl_dryer_bb8700` | electric + gas dryer | SAMSUNG dryer | DVE/DVG53BB*, DV50* |

---

## Cross-cutting gaps (all new manuals)

1. **Diagram crops** — Only W11169652, W8178558, W8178559 have pinout figure assets. All others: deferred.
2. **Service-mode depth** — W11169652 has QSC + component activation + load-test chains; most new platforms have entry + one test-mode bundle only.
3. **templateIds gating** — Gas/electric splits present where manual requires; optional features (steam, recirc, bulk dispense) not always model-gated.
4. **Belt-drive sections** — W11416787 manual includes belt models; only direct-drive TEST path built.

---

## PDFs extracted but NOT yet on manifest

| PDF | Notes |
|-----|-------|
| `technical-manual-w11798430-revc wed4100.pdf` | ACU TL dryer cousin to W11416805 |
| `technical-manual-W11800233-revc wtw4100.pdf` | TL washer |
| `technical-manual-w11455152-reva wtw6157.pdf` | Large TM |
| `technical-manual-W11794121-revb.pdf` | |
| `technical-manual-w11746350-revf.pdf` | |
| `technical-manual-w11737351-reva access manual fl dryers.pdf` | FL dryer access |
| `technical-manual-w11480208-revd WDT740SALB0.pdf` | Dishwasher (may overlap W11633848) |
| `technical-manual-w11499711-reve WDT750SAKB0.pdf` | Dishwasher |
| `service-manual-w11169659 wedmed9620.pdf` | Medallion dryer |
| `service-manual-w11174814-revb` ranges | Range — no washer template procedures yet |
| `technical-manual-w11174426-revb` ranges | Range |
| `jobaid-w10378809-kr38.pdf` | KitchenAid refrigerator |
| `jobaid-w10450109-kd-14.pdf` | Dishwasher job aid |
| Samsung TL washer/dryer (`wa50r5200`, `dv50r5200`) | Extracted; separate from BB8700 platform |
| Samsung fridges + range | Extracted or pending |
| `Job Aid - W10785366A` | Smart appliances CA |

**Skip:** TVs, bulletins, HTML-only microwave, near-dup CCU/Cabrio.

---

## Extraction-only platforms (DMA/evidence, no procedures yet)

These have `*_EXTRACTION.md` + measurement batches from Phase A/D but no procedure manifest entry:

- Samsung FlexWash (`samsung_flexwash`)
- Whirlpool dishwasher ACU legacy sheets (pre-W11633848)
- KitchenAid KDTM404 dishwasher
- LG LDT7808 dishwasher
- Insignia washer platforms (TWM/WMT)
- Midea/Insignia refrigerators
- Samsung SxS fridge, LG LRMVS fridge
- Whirlpool Jazz / KA French door
- GE GUD27 unitized (symptom-only)

---

## Recommended next pass (priority)

1. **W11798430** WED4100 — extend `whirlpool_acu_tl_dryer` (same family as W11416805)
2. **WDT740/750** tech sheets — merge into or alias `whirlpool_dishwasher_acu`
3. **Samsung TL** WA50/DV50 — new `samsung_tl_*` platforms from extracted text
4. **Diagram crops** — W10864849 ACU pinout (page 3-5), W11633848, CCU dryer page 9
5. **Playbook `.mdc` update** — add W10864849, W11633848, Samsung BB8700 checklists

---

## Local commits (ingestion only, newest first)

```
c2854a6b Centennial dryer routing
841d5e1c Samsung FL BB8700 washer + dryer
b95cc376 W11416787 manifest wiring
402a37f1 W11697231 WTW4950
595b0f68 W11416787 WTW5100+ seeds
9e2a07ae W10881701 WED9500
fe61f119 W11416395 MVW6200
3eed40af NS-TDRE75W1
32fcfa15 W11416805
7e110e75 W11633848 dishwasher
f8ce0ce9 W10864849 TL DD washer
```

**Push when ready:** `git push origin master` (11 ingestion commits ahead of remote).

---

## Smoke test quick reference

| Make + Model | Expected platform | Sample procedure |
|--------------|-------------------|------------------|
| Whirlpool WFW8300 | `whirlpool_duet_sport` | `w8178558-door-lock` |
| Whirlpool WTW9500 | `whirlpool_tl_dd` | `w10864849-test-08-lid-lock` |
| Whirlpool WTW5100 | `whirlpool_tl_dd_5100` | `w11416787-test-09-load-and-go` |
| Maytag MVW6200 | `whirlpool_mvw6200` | `w11416395-test-08-lid-lock` |
| Whirlpool WED4815 | `whirlpool_centennial_dryer` | `w8178629-electric-heater` |
| Whirlpool WED9500 | `whirlpool_ccu_dryer` | `w10881701-water-valve` |
| Samsung WF53BB8700 | `samsung_fl_washer_bb8700` | `samsungbb8700-door-lock` |
| Samsung DVE53BB8700 | `samsung_fl_dryer_bb8700` | `samsungbb8700-dryer-thermistor` |
| Insignia NS-TDRE75W1 | `insignia_dryer_tdre` | `nstdre75w1-outlet-thermistor` |

Dev harness: `/solomon/procedures/dev`
