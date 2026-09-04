# Service manual extraction queue

**Batch run:** Phase A (PDF extract + extraction docs + DMA seed) complete. **Phase B/C merged** for all batch platforms except Cabrio dryer near-dup.

**Regenerate text:** `python backend/docs/manuals/extract_pdf.py <pdf>`

---

## Already complete (prior sessions — do not re-extract)

| PDF | Extraction doc | DMA | Phase B/C |
|-----|----------------|-----|-----------|
| `whirlpool-electric-gas-dryers.pdf.pdf` | [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md) | ✅ | ✅ merged |
| `samsung-dryer-electric-gas.pdf` | [SAMSUNG_DRYER_MANUAL_COMPARISON.md](./SAMSUNG_DRYER_MANUAL_COMPARISON.md) | ✅ | ✅ merged |
| `samsung-refrigerator-sxs-svc manual.pdf` | [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md) | ✅ | ✅ merged |
| `Lg-lrmvs3006s-refrigerator-svc manual.pdf` | [LG_LRMVS3006S_EXTRACTION.md](./LG_LRMVS3006S_EXTRACTION.md) | ✅ | ✅ merged |
| `w10330404-r-111.pdf` | [WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md](./WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md) | ✅ | ✅ merged |
| `wiring-sheet-W10674984-RevA wrt311fzdt00.pdf` | [WRT311FDZT00_W10674984_EXTRACTION.md](./WRT311FDZT00_W10674984_EXTRACTION.md) | ✅ | ✅ merged |
| `whirlpoolmodularicemakerservicesheet-2225623.pdf` | [WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md](./WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md) | ✅ | ✅ merged |

**Next in queue (user):** *(empty — add next manual when ready)*

---

## Skipped (per instructions)

| File | Reason |
|------|--------|
| `XR65A80K.pdf` | TV — out of appliance scope |
| `panasonic_th-p65vt50_chassis_gpf15d-a.pdf` | TV |
| `samsung-service-bulletin-ice-maker.pdf` | Service bulletin |
| `WPL Top load Dryer Service Manual.pdf` | **Duplicate** of `whirlpool-electric-gas-dryers` CCU sheet (French pages only) |
| `cabrio.pdf` | **Cabrio-tier dryer** sheet W10680150D (trim line ≠ appliance type); near-dup of Whirlpool CCU dryer — see [CABRIO_MISFILE_NOTE.md](./CABRIO_MISFILE_NOTE.md) |

---

## Phase A complete (this batch)

