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

## Reference paths

- Seed JSON: `backend/data/dma_error_codes_seed.json`
- SQL: `backend/database/supabase_dma_error_codes_seed.sql`
- Regenerate: `python backend/scripts/regenerate_dma_error_codes_sql.py`
- Extracted text: `backend/docs/manuals/*-extracted.txt`
- Solomon knowledge: `frontend/components/diagnostics/knowledge/`
- Routing: `frontend/components/diagnostics/routing/routingEngine.ts`
