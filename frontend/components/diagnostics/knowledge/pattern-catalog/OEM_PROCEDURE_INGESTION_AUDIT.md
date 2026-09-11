# OEM Procedure Ingestion Audit Report

**Date:** 2026-03-09 (updated session 6 — remainder complete)  
**Reference depth:** W11169652 (17 TEST procedures + 6 service-mode bundles + diagram crops + diagnostic effects)  
**Ship gate:** `validate_procedure_seed.py` — **526 procedures / 81 bundles PASS** · `npx tsc --noEmit` PASS  
**Git:** All work **local only** (not pushed to `origin/master`)

---

## Summary

| Metric | Start | S1 | S2 | S3 | S4 | S5 | S6 |
|--------|-------|----|----|----|----|----|-----|
| Manifest manuals | 4 | 11 | 15 | 26 | 31 | 38 | **49** |
| Procedure seeds | ~51 | ~135 | 188 | 267 | 343 | 414 | **526** |
| Service-mode bundles | ~12 | ~19 | 29 | 43 | 54 | 68 | **81** |
| Platforms with procedures | 4 | 8 | 12 | 18 | 22 | 28 | **37** |

---

## Reference tier (gold standard)

| Manual | Platform | Procs | Bundles | Diagrams | Notes |
|--------|----------|-------|---------|----------|-------|
| **W11169652** | `whirlpool_fl_dd` | 17 | 6 | 8 crops | Deepest — QSC, component activation, load tests |
| W8178558 | `whirlpool_duet_sport` | 9 | 2 | 8 crops | Job aid TEST #1–8 |
| W8178559 | `whirlpool_duet_sport_dryer` | 13 | 1 | 6 crops | Fuel-split electric/gas |
| W10680150 | `whirlpool_ccu_dryer` | 13 | 1 | **5 crops** | CCU Figure 11 pinout + strip circuits |
| W10881701 | `whirlpool_ccu_dryer` | 16 | 2 | **5 delta crops** | J14 pinout + steam valve on shared CCU folder |
| W11416805 | `whirlpool_acu_tl_dryer` | 14 | 1 | **7 crops** | ACU pinout, motor, thermal, strip circuits |
| W11416395 | `whirlpool_mvw6200` | 10 | 2 | **2 crops** | ACU pinout + PSC bottom view |
| W11416787 | `whirlpool_tl_dd_5100` | 11 | 2 | **2 crops** | DD pinout + drive area |

---

## New platforms — session 1 (overnight batch)

| Manual | Platform | Procs | Bundles | vs reference | Gaps |
|--------|----------|-------|---------|--------------|------|
| W10864849 | `whirlpool_tl_dd` | 14 | 2 | **High** — TEST #1–12 | **9 diagram crops** (ACU pinout + strip circuits) |
| W11416805 | `whirlpool_acu_tl_dryer` | 14 | 1 | **High** — TEST #1–9 | **7 diagram crops**; no 5a dryness |
| W11633848 | `whirlpool_dishwasher_acu` | 13 | 1 | **High** — §3 component tests | **7 diagram crops**; no vent wax motor proc |
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

## New / extended — session 3 (today)

| Manual | Platform | Procs | Bundles | vs reference | Gaps |
|--------|----------|-------|---------|--------------|------|
| W11798430 | `whirlpool_acu_tl_dryer` | 12 | 1 | **High** — WED4100 ACU TL | No moisture/steam; J7/J4 pinout |
| W11480208 | `whirlpool_dishwasher_acu` | 8 delta | 1 | **High** — WDT740 filtration | 9 procedures reused from W11633848 |
| SAMSUNG-TL-A50 | `samsung_tl_washer_a50` | 15 | 3 | **Good** — error-code + Test Mode | No numbered TEST # |
| SAMSUNG-TL-DV50 | `samsung_tl_dryer_dv50` | 11 | 1 | **Good** — electric + gas split | Flame sensor µA deferred |
| W11169659 | `whirlpool_ccu_dryer` | 4 delta + 10 shared | 2 | **High** — MED9620 steam | 10 seeds shared with W10881701 |
| W11499711 | `whirlpool_dishwasher_acu` | 1 delta + 13 reused | 0 | **Good** — WDT750 microfiltration | SSM wash motor 10–15 Ω only delta |
| SAMSUNG-FL-DV6000 | `samsung_fl_dryer_dv6000` | 9 | 2 | **Good** — heat-pump electric | Gas DVG45T not on platform |
| W11800233 | `whirlpool_tl_dd_4100` | 9 | 2 | **High** — WTW4100 belt PSC | New platform; shifter architecture |
| W11455152 | `whirlpool_tl_dd_6157` | 9 | 2 | **High** — WTW6157 PSC | MVW6200 pinout; separate routing |
| W11794121 | `whirlpool_dishwasher_acu` | 1 delta + 13 reused | 0 | **Good** — JennAir 24" filtration | D.O.S. P9 only new seed |