| PDF | Appliance | Extraction doc | Extracted text | DMA batch |
|-----|-----------|----------------|----------------|-----------|
| `service-manual-w11169652-reva-27in-front-load-washers.pdf` | Washer (Whirlpool FL) | [WHIRLPOOL_W11169652_WASHER_EXTRACTION.md](./WHIRLPOOL_W11169652_WASHER_EXTRACTION.md) | ✅ | New FL codes |
| `wv55m9600av.pdf` | Washer (Samsung FlexWash) | [SAMSUNG_WV55M9600_WASHER_EXTRACTION.md](./SAMSUNG_WV55M9600_WASHER_EXTRACTION.md) | ✅ | Dual-load codes |
| `NS-TWM41WH8A insignia washer service manual.pdf` | Washer (Insignia) | [INSIGNIA_WASHER_PLATFORM_EXTRACTION.md](./INSIGNIA_WASHER_PLATFORM_EXTRACTION.md) | ✅ | Insignia E/F |
| `Service-Manual-NS-WMT41WA5.pdf` | Washer (Insignia) | ↑ same platform doc | ✅ | ↑ |
| `Whirlpool Dishwasher Service Manual.pdf` | Dishwasher (ADA legacy) | [WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md](./WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md) | ✅ | E1–E7 ADA |
| `Whirlpool dishwasher tech-sheet-W10751166-RevC.pdf` | Dishwasher | ↑ | ✅ | F#-E# matrix |
| `Tech Sheet - W10867183 - Rev B.pdf` | Dishwasher | ↑ | ✅ | ↑ |
| `Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142.pdf` | Dishwasher (KitchenAid) | [KITCHENAID_KDTM404KPS_DISHWASHER_EXTRACTION.md](./KITCHENAID_KDTM404KPS_DISHWASHER_EXTRACTION.md) | ✅ | F#E# ACU |
| `LDT7808ST.pdf` | Dishwasher (LG) | [LG_LDT7808ST_DISHWASHER_EXTRACTION.md](./LG_LDT7808ST_DISHWASHER_EXTRACTION.md) | ✅ | VARIO enrich |
| `WPL WRF757SD tech-sheet-w11509412-reva.pdf` | Refrigerator | [WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md](./WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md) | ✅ | IM E1–E5 |
| `KRMF706EBS01 tech-sheet-w11501234-revB.pdf` | Refrigerator | ↑ | ✅ | ↑ |
| `tech-sheet-w11050317-revb.pdf` | Refrigerator | ↑ | ✅ | — |
| `ServiceDataSheet-PRMC2285AF.pdf` | Refrigerator (Frigidaire Pro) | [FRIGIDAIRE_PRMC2285AF_EXTRACTION.md](./FRIGIDAIRE_PRMC2285AF_EXTRACTION.md) | ✅ | Er t1–t6 |
| `NS-RSS26SS Service Manual.pdf` | Refrigerator (Insignia/Midea) | [MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md](./MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md) | ✅ | E0–EP |
| `NS-UZ21WH0 insignia freezer.pdf` | Freezer (Insignia/Midea) | ↑ | ✅ | E2/E5/E6/E7/E9 |
| `gud27essmww.pdf` | Unitized laundry (dryer section) | [GE_GUD27_UNITIZED_EXTRACTION.md](./GE_GUD27_UNITIZED_EXTRACTION.md) | ✅ | Mechanical — no codes |
| `DRY_D80 – LG Error Codes.pdf` | Dryer (LG duct ref) | [LG_D80_DRYER_DUCT_REFERENCE_EXTRACTION.md](./LG_D80_DRYER_DUCT_REFERENCE_EXTRACTION.md) | ✅ | d85 + enrich |
| `Samsung ME11A7510DSAA microwave.pdf` | Microwave OTR | [MICROWAVE_OTR_BATCH_EXTRACTION.md](./MICROWAVE_OTR_BATCH_EXTRACTION.md) | ✅ | C-20, C-F1, C-F2 |
| `LMHM2237BD.pdf` | Microwave OTR (LG) | [MICROWAVE_OTR_BATCH_EXTRACTION.md](./MICROWAVE_OTR_BATCH_EXTRACTION.md) | ✅ | F-1, F-2, F-4 |
| `NS-DWR3SS1 service manual again-ocr.pdf` | Dishwasher (Insignia) | [INSIGNIA_DWR3SS1_DISHWASHER_EXTRACTION.md](./INSIGNIA_DWR3SS1_DISHWASHER_EXTRACTION.md) | ✅ | E1–E9, Ed |
| `NS-TDRE75W1 Service Manual.pdf` | Dryer (Insignia electric/gas) | [INSIGNIA_TDRE75W1_DRYER_EXTRACTION.md](./INSIGNIA_TDRE75W1_DRYER_EXTRACTION.md) | ✅ | E4, E5, C9 |
| `NS-RTM18SS2 Service Manual.pdf` | Refrigerator (Insignia top-freezer) | [INSIGNIA_RTM18SS2_REFRIGERATOR_EXTRACTION.md](./INSIGNIA_RTM18SS2_REFRIGERATOR_EXTRACTION.md) | ✅ | Uses existing E-family |
| `NS-TWM35W1 Service Manual.pdf` | Washer (Insignia) | [INSIGNIA_WASHER_PLATFORM_EXTRACTION.md](./INSIGNIA_WASHER_PLATFORM_EXTRACTION.md) | ✅ | +F5 load sense |

**Note:** Use `NS-DWR3SS1 service manual again-ocr.pdf` — non-OCR PDF has image pages PyMuPDF cannot read.

---

## Blocked / pending re-source

| File | Issue | Action |
|------|-------|--------|
| `NS-DWR3SS1 service manual again.pdf` | Image pages — use **`-ocr.pdf`** instead | Canonical source is `-ocr` variant |
| `ME21A706BQN Service Manual.html` | HTML Samsung microwave | Optional HTML→text pass |
| Cabrio **washer** tech sheet | Not in folder yet | Cabrio is a trim line; `cabrio.pdf` is the **dryer** sheet only — add WTW\*/MVW\* washer PDF separately if needed |
| `Samsung ME11A7510DSAA microwave.pdf` | Removed by user | LG LMHM2237BD covers OTR microwave batch |

