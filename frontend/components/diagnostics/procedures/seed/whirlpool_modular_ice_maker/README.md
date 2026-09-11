# whirlpool_modular_ice_maker — 2225623 procedure seeds

**Manual:** WHIRLPOOL-2225623-ICE-MAKER — Modular ice maker service sheet (part 2225623, 120 V)  
**Platform:** `whirlpool_modular_ice_maker` (brand-wide, no model pattern)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md`

8 procedures covering L/N/M/T/H/V test points, harness fuse, fill adjustment, and IME2–IME5 routing.

Regenerate: `python backend/scripts/generate_w2225623_ice_maker_procedure_seeds.py`

WO smoke: any Whirlpool/Maytag/KitchenAid/Amana refrigerator + `ice_maker` chip → `whirlpool_modular_ice_maker`; IME2 → `w2225623-motor-circuit`; IME4 → `w2225623-water-valve`.
