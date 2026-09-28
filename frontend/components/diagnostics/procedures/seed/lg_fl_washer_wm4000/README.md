# LG WM4000H FL washer (`lg_fl_washer_wm4000`)

**Manual:** LG-FL-WASHER — WM4000H*A TurboWash Direct Drive family  
**Extraction:** `knowledge/pattern-catalog/LG_FL_WM4000H_WASHER_EXTRACTION.md`

12 procedures for pilot P03 prerequisite ingestion.

```bash
python backend/scripts/generate_lg_wm4000h_fl_washer_procedure_seeds.py
python backend/scripts/run_normalization_pipeline.py --manual LG-FL-WASHER
```