---

## Phase B/C backlog

**Merged:** W11169652 washer, Insignia washer, Midea/Insignia fridge+freezer+RTM18, dishwasher ACU (Whirlpool/KitchenAid/Insignia/LG), French door ice E-codes, Frigidaire Er t*, Insignia dryer, LG duct, LG microwave OTR, **Samsung FlexWash WV55M9600**, **GE GUD27 unitized**.

**Still deferred:**

| Platform | Why |
|----------|-----|
| Cabrio dryer PDF | Near-dup of merged Whirlpool CCU dryer |
| Whirlpool dishwasher DMA F# mis-map fix | Seed cleanup only |

**Supabase:** After DMA seed changes, re-run `backend/database/supabase_dma_error_codes_seed.sql` in Supabase.

---

---

## Phase D — brand-aware measurements (batch9)

**Status:** Merged for all big-batch platforms with extractable Ω/V specs.

| Platform | `platformId` | Seed batch | Key bindings |
|----------|--------------|------------|--------------|
| Whirlpool FL washer | `whirlpool_fl_dd` | batch8 | motor, inlet, drain, heater, recirc |
| Samsung FlexWash | `samsung_flexwash` | batch8 | motor, drain, heater, inlet |
| Insignia washer TWM/TWM35 | `insignia_washer_cap` | batch9 | inlet kΩ, drain, door lock |
| Insignia washer WMT41 | `insignia_washer_freq` | batch8+9 | inlet, drain, motor, level kHz |
| Whirlpool/KA dishwasher ACU | `whirlpool_dishwasher_acu` | batch9 | wash/drain motor, heater, valve, OWI |
| Insignia DWR3 dishwasher | `insignia_dishwasher` | batch9 | valve, drain, heater, thermistor |
| LG LDT dishwasher | `lg_dishwasher_ldt` | batch9 | vario ~4 kΩ (seed only) |
| Midea/Insignia RSS + RTM18 | `midea_rss` | batch9 | B3839 NTC, defrost heater |
| Midea/Insignia UZ21 freezer | `midea_uz21` | batch9 | B3839 NTC, defrost heater |
| Insignia TDRE dryer | `insignia_dryer_tdre` | batch9 | heater, outlet NTC |
| Whirlpool/Maytag CCU dryer | `whirlpool_ccu_dryer` | batch9 | dual element ≤50 Ω |
| Samsung SxS fridge | `samsung_sxs` | batch6 | defrost 63 Ω, voltage checks |
| LG LRMVS fridge | `lg_lrmvs` | batch7 | fan V, defrost V/Ω |
| GE GUD27 unitized | — | — | Symptom/timer only (no Ω layer) |
| Frigidaire Pro PRMC | — | — | Er t* codes only; no numeric specs in sheet |
| Whirlpool/KA French door | `whirlpool_ka_french_door` | generic | Ice E-codes; defrost still generic |

**Deferred:** FlexWash upper door lock (175 Ω), bubble pump; Insignia level-sensor dedicated field; LG dishwasher wash-motor Ω from garbled LDT PDF.

---

## Brand coverage checklist (one manual per appliance type)

**Goal:** One ingested service manual (or tech sheet) per **brand × appliance type**, mapped to Solomon diagnostic templates.

**Legend:** `[x]` = manual in repo + extraction doc (Phase A at minimum) · `[~]` = partial / platform-shared · `[ ]` = not yet sourced

**Appliance types (10):**

| Code | Type | Solomon template |
|------|------|------------------|
| REF | Refrigerator | `refrigerator` |
| FRZ | Freezer (standalone) | `standalone_freezer` |
| WSH | Washing machine | `washer` |
| DRY | Dryer (electric or gas) | `electric_dryer` / `gas_dryer` |
| DW | Dishwasher | `dishwasher` |
| MW | Microwave | `microwave` |
| ER | Electric range / oven | `electric_range` |
| GR | Gas range / oven | `gas_range` |
| AIO | AIO / combo laundry | `aio_laundry` |
| STK | Stacked / unitized laundry | `stacked_laundry` |

**Progress (core 7 brands):** ~28 / 70 cells covered · **~42 gaps** remaining  
**Progress (all 11 brands incl. Maytag/Bosch/Kenmore/Electrolux):** ~28 / 110 · **~82 gaps**

