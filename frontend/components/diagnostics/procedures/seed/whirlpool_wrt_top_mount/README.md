# whirlpool_wrt_top_mount — W10330404 procedure seeds

**Manual:** Whirlpool Top-Mount Refrigerator Job Aid (W10330404 R-111)  
**Platform:** `whirlpool_wrt_top_mount` — WRT*, W8T*, W4T*, MRT*, ART* (non-WRT311)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10330404
```

## Procedures (7)

| ID | OEM | Tags |
|----|-----|------|
| w10330404-defrost-heater | §4-5 | RD, DF, frost_buildup |
| w10330404-defrost-bimetal | §4-8 | DF, frost_buildup |
| w10330404-defrost-timer | §3-12 | DF, TIMER |
| w10330404-ptc-start | §5-9 | PTCOPEN, OL |
| w10330404-condenser-fan | §5-3 | running_often, airflow |
| w10330404-ice-maker-fuse | §6-2 | IMFUSE, ice_maker |
| w10330404-compressor-windings | §5-6 | not_cooling, OL |

## WO smoke

Whirlpool `WRT518SZFM` → `whirlpool_wrt_top_mount`; frost + RD → `w10330404-defrost-heater`.
