# Samsung TL washer CG71 (`samsung_tl_washer_cg71`)

**Manual:** SAMSUNG-TL-CG71-WASHER — `samsung tl new style.pdf`  
**Platform:** `samsung_tl_washer_cg71` — WA55CG*, WA54CG*, WA55A7*  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_TL_CG71_WASHER_EXTRACTION.md`

16 procedures + 3 Smart Install bundles (§5-1 Test Mode). Separate from A50 (`WA50R*`) — same architecture, CG71 adds **SDC** detergent-drawer code.

**Diagrams:** 6 crops from §3-1 disassembly (p.16–22).

```bash
python backend/scripts/crop_samsung_tl_cg71_washer_procedure_figures.py
python backend/scripts/generate_samsung_tl_cg71_washer_procedure_seeds.py
```

Smoke: `/solomon/procedures/dev` with **WA55CG7100** + Samsung.