---

### Coverage matrix

| Brand | REF | FRZ | WSH | DRY | DW | MW | ER | GR | AIO | STK |
|-------|-----|-----|-----|-----|----|----|----|----|-----|-----|
| **Samsung** | [x] | [ ] | [x] | [x] | [ ] | [x] | [ ] | [ ] | [ ] | [ ] |
| **LG** | [x] | [ ] | [ ] | [~] | [x] | [x] | [ ] | [ ] | [ ] | [ ] |
| **Whirlpool** | [x] | [ ] | [x] | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |
| **KitchenAid** | [~] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |
| **GE** | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] |
| **Frigidaire** | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Insignia** | [x] | [x] | [x] | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Maytag | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Bosch | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Kenmore | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Electrolux | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

**Partial notes:**

- **LG DRY `[~]`** — `DRY_D80 – LG Error Codes.pdf` only (duct codes); need full dryer service manual.
- **KitchenAid REF `[~]`** — shares [WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md](./WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md) with Whirlpool.
- **GE STK `[x]`** — [GE_GUD27_UNITIZED_EXTRACTION.md](./GE_GUD27_UNITIZED_EXTRACTION.md); dryer timer platform; washer is mechanical in same cabinet.
- **Maytag / Kenmore** — usually Whirlpool or Electrolux rebadge; source parent OEM manual when possible.
- **Bosch** — DMA seed rows exist; no manual ingested yet.

---

### Per-brand sourcing checklist

Copy a row into Phase A when PDF lands in `backend/docs/manuals/`.

#### Samsung

- [x] REF — `samsung-refrigerator-sxs-svc manual.pdf`
- [ ] FRZ
- [x] WSH — `wv55m9600av.pdf` (FlexWash)
- [x] DRY — `samsung-dryer-electric-gas.pdf`
- [ ] DW — *suggest: DW80\* / Linear Wash platform*
- [x] MW — `Samsung ME11A7510DSAA microwave.pdf` *(optional: `ME21A706BQN` HTML)*
- [ ] ER
- [ ] GR
- [ ] AIO — *suggest: FlexDry / Bespoke combo*
- [ ] STK

#### LG

- [x] REF — `Lg-lrmvs3006s-refrigerator-svc manual.pdf`
- [ ] FRZ
- [ ] WSH — *suggest: WM4000\* / WM3900\* TurboWash platform*
- [~] DRY — duct ref only; *suggest: DLE/ DLG 7000\* full manual*
- [x] DW — `LDT7808ST.pdf`
- [x] MW — `LMHM2237BD.pdf`
- [ ] ER
- [ ] GR
- [ ] AIO — *suggest: WM6998\* WashTower / combo*
- [ ] STK

#### Whirlpool

- [x] REF — `WPL WRF757SD tech-sheet-w11509412-reva.pdf` (+ KA sheet)
- [ ] FRZ — *standalone chest/upright; not French-door platform*
- [x] WSH — `service-manual-w11169652-reva-27in-front-load-washers.pdf`
- [x] DRY — `whirlpool-electric-gas-dryers.pdf.pdf`
- [x] DW — Whirlpool dishwasher platform sheets
- [ ] MW — *suggest: WMH310\* / WMH535\* OTR*
- [ ] ER — *suggest: WFE550\* / WFE515\**
- [ ] GR — *suggest: WFG550\* / WFG515\**
- [ ] AIO — *suggest: WFC682\* / YWED\**
- [ ] STK

#### KitchenAid

- [~] REF — KRMF706 platform (see Whirlpool French door doc)
- [ ] FRZ
- [ ] WSH — *usually Whirlpool/Maytag platform — source W111\* or MVW\* if needed*
- [ ] DRY
- [x] DW — `Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142.pdf`
- [ ] MW
- [ ] ER
- [ ] GR
- [ ] AIO
- [ ] STK

#### GE

- [ ] REF — *suggest: GNE27\* / GSS25\**
- [ ] FRZ
- [ ] WSH — *standalone; GUD27 washer is mechanical only*
- [ ] DRY — *standalone electronic; GUD27 covers unitized timer only*
- [ ] DW — *suggest: GDT655\* / GDT225\**
- [ ] MW
- [ ] ER — *suggest: JBS360\* / JBP\**
- [ ] GR — *suggest: JGBS66\* / JGB\**
- [ ] AIO
- [x] STK — `gud27essmww.pdf`

