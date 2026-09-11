# LG freestanding & slide-in range platform

**Sources:**
- `LG electric freestanding range.pdf` — LRE30451, LRE30755 (30" electric)
- `LG gas freestanding range.pdf` — LRGL5821S (30" gas freestanding)
- `LG slide in gas range svcmanual.pdf` — LSG4513ST/BD (30" slide-in gas)

**Extracted text:** `*-extracted.txt` in `backend/docs/manuals/`  
**Platform:** `lg_freestanding_range` — dual fuel via `templateIds` (`electric_range` / `gas_range`)  
**Manual ID:** `LG-LRE-RANGE`

## Platform decision

| Factor | Electric LRE | Gas LRGL / LSG |
|--------|--------------|----------------|
| Oven heat | Bake 14 Ω, broil/convection 17 Ω | Igniter 45–400 Ω, valve 1–3 Ω |
| Cooktop | Ceran 46 Ω / dual RF 32+55 Ω / warming 565 Ω | Spark + ignition-switch cam |
| Shared | Oven sensor **1.09 kΩ**, door switch, lamp **5 Ω**, door latch motor **27 Ω**, micro **2.6 kΩ** | Same oven path |
| F-codes | F-1 key short, F-2 door lock, F-3/F-4 sensing, F-9 oven hot | F-1 open sensor, F-2 short sensor, F-3 key, F-6 hot, F-9 no heat |

**Verdict:** One platform — shared Main PCB architecture; fuel-specific procedures gated by `templateIds`.

## Component test index (§4)

| Component | Ω @ 77°F | Fuel |
|-----------|----------|------|
| Oven sensor | 1.09 kΩ ±10% | both |
| Warming drawer sensor | 4.6 kΩ ±10% | electric (LRE30755) |
| Bake element | 14 Ω ±10% | electric |
| Broil / convection element | 17 Ω ±10% | electric |
| Warming drawer element | 95 Ω ±10% | electric (LRE30755) |
| Convection motor | 33.5 Ω ±10% | electric |
| Door latch motor | 27 Ω ±10% | electric + slide-in gas |
| Micro switch (NO) | 2.6 kΩ ±10% | electric + slide-in |
| Single surface (LF/LR/RR) | 46 Ω ±10% | electric |
| Warming zone (CR) | 565 Ω ±10% | electric |
| Dual RF (E1/E2) | 32 / 55 Ω ±10% | electric |
| Oven igniter | 45–400 Ω | gas |
| Oven safety valve | 1–3 Ω | gas |
| Oven lamp | ≤5 Ω | both |

## Complaint routing

| Symptom | Priority procedures |
|---------|---------------------|
| F-1 / F-2 sensor (gas) | `lg-range-oven-sensor` |
| F-9 no heat (gas) | igniter → valve → sensor |
| F-9 / no oven heat (electric) | bake/broil elements → sensor → PCB |
| No display | `lg-range-no-power` |
| Cooktop no heat | cooktop element / ignition switch |
| Door lock F-2 (electric) | `lg-range-door-latch` |

## Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual LG-LRE-RANGE
```

**Smoke:** LG + LRE30451 → `lg_freestanding_range`; LG + LRGL5821S → `lg_freestanding_range` (gas).
