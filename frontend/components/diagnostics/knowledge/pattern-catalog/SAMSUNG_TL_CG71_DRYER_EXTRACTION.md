# Samsung top-load dryer CG71 (DV7000R / DVE55CG71) — extraction

**Source:** `backend/docs/manuals/samsung tl dryer new style.pdf`  
**Extracted text:** `backend/docs/manuals/samsung tl dryer new style-extracted.txt`  
**Scope:** DVE55CG*, DVG55CG*, DV55CG* (DV7100C project)  
**Platform:** `samsung_tl_dryer_cg71` (electric + gas template rules)  
**Status:** Complete — §4 Smart Install, §6 component checks  
**Knowledge:** reuses A50/DV50 dryer measurement batch (batch26)

---

## 1. CG71 vs DV50 (why separate platform)

| Aspect | DV50 (`samsung_tl_dryer_dv50`) | CG71 (`samsung_tl_dryer_cg71`) |
|--------|--------------------------------|--------------------------------|
| Project | DV5000R | DV7000R / DV7100C |
| Electric patterns | DVE50R*, DV50R* | DVE55CG*, DV55CG* |
| Gas patterns | DVG50R* | DVG55CG* |
| Manual structure | Smart Install + component check | Same family layout |
| Component Ω | Same class specs | Same (motor, heater, gas path) |

Split so WA55CG washer pairs route to CG71 dryer, not DV50R.

---

## 2. Model routing

| Template | Pattern | Example |
|----------|---------|---------|
| electric_dryer | DVE55CG*, DV55CG* | DVE55CG7100AW |
| gas_dryer | DVG55CG* | DVG55CG7100AW |

---

## 3. Procedures (11 + 1 bundle)

| ID | Focus | templateIds |
|----|-------|-------------|
| `samsungtlcg71d-power` | Supply / voltage | both |
| `samsungtlcg71d-motor-circuit` | Motor + belt path | both |
| `samsungtlcg71d-heater-electric` | Heating element | electric_dryer |
| `samsungtlcg71d-thermistor` | Exhaust thermistor | both |
| `samsungtlcg71d-thermal-cutoff` | Hi-limit / cutoff | both |
| `samsungtlcg71d-gas-ignitor` | Hot surface ignitor | gas_dryer |
| `samsungtlcg71d-gas-valve` | Gas valve coils | gas_dryer |
| `samsungtlcg71d-gas-flame-sensor` | Flame sensor | gas_dryer |
| `samsungtlcg71d-door-switch` | Door sensing | both |
| `samsungtlcg71d-belt-cutoff` | Belt switch | both |
| `samsungtlcg71d-hmi` | Touch panel | both |

**Bundle:** `samsungtlcg71d-smart-install-entry`

---

## 4. Diagram crops

| Page | Asset | Use |
|------|-------|-----|
| 12–13 | main/sub PCB | Comm, gas valve |
| 17 | door switch | Door switch procedure |
| 18 | moisture sensor | Long dry / sensor path |
| 20 | motor | Motor circuit |
| 21 | burner | Gas ignitor, valve, flame sensor |
| 22 | heater/thermistor | Electric heat, NTC |

**Smoke model:** DVE55CG7100 + Samsung → `samsung_tl_dryer_cg71`; no heat electric → `samsungtlcg71d-heater-electric`.