---

## New / extended — session 4 (today)

| Manual | Platform | Procs | Bundles | vs reference | Gaps |
|--------|----------|-------|---------|--------------|------|
| SAMSUNG-RF260B | `samsung_sxs` | 16 | 2 | **Good** — SxS self-diagnostic | First fridge procedures on platform |
| SAMSUNG-RF23BB | `samsung_fridge_bespoke` | 18 | 3 | **Good** — Bespoke 4-door | Shared platform with RF32CG |
| SAMSUNG-RF32CG | `samsung_fridge_bespoke` | 5 delta + shared | 2 | **Good** — CG variant heaters | 24 Ω damper/ice pipe vs 72/135 |
| W11746350 | `whirlpool_freestanding_range` | 12 | 1 | **Good** — ACU range | electric + gas split |
| W11174426 | `whirlpool_freestanding_range` | 9 | 1 | **Good** — legacy component §3 | Infinite switch electric only |
| SAMSUNG-NX60 | `samsung_range_nx60` | 17 | 2 | **Good** — error-code driven | First range platform for Samsung |

---

## New / extended — session 5 (today)

| Manual | Platform | Procs | Bundles | vs reference | Gaps |
|--------|----------|-------|---------|--------------|------|
| W11174814 | `whirlpool_freestanding_range` | 5 delta + 21 shared | 2 | **Good** — KA/Kenmore/JennAir | Indigo ceran + warming drawer |
| W10322959 | `whirlpool_jazz_french_door` | 10 | 2 | **Good** — S-E service tests | No IM E-codes (Jazz era) |
| W11366142 | `whirlpool_dishwasher_acu` | 6 delta + 10 reused | 0 | **Good** — KDTM404 premium | RIF filter, vent wax, tub light |
| W10785366A | `whirlpool_connected_smart_gen3` | 6 | 4 | **Good** — smart-layer only | WiFi/PMM/CT; not base components |
| W11509412 | `whirlpool_ka_french_door` | 13 | 1 | **High** — ice E0–E5 + tests | First ACU French door procs |
| LG-LDT7808 | `lg_dishwasher_ldt7808` | 10 | 2 | **Good** — IE/OE/VARIO | First LG dishwasher platform |
| SAMSUNG-FLEXWASH | `samsung_flexwash` | 22 | 3 | **High** — dual-load AC7/DC4 | Upper+lower compartment split |

---

## New / extended — session 6 (remainder batch)

