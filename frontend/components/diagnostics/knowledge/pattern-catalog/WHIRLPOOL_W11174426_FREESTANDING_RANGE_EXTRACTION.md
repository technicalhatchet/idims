# Whirlpool/Maytag/Amana freestanding range — W11174426 extraction

**Source:** `backend/docs/manuals/technical-manual-w11174426-revb whirlpool maytag amana ranges.pdf` (W11174426 Rev B)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11174426-revb whirlpool maytag amana ranges-extracted.txt`  
**Scope:** Whirlpool®, Maytag®, Amana®, IKEA® freestanding/slide-in ranges — LCX 1.0 and LCC controls  
**Models:** WFE*, WFG*, YWFE*, MER*, MGR*, AER*, AGR*, WFC*, WEC*, WEE*, WEG*, YACR*, etc. (see §3 wiring diagram index)  
**Platform:** `whirlpool_freestanding_range` — shared seed dir with W11746350  
**Status:** batch31 measurements, 9 high-volume component procedures + diagnostic-entry bundle

Cross-reference: [WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md](./WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md) (Copernicus ACU / Settings diagnostics).

---

## 1. Pre-service checklist

| Check | Notes |
|-------|-------|
| 240 VAC +10% / −15% at outlet | Required before diagnosis |
| Tech sheet wiring diagram | Manual schematics vary by model group |
| Power off for resistance | Voltage with connectors attached |
| DLB engages in Diagnostics (electric) | Double line break — normal on LCX/LCC entry |

---

## 2. Diagnostics mode (§2, pp. 2-3 – 2-8)

| Action | Key sequence |
|--------|--------------|
| **Enter Diagnostics** | **CANCEL → CANCEL → START** within 5 seconds |
| **Relay / load test** | Keypads per §2 table while in Diagnostics |
| **Exit** | CANCEL |
| **Clear codes** | Per display prompts after repair |

---

## 3. Error codes (LCX/LCC)

| Code | Meaning | Procedure |
|------|---------|-----------|
| No display | Control not operational | `w11174426-acu-power` |
| **F1E0–F1E2** | Internal board / A/D error | `w11174426-acu-power` |
| **F2E1** | Shorted keypad | `w11174426-hmi` |
| **F3E0** | Oven sensor open/short / over-temp | `w11174426-oven-sensor` |
| **F5E1** | Door latch (Clean mode) | `w11174426-door-latch` |
| **F6E1** | Oven over-temp when heating | `w11174426-oven-sensor` |
| **F9E0** | Miswired house/range | `w11174426-acu-power` |

---

## 4. Component testing charts (§3-45 – 3-47)

### LCC control chart (Con 1–4)

| Component | Pins | Resistance | Procedure |
|-----------|------|------------|-----------|
| Oven sensor | Con 3-9 ↔ 3-10 | **1000–1200 Ω** RT | `w11174426-oven-sensor` |
| Door latch motor | Con 1-4 ↔ Con 1-1 W | **500–3000 Ω** | `w11174426-door-latch` |
| Bake element | Con 2-7 ↔ Con 4-3 | **10–40 Ω** | `w11174426-bake-element` |
| Broil element | Con 2-1 ↔ Con 4-3 | **10–40 Ω** | `w11174426-broil-element` |
| DSI bake valve | J1-1 ↔ J1-2 | **216 Ω** (Bake mode) | `w11174426-dsi-board` |
| DSI broil valve | J1-3 ↔ J1-2 | **216 Ω** (Broil mode) | `w11174426-dsi-board` |
| Surface spark module | L ↔ N | 120 VAC; visual spark | `w11174426-surface-spark` |
| Infinite switches | Element terminals | Cycles on/off when hot | `w11174426-infinite-switch` |

### LCX control chart (P1–P5)

| Component | Pins | Resistance | Procedure |
|-----------|------|------------|-----------|
| Oven sensor | P3-4 ↔ P3-5 | **1000–1200 Ω** | `w11174426-oven-sensor` |
| Door latch motor | P2-3 ↔ P1-3 WH | **500–3000 Ω** | `w11174426-door-latch` |
| Bake element | P4-3 ↔ P5-4 | **10–40 Ω** | `w11174426-bake-element` |
| Broil element | P5-1 ↔ P5-4 WH | **10–40 Ω** | `w11174426-broil-element` |

---

## 5. Procedure checklist (generated)

| ID | Focus | templateIds | Tags / codes |
|----|-------|-------------|--------------|
| `w11174426-acu-power` | Control supply P1 / terminal block | — | F1E0, F1E1, F1E2, F9E0, no_power |
| `w11174426-hmi` | Keypad P11 harness | — | F2E1, hmi_check |
| `w11174426-oven-sensor` | RTD P3 or Con3 | — | F3E0, F6E1, sensor_check |
| `w11174426-door-latch` | Latch motor + switches | — | F5E1, door_latch_check |
| `w11174426-bake-element` | Bake element Ω | `electric_range` | no_bake_heat_issue, F3E0 |
| `w11174426-broil-element` | Broil element Ω | `electric_range` | no_broil_heat_issue |
| `w11174426-infinite-switch` | Cooktop infinite switch | `electric_range` | heating_element_check, surface_burner |
| `w11174426-dsi-board` | DSI gas valve coils | `gas_range` | gas_valve_check, no_bake_heat_issue |
| `w11174426-surface-spark` | Cooktop spark module | `gas_range` | ignition_issue, surface_burner |

**Bundle:** `w11174426-service-diagnostic-entry` — CANCEL×2 + START.

**WO smoke:** Maytag `MER6600F` → `whirlpool_freestanding_range`; F5E1 → `w11174426-door-latch`.
