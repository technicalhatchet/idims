# whirlpool_connected_smart_gen3 — W10785366A smart-layer procedures

**Manual:** Job Aid W10785366A — Connected Smart Appliances Gen III  
**Platform:** `whirlpool_connected_smart_gen3` — routes before generic WTW/WED/WRF patterns  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W10785366A_SMART_APPLIANCE_EXTRACTION.md`

## Models

| Template | Patterns |
|----------|----------|
| washer | WTW8700*, MTW8700* |
| electric_dryer | WED8700*, MED8700* |
| gas_dryer | WGD8700*, MGD8700* |
| dishwasher | WDT995* |
| refrigerator | WRF989*, WRF995* |

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10785366A
```

## Procedures (6)

| ID | Scope | Notes |
|----|-------|-------|
| w10785366a-wifi-module | all smart | §4-14 LED chart, J4 5 VDC |
| w10785366a-pmm-ct | laundry | CT 135 Ω J4, PM 5 VDC |
| w10785366a-hmi-wifi-comm | laundry + DW | n-- / F6E2 software version check |
| w10785366a-connectivity-console | all smart | Console WiFi/Smart Grid indicators |
| w10785366a-dishwasher-wifi | dishwasher | HMI + WiFi only (no PMM) |
| w10785366a-fridge-wifi-service | refrigerator | Service tests 106–109 |

## Bundles (4)

- `w10785366a-laundry-service-diagnostic-entry` — 3-button × 3
- `w10785366a-laundry-software-version-display` — hold 2nd button 5 sec
- `w10785366a-dishwasher-service-diagnostic-cycle` — 1-2-3 × 3
- `w10785366a-fridge-service-mode-entry` — Recommended + Drawer

## WO smoke

Whirlpool `WTW8700EC0` → `whirlpool_connected_smart_gen3`; connectivity → `w10785366a-wifi-module`
