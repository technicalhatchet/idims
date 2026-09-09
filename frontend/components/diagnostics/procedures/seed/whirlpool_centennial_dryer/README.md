# Whirlpool/Maytag Centennial dryer — W8178629

**Platform:** `whirlpool_centennial_dryer`  
**Manual:** Job Aid ML-4 / Part 8178629 (MED/MGD 5500–5900, WED4815-class)  
**Models:** `MED55*`, `MGD55*`, `MED59*`, `MGD59*`, `WED55*`, `WGD55*`, `WED59*`, `WGD59*`, `WED4815*`, `WGD4815*`

## Regenerate

```bash
python backend/scripts/generate_w8178629_procedure_seeds.py
```

## Procedures (11 + bundle)

| ID | Section | Fuel |
|----|---------|------|
| `w8178629-supply-connections` | §6-3 | both |
| `w8178629-timer-motor` | §6-4 | both |
| `w8178629-door-switch` | §5-1 / §6-5 | both |
| `w8178629-thermal-fuse-exhaust` | §5-2 | both |
| `w8178629-electric-heater` | §5-4 | electric |
| `w8178629-electric-tco-inlet` | §5-5 | electric |
| `w8178629-gas-hilimit-cutoff` | §5-2 gas | gas |
| `w8178629-flame-sensor` | §5-3 | gas |
| `w8178629-gas-coils` | §6-8 | gas |
| `w8178629-gas-ignitor` | §5-4 | gas |
| `w8178629-drive-motor` | §5-6 | both |

**Bundle:** `bundles/w8178629-diagnostic-entry.json` — Less Dry + Wrinkle Prevent ×3 diagnostic entry.

## Not CCU

Do not reuse `whirlpool_ccu_dryer` / W10680150 specs. Centennial uses timer+electronic control, different pinouts, and distinct Ω tables (batch21).