#### Frigidaire

- [x] REF — `ServiceDataSheet-PRMC2285AF.pdf` (Pro Er t\*)
- [ ] FRZ
- [ ] WSH
- [ ] DRY
- [ ] DW — *suggest: FGID2479\* / Gallery platform*
- [ ] MW
- [ ] ER
- [ ] GR
- [ ] AIO
- [ ] STK

#### Insignia (Midea OEM)

- [x] REF — `NS-RSS26SS` + `NS-RTM18SS2 Service Manual.pdf`
- [x] FRZ — `NS-UZ21WH0 insignia freezer.pdf`
- [x] WSH — NS-TWM41 / NS-WMT41 / NS-TWM35 platform
- [x] DRY — `NS-TDRE75W1 Service Manual.pdf`
- [x] DW — `NS-DWR3SS1 service manual again-ocr.pdf`
- [ ] MW
- [ ] ER
- [ ] GR
- [ ] AIO
- [ ] STK

#### Maytag · Bosch · Kenmore · Electrolux

No dedicated manuals in repo. **Strategy:**

| Brand | Typical OEM parent | Notes |
|-------|-------------------|--------|
| Maytag | Whirlpool | Often same tech sheet as Whirlpool/MVW\* |
| Kenmore | Whirlpool or Electrolux | Match model prefix to parent |
| Bosch | Bosch | SHPM\* dishwasher is highest ROI (DMA codes already seeded) |
| Electrolux | Electrolux / Frigidaire | EIFLS\* / EIMED\* laundry; ERFG\* fridge |

---

### Priority pickup queue (suggested next 10)

Work top-down; check off in matrix above when Phase A completes.

| # | Brand | Type | Suggested model / platform | Why |
|---|-------|------|---------------------------|-----|
| 1 | LG | WSH | WM4000H\* / WM3900H\* | Largest gap in a high-volume brand |
| 2 | LG | DRY | DLE/ DLG 7100\* or 7000\* full SVC manual | Replace duct-code-only partial |
| 3 | GE | REF | GNE27J\* / PFE28\* | GE has only unitized laundry today |
| 4 | GE | DW | GDT655\* / GDT225\* | Common builder-grade calls |
| 5 | Whirlpool | MW | WMH31017\* / WMH53521\* | OTR volume; complements LG/Samsung MW |
| 6 | Whirlpool | ER | WFE550\* electric range | No range coverage any brand except partial |
| 7 | Samsung | DW | DW80R\* / DW80B\* | Completes Samsung major-appliance row |
| 8 | Frigidaire | DW | FGID2479\* Gallery | Pairs with existing Pro fridge sheet |
| 9 | Bosch | DW | SHPM88Z\* / SHPM65\* | DMA seed exists — manual unlocks validation |
| 10 | Whirlpool or LG | AIO | WFC682\* or WM6998\* | Only template with zero brand coverage |

---

### When a manual arrives (workflow)

1. Drop PDF in `backend/docs/manuals/`
2. `python backend/docs/manuals/extract_pdf.py <pdf>`
3. Add `*_EXTRACTION.md` in this folder
4. Append DMA rows if codes present (`append_manual_batch_dma_seed.py`)
5. Phase B/C: template · chips · routing · evidence · **platform measurement bindings** (see [BRAND_AWARE_MEASUREMENTS_SPEC.md](../BRAND_AWARE_MEASUREMENTS_SPEC.md)) · `npx tsc --noEmit`
6. Update matrix `[ ]` → `[x]` in this section

---

## Reference paths

- Seed JSON: `backend/data/dma_error_codes_seed.json`
- SQL: `backend/database/supabase_dma_error_codes_seed.sql`
- Regenerate: `python backend/scripts/regenerate_dma_error_codes_sql.py`
- Extracted text: `backend/docs/manuals/*-extracted.txt`
- Solomon knowledge: `frontend/components/diagnostics/knowledge/`
- Routing: `frontend/components/diagnostics/routing/routingEngine.ts`
- Brand-aware measurements (proposed): [BRAND_AWARE_MEASUREMENTS_SPEC.md](../BRAND_AWARE_MEASUREMENTS_SPEC.md)
