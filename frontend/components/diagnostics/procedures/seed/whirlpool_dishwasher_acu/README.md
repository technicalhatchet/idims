# whirlpool_dishwasher_acu procedure seeds

Manuals **W11633848** (Amana & Whirlpool 24" dishwasher), **W11480208** (filtration WDT740), and **W11499711** (microfiltration WDT750).

Regenerate W11633848:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11633848
```

Regenerate W11480208 (filtration-specific procedures):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11480208
```

Regenerate W11499711 (WDT750 SSM wash-motor delta):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11499711
```

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11480208_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11499711_DISHWASHER_EXTRACTION.md`