| Manual | Platform | Procs | Bundles | Notes |
|--------|----------|-------|---------|-------|
| LG-LRMVS-FRIDGE | `lg_lrmvs` | 17 | 2 | InstaView 4-door; PCB test ×1/×2/×3 |
| MIDEA-RSS-FRIDGE | `midea_rss` | 11 | 1 | NS-RSS26 SxS + VFD |
| MIDEA-UZ21-FREEZER | `midea_uz21` | 7 | 2 | NS-UZ upright freezer |
| INSIGNIA-TWM-WASHER | `insignia_washer_cap` | 8 | 1 | Capacitive level TWM41/TWM35 |
| INSIGNIA-WMT-WASHER | `insignia_washer_freq` | 7 | 1 | Frequency level WMT41 |
| INSIGNIA-DWR3-DISHWASHER | `insignia_dishwasher` | 9 | 1 | Midea E-family |
| W10330404 | `whirlpool_wrt_top_mount` | 7 | 0 | Mechanical timer job aid |
| W10674984 | `whirlpool_wrt311_adc` | 5 | 1 | ADC 2000 WRT311* |
| WHIRLPOOL-2225623-ICE-MAKER | `whirlpool_modular_ice_maker` | 8 | 0 | Brand-wide IM module |
| FRIGIDAIRE-PRMC-FRIDGE | `frigidaire_prmc_french_door` | 9 | 1 | Er t1–t6 + FFIM |
| LG-LMHM2237-MICROWAVE | `lg_microwave_otr` | 12 | 1 | First microwave platform |
| GE-GUD27-STACKED | `ge_gud27_stacked` | 6 | 0 | Mechanical timer dryer |
| W11187658 | `whirlpool_dishwasher_ada` | 6 | 1 | ADA legacy E-codes |
| INSIGNIA-RTM18-FRIDGE | `midea_rss` | 5 reused + 1 bundle | 1 | Delta manifest only |

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
| `whirlpool_ccu_dryer` | electric + gas dryer | W10680150, W10881701, W11169659 | WED/WGD/MED96* |
| `whirlpool_acu_tl_dryer` | electric + gas dryer | W11416805, W11798430 | WED51*, WED41* |
| `whirlpool_centennial_dryer` | electric + gas dryer | W8178629 | MED55/59*, WED4815* |
| `whirlpool_dishwasher_acu` | dishwasher | W11633848, W11480208, W11499711, W11794121 | WDT*, MDB*, JDP* |
| `whirlpool_tl_dd_4100` | washer | W11800233 | WTW41*, WTW40* |
| `whirlpool_tl_dd_6157` | washer | W11455152 | WTW61*, MVW61* |
| `insignia_dryer_tdre` | electric + gas dryer | NS-TDRE75W1 | TDRE*, TDRG* |
| `samsung_fl_washer_bb8700` | washer | SAMSUNG-FL-BB8700 | WF50/53BB*, WF51CG* |
| `samsung_fl_dryer_bb8700` | electric + gas dryer | SAMSUNG-FL-BB8700 | DVE/DVG53BB* |
| `samsung_fl_dryer_dv6000` | electric_dryer | SAMSUNG-FL-DV6000 | DV6000*, DVE45T*, DV45T60* |
| `samsung_tl_washer_a50` | washer | SAMSUNG-TL-A50 | WA50*, WF45A* |
| `samsung_tl_dryer_dv50` | electric + gas dryer | SAMSUNG-TL-DV50 | DV50R*, DVE50*, DVG50* |
| `samsung_sxs` | refrigerator | SAMSUNG-RF260B | RF260*, RF261* |
| `samsung_fridge_bespoke` | refrigerator | SAMSUNG-RF23BB, RF32CG | RF23BB*, RF32CG*, RF31CG* |
| `whirlpool_freestanding_range` | electric + gas range | W11746350, W11174426 | WFE*, WFG*, MER*, MGR* |
| `samsung_range_nx60` | electric + gas range | SAMSUNG-NX60 | NX60*, NE63* |
| `whirlpool_jazz_french_door` | refrigerator | W10322959 | WRF53–56*, KRMF55* |
| `whirlpool_ka_french_door` | refrigerator | W11509412 | WRF7/8*, KRMF70* |
| `whirlpool_connected_smart_gen3` | multi-template smart layer | W10785366A | WTW8700*, WED8700*, WDT995* |
| `lg_dishwasher_ldt7808` | dishwasher | LG-LDT7808 | LDT7808*, LSDT9908* |
| `samsung_flexwash` | washer | SAMSUNG-FLEXWASH | WV55* |
| `lg_lrmvs` | refrigerator | LG-LRMVS-FRIDGE | LRMVS* |
| `midea_rss` | refrigerator | MIDEA-RSS, INSIGNIA-RTM18 | NS-RSS*, NS-RTM* |
| `midea_uz21` | standalone_freezer | MIDEA-UZ21 | NS-UZ* |
| `insignia_washer_cap` | washer | INSIGNIA-TWM | NS-TWM* |
| `insignia_washer_freq` | washer | INSIGNIA-WMT | NS-WMT* |
| `insignia_dishwasher` | dishwasher | INSIGNIA-DWR3 | NS-DWR3* |
| `whirlpool_wrt_top_mount` | refrigerator | W10330404 | WRT*, W8T*, MRT* |
| `whirlpool_wrt311_adc` | refrigerator | W10674984 | WRT311* |
| `whirlpool_modular_ice_maker` | refrigerator | 2225623 | brand-wide |
| `frigidaire_prmc_french_door` | refrigerator | FRIGIDAIRE-PRMC | PRMC*, FRMC* |
| `lg_microwave_otr` | microwave | LG-LMHM2237 | LMHM*, LMVM* |
| `ge_gud27_stacked` | stacked_laundry | GE-GUD27 | GUD27* |
| `whirlpool_dishwasher_ada` | dishwasher | W11187658 | WDTA1*, WDF* |

---

## Cross-cutting gaps (all new manuals)

1. **Diagram crops** — Nine platform asset folders: W11169652, W8178558, W8178559, W10864849, W11633848, W10680150 (+ W10881701 delta), W11416805, W11416395, W11416787. Remaining 28 platforms: deferred.
2. **Service-mode depth** — W11169652 has QSC + component activation + load-test chains; most new platforms have entry + one test-mode bundle only.
3. **templateIds gating** — Gas/electric splits present where manual requires; optional features (steam, recirc, bulk dispense) not always model-gated.
4. **Belt-drive sections** — W11416787 manual includes belt models; only direct-drive TEST path built.

---

## PDFs extracted but NOT yet on manifest

