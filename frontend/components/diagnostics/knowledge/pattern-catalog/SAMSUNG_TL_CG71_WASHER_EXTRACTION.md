# Samsung top-load washer CG71 (WA7000A / WA55CG71) — extraction

**Source:** `backend/docs/manuals/samsung tl new style.pdf`  
**Extracted text:** `backend/docs/manuals/samsung tl new style-extracted.txt`  
**Scope:** Samsung top-load washers WA55CG*, WA54CG*, WA55A7* (WA7000A project)  
**Platform:** `samsung_tl_washer_cg71`  
**Status:** Complete — §5 Test Mode, error codes, §5-3 corrective actions with Ω specs  
**Knowledge:** reuses `measurement-knowledge-batch26.json` (A50 family specs)

---

## 1. CG71 vs A50 (why separate platform)

| Aspect | A50 (`samsung_tl_washer_a50`) | CG71 (`samsung_tl_washer_cg71`) |
|--------|-------------------------------|----------------------------------|
| Project | WA5000R | WA7000A |
| Model patterns | WA50R*, WA51D*, WA52D*, WF45A* | WA55CG*, WA54CG*, WA55A7* |
| Manual structure | §5-1 Test Mode, §5-2/5-3 errors | Same |
| Motor Ω | 19.3 Ω @ 25°C | 19.3 Ω (same) |
| WLS frequency | ~26.4 kHz | ~26.4 kHz |
| CG71-only codes | — | **SDC** (detergent drawer not closed) |
| Auto-dispense | — | WA75** variants — connector note on valve housing |

Same diagnostic architecture; split platforms so model routing does not overlap (A50 patterns tightened away from CG71).

---

## 2. Model routing

| Pattern | Example models |
|---------|----------------|
| WA55CG* | WA55CG7100AW |
| WA54CG* | WA54CG7550A* |
| WA55A7* | WA55A7700AV |

Make: **Samsung** only.

---

## 3. Error / information codes (§5-2, §5-3)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **1C** | Water level sensor fault | Water level sensor |
| **3C** | Motor fault | Motor circuit |
| **4C / 4C2** | Water not supplied | Inlet valves |
| **5C** | Water not draining | Drain pump |
| **AC / AC6** | PBA communication | Communication |
| **dC / DC / DC1 / DC2** | Door open / lock fault | Door lock |
| **BC2** | Button stuck / relay | HMI check |
| **LC / LC1** | Water leakage / drain | Leak check |
| **UB** | Unbalance spin | Unbalance |
| **8C / 8C1 / 8C2** | MEMS sensor | MEMS PBA |
| **OC** | Overflow | Overflow |
| **HC / HC1** | High temp / heater | Wash heater |
| **TC1–TC4** | Temperature sensors | Wash thermistor |
| **UC / 9C1 / 9C2** | Power voltage fault | Power supply |
| **PC / PC1** | Clutch position | Clutch |
| **SDC** | Detergent drawer not closed | Detergent drawer *(CG71 only)* |

---

## 4. Service modes (§5-1 Test Mode)

| Mode | Entry |
|------|-------|
| Smart Install | Standby → course **Self Clean** → Start/Pause **7 s** |
| Automatic check | Smart Install → Start/Pause while **AS** |
| Manual check | Smart Install → **Spin** while **AS** |
| S/W version | Smart Install → **Temp** while **AS** |
| Diagnostic codes | Smart Install → **Soil** while **AS** → **CR** → jog dial CW |

---

## 5. Key Ω / frequency specs (§5-3)

| Component | Spec |
|-----------|------|
| Motor windings | 19.3 Ω @ 25°C (any two of three terminals) |
| Drain pump | 330 Ω |
| Inlet valve coils | 1.2 kΩ |
| Door lock motor | 2.5 kΩ |
| Reed switch | closed = 0 Ω, open = ∞ |
| Water level sensor | ~26.4 kHz no load (Blue–Orange, min 25.9 kHz) |
| Wash heater | 27.1 Ω or 26.2 Ω variant |
| Thermistor | ~12 kΩ @ 25°C |

---

## 6. Diagram crops

| Page | Asset | Use |
|------|-------|-----|
| 16 | `samsungtlcg71-main-pcb.png` | PCB / comm |
| 17 | `samsungtlcg71-water-valve.png` | Inlet valves |
| 18–19 | door switch, pressure switch | Door lock, WLS |
| 20 | drain pump | Drain pump |
| 22 | motor/clutch | Motor circuit |

**Smoke model:** WA55CG7100 + Samsung → `samsung_tl_washer_cg71`; 3C → `samsungtlcg71-motor-circuit`; SDC → `samsungtlcg71-detergent-drawer`.
