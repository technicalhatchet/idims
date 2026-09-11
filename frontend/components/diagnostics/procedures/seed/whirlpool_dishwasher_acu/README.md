# whirlpool_dishwasher_acu procedure seeds

Manuals **W11633848**, **W11480208**, **W11499711**, **W11794121**, and **W11366142** (KitchenAid KDTM404 premium).

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

Regenerate W11794121 (JennAir D.O.S. delta):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11794121
```

Regenerate W11366142 (KitchenAid KDTM404 premium deltas):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11366142
```

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11480208_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11499711_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11794121_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/KITCHENAID_KDTM404KPS_DISHWASHER_EXTRACTION.md`