| PDF | Notes |
|-----|-------|
| `technical-manual-w11746350-revf.pdf` | **Range** — access/removal only; no TEST # |
| `technical-manual-w11737351-reva access manual fl dryers.pdf` | **Access diagrams** — crops attach to `whirlpool_ccu_dryer` W10881701/W11169659 steps; WED7*/WED5620* route to shared platform |
| `jobaid-w10758836-l-87.pdf` | Cabrio WTW8500 — routes to `whirlpool_tl_dd`; reuses W10864849 seeds |
| `service-manual-w11174814-revb` ranges | Range — no range template yet |
| `technical-manual-w11174426-revb` ranges | Range |
| `jobaid-w10378809-kr38.pdf` | KitchenAid refrigerator — extracted |
| `jobaid-w10450109-kd-14.pdf` | Dishwasher job aid — extracted; no TEST # |
| `samsung frdige rf260b.pdf` | Samsung fridge — extracted |
| `samsung fridge rf23bb.pdf` | Samsung fridge — extracted |
| `samsung fridge rf32cg.pdf` | Samsung fridge — pending extract |
| `samsung range nx60t8311s.pdf` | Samsung range — pending extract |
| `samsung fl dryer dv6000t.pdf` | **Done** → `samsung_fl_dryer_dv6000` |
| `Job Aid - W10785366A` | Smart appliances CA |
| `whirlpool-electric-gas-dryers.pdf` | Near-dup of W10680150 |

**Skip:** TVs, bulletins, HTML-only microwave, near-dup CCU/Cabrio, access-only manuals.

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

## Remaining (deferred / low yield)

| Item | Reason |
|------|--------|
| `jobaid-w10378809-kr38.pdf` | KA range TEST MODE relay checks only — thin vs `whirlpool_freestanding_range` |
| `samsung-refrigerator-sxs-svc manual.pdf` | Superseded by RF260B on `samsung_sxs` |
| `Whirlpool dishwasher tech-sheet-W10751166` | F#E# matrix covered by `whirlpool_dishwasher_acu` |
| `ME21A706BQN Service Manual.html` | Samsung OTR HTML — optional C-* family |
| **Diagram crops (remaining)** | 28 platforms without strip-circuit pages |
| **Bosch** | No manual in repo |

---

## Local commits (ingestion only, newest first)

```
86ddf613 W11794121 JennAir dishwasher D.O.S.
b4c55ad9 W11455152 WTW6157
a51e4118 W11800233 WTW4100
d53e139a Samsung FL DV6000T
0c1a649e W11169659 MED9620
c683cf88 W11499711 WDT750
97f73f3f W11798430 WED4100
94c74f97 Samsung TL A50 + DV50
25a351ab W11480208 WDT740
… (session 1–2 commits below)
```

**Push when ready:** `git push origin master` (~22 ingestion commits ahead of remote).

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
| Whirlpool WED9620 | `whirlpool_ccu_dryer` | `w11169659-moisture-sensor` |
| Whirlpool WED4100 | `whirlpool_acu_tl_dryer` | `w11798430-thermistors` |
| Whirlpool WTW4100 | `whirlpool_tl_dd_4100` | `w11800233-test-07-lid-lock` |
| Whirlpool WTW6157 | `whirlpool_tl_dd_6157` | `w11455152-test-07-lid-lock` |
| Whirlpool WDT740 | `whirlpool_dishwasher_acu` | `w11480208-diverter-motor` |
| Samsung WA50R5200 | `samsung_tl_washer_a50` | `samsungtla50-door-lock` |
| Samsung DVE50R5200 | `samsung_tl_dryer_dv50` | `samsungtldv50-thermistor` |
| Samsung DVE45T6000 | `samsung_fl_dryer_dv6000` | `samsungdv6000-heat-pump-compressor` |
| Samsung RF260BEAESR | `samsung_sxs` | `samsungrf260b-fz-defrost-heater` |
| Samsung RF23BB8600 | `samsung_fridge_bespoke` | `samsungbespoke-freezer-defrost-heater` |
| Whirlpool WFE550S0HZ | `whirlpool_freestanding_range` | `w11746350-oven-sensor` |
| Samsung NX60T8311SS | `samsung_range_nx60` | `samsungnx60-oven-sensor` |
| Samsung WF53BB8700 | `samsung_fl_washer_bb8700` | `samsungbb8700-door-lock` |
| Samsung DVE53BB8700 | `samsung_fl_dryer_bb8700` | `samsungbb8700-dryer-thermistor` |
| Insignia NS-TDRE75W1 | `insignia_dryer_tdre` | `nstdre75w1-outlet-thermistor` |

Dev harness: `/solomon/procedures/dev`
