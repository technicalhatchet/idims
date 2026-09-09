# Whirlpool/Maytag freestanding range — W11746350 extraction

**Source:** `backend/docs/manuals/technical-manual-w11746350-revf.pdf` (W11746350F)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11746350-revf-extracted.txt`  
**Scope:** Whirlpool® and Maytag® freestanding gas & electric ranges (Copernicus ACU / touch HMI era)  
**Platform:** `whirlpool_freestanding_range` — shared with W11174426 LCX/LCC manual  
**Status:** batch31 measurements, 12 component-test procedures + diagnostic-entry bundle

Cross-reference: [WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md](./WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md) (LCX/LCC controls, infinite switches, broader model matrix).

---

## 1. Pre-service checklist

| Check | Notes |
|-------|-------|
| 120/240 VAC at outlet (+10% / −15%) | Do not diagnose with tripped breaker or blown fuse |
| Use tech sheet wiring diagram | Manual diagrams are training-only |
| Disconnect power for Ω checks | Voltage checks with all connectors attached |
| VOM sensitivity ≥ 20,000 Ω/V DC | Needle probes on connectors — do not spread pins |

---

## 2. Service Diagnostics (pp. 28–29)

| Mode | Entry |
|------|-------|
| **Option A** | Settings → Info → Service & Support → code **111 111 111** (digit 1 × 9) → CONFIRM → Service Diagnostics home |
| **Option B** | Settings → Diagnostics home → Service Diagnostics Code → repeat any 3-digit sequence 3× (e.g. 123123123) → OK |
| **Component Activation** | Service Diagnostics home → Component Activation → select load (Bake, Door Latch Motor, etc.) |
| **Error Diagnostics** | Clear history after repair |

---

## 3. Error codes (F#E#)

| Code | Meaning | Procedure |
|------|---------|-----------|
| **F1E1**-* | ACU relay / pin short | `w11746350-acu-power` |
| **F1EA**-* | ACU over-temp / sensor fault | `w11746350-acu-power` |
| **F2E1**-* / **F2E2**-* | Stuck key / HMI disconnected | `w11746350-hmi` |
| **F2E4**-* | HMI over-temp / sensor | `w11746350-hmi` |
| **F3E0**-* | Main oven sensor open/short | `w11746350-oven-sensor` |
| **F5E0**-* / **F5E1**-* | Door/latch switch disagree | `w11746350-door-latch` |
| **F6E1**-* | Communication fault | `w11746350-acu-power` |
| **F7E5**-* / **F7E6**-* | Cooling / convection fan error | `w11746350-vent-fan` |
| **F9E0**-* / **FBE1**-* | Miswire / firmware | `w11746350-acu-power` |
| **FEE6**-* | Main cavity bake element | `w11746350-bake-element` (electric) |
| **FEE7**-* | Main cavity broil element | `w11746350-broil-element` (electric) |
| **FEE8**-* | Convect element (gas models) | `w11746350-convect-element` (gas) |

---

## 4. Complaint routing

| Symptom | Priority |
|---------|----------|
| No bake heat (electric) | Bake element P4 → relay → ACU → `w11746350-bake-element` |
| No broil heat (electric) | Broil 10–40 Ω → `w11746350-broil-element` |
| Oven temp wrong / F3E0 | RTD 1000–1200 Ω P22 → `w11746350-oven-sensor` |
| Self-clean lock failure | Latch 500–3000 Ω P8 → `w11746350-door-latch` |
| Gas oven no ignition | DSI 216 Ω + spark → `w11746350-dsi-gas-valve`, `w11746350-surface-spark` |
| Cooktop no heat (electric) | Bridge/single/warming Ω → `w11746350-bridge-element` |
| Overheat / thermal fuse | Thermo fuse continuity → `w11746350-thermal-fuse` |

---

## 5. Component testing index (pp. 42–51)

| Procedure ID | Component | Key Ω / specs | Fuel |
|--------------|-----------|---------------|------|
| `w11746350-acu-power` | ACU / supply | 120/240 VAC; HMI 12 VDC P3 | both |
| `w11746350-hmi` | Touch HMI | P3 12 VDC; connector inspect | both |
| `w11746350-oven-sensor` | Oven RTD | **1000–1200 Ω** P22-1↔P22-2 | both |
| `w11746350-door-latch` | Rear door latch motor | **500–3000 Ω** P8-5↔P8-6 | both |
| `w11746350-vent-fan` | Vent / convection fan | Fan 85 Ω ±10%; 12 VDC P6 | both |
| `w11746350-bake-element` | Hidden bake | **23.3 Ω ±5%** P4-3↔P4-4 | electric |
| `w11746350-broil-element` | Broil | **10–40 Ω** P80-7↔P80-8 | electric |
| `w11746350-convect-element` | Convect element + fan | **14.5–16.1 Ω** element; 85 Ω fan | gas |
| `w11746350-dsi-gas-valve` | DSI + gas regulator | **216 Ω ±10%** solenoid; flame rectification | gas |
| `w11746350-surface-spark` | Spark module | 120 VAC; visual spark all burners | gas |
| `w11746350-bridge-element` | Bridge / single / warming | Outer **68.5 Ω ±5%**; inner **30.5 Ω ±5%**; single **45.7 Ω ±5%**; warming **145 Ω ±5%** | electric |
| `w11746350-thermal-fuse` | Thermo fuse | Closed normal; opens @ 363°F (184°C) | both |

**Bundle:** `w11746350-service-diagnostic-entry` — Settings path or 3-digit repeat code.

**WO smoke:** Whirlpool `WFE550S0HZ` → `whirlpool_freestanding_range`; F3E0 → `w11746350-oven-sensor`.
