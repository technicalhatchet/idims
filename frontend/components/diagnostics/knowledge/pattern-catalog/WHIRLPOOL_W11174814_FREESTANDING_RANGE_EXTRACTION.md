# Whirlpool/Maytag/KitchenAid/Kenmore/JennAir/IKEA/Amana freestanding range — W11174814 extraction

**Source:** `backend/docs/manuals/service-manual-w11174814-revb whirlpool maytag kitchenaid kenmore jennair amana ranges.pdf` (W11174814 Rev B)  
**Extracted text:** `backend/docs/manuals/service-manual-w11174814-revb whirlpool maytag kitchenaid kenmore jennair amana ranges-extracted.txt`  
**Scope:** Multi-brand freestanding/slide-in ranges — Maxwell, MRC, LCX, LCC, Indigo controls  
**Platform:** `whirlpool_freestanding_range` — shared seed dir with W11746350 + W11174426  
**Status:** batch31 (+2 measurements), 5 delta procedures + 2 diagnostic-entry bundles

Cross-reference: [WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md](./WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md) (Copernicus ACU), [WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md](./WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md) (LCX/LCC).

---

## 1. Model routing (platformRegistry)

| Make | Electric patterns | Gas patterns | Example models (manual §3 wiring) |
|------|-------------------|--------------|-----------------------------------|
| Whirlpool | WFE*, WEE*, WEC*, YWFE* | WFG*, WEG*, YWFG* | WFE540H0E, WFE745H0F, WFG540H0E |
| Maytag | MER*, MES*, YMER* | MGR*, YMGR* | MER8800F, MGR8800F |
| KitchenAid | KFE*, KFED*, KFEG*, KFES*, KFG*, KFGG* | KFG*, KFGG*, KFGS* | KFEG500E, KFGG500E, KFGS530E |
| Kenmore | KSIB*, KSEB*, KSEG*, YKSE* | KSGB*, KSGG*, KSEB*, KSEG* | KSIB900E, KSGB900E, KSEB900E |
| JennAir | JES*, JIS* | JGS*, JDG* | JES1450F, JGS1450F |
| IKEA | IES*, YIES* | YIEL* | IEL730C, YIEL730C |
| Amana | AER*, AES*, ACR*, YACR* | AGR*, AGS*, YACR* | (shared LCX/LCC charts) |

---

## 2. Control families & diagnostics entry

| Control | Entry | Bundle |
|---------|-------|--------|
| **Maxwell / MRC** | CANCEL → CANCEL → START; run **Auto Test** first | `w11174814-maxwell-mrc-diagnostic-entry` |
| **LCX / LCC** | CANCEL → CANCEL → START (same as W11174426) | `w11174426-service-diagnostic-entry` (reuse) |
| **Indigo** | HOME → FAVORITES → LIGHT (repeat 3×) | `w11174814-indigo-diagnostic-entry` |
| **Copernicus ACU** | Settings Service Diagnostics (W11746350 only) | `w11746350-service-diagnostic-entry` (reuse) |

---

## 3. Error codes (Maxwell/MRC — pp. 2-7 – 2-8)

| Code | Meaning | Procedure |
|------|---------|-----------|
| **F1E0** / **F2E0–E2** | EEPROM / keypad | `w11746350-hmi` or control replace path |
| **F3E0** | Main oven sensor | `w11746350-oven-sensor` / `w11174426-oven-sensor` (same 1000–1200 Ω) |
| **F3E2** | Warming drawer sensor | **`w11174814-warming-drawer-sensor`** (delta) |
| **F5E0** / **F5E1** | Door switch / latch | `w11174426-door-latch` / `w11746350-door-latch` |
| **E5** / **E7** / **E9** | Sensor / PCB / queue | Control path |

LCX/LCC codes match W11174426 extraction (F1E0–F1E2, F2E1, F3E0, F5E1, F6E1, F9E0).

---

## 4. Component testing — reuse vs delta (§3-33 – 3-47)

### Reuse existing 21 procedures (identical specs)

| W11174814 chart | Component | Spec / pins | Reuse procedure ID |
|-----------------|-----------|-------------|-------------------|
| LCX (§3-41) | Oven RTD | 1000–1200 Ω P3-4↔P3-5 | `w11174426-oven-sensor` |
| LCX | Door latch | 500–3000 Ω P3-3↔P1-3 | `w11174426-door-latch` |
| LCX | Bake / broil | 10–40 Ω | `w11174426-bake-element` / `w11174426-broil-element` |
| LCC electric (§3-42) | RTD, bake, broil, fan | Con3/Con2/Con4; fan 85–90 Ω | `w11174426-*` + `w11746350-vent-fan` |
| LCC gas (§3-44) | DSI valve | J1-1↔J1-2 / J1-3↔J1-2 **216 Ω** | `w11174426-dsi-board` |
| LCC gas | Surface spark | L↔N visual | `w11174426-surface-spark` |
| Maxwell/MRC electric | Oven RTD | 1000–1200 Ω P10-1↔P10-2 | `w11746350-oven-sensor` |
| Maxwell/MRC | Convection fan | 85–90 Ω | `w11746350-vent-fan` |
| Maxwell/MRC gas | Convection element | ~16 Ω | `w11746350-convect-element` |
| Maxwell/MRC gas | DSI + spark | 216 Ω J1; surface spark | `w11746350-dsi-gas-valve` / `w11174426-surface-spark` |
| Maxwell/MRC | Bake / broil (not hidden) | 10–40 Ω | `w11174426-bake-element` / `w11174426-broil-element` |
| Maxwell/MRC | Door latch (gas MRC) | 500–3000 Ω P5-3↔W | `w11746350-door-latch` |
| Maxwell/MRC | Thermo fuse | Continuity | `w11746350-thermal-fuse` |
| Indigo | Oven RTD | 1000–1200 Ω P10-3↔P10-4 | `w11746350-oven-sensor` |
| Indigo | Bake / broil / convect cavity | 10–40 Ω P2-3/P4-2/P1-4 | `w11174426-bake-element` / `w11174426-broil-element` |
| Indigo | Convection fan | 80–95 Ω | `w11746350-vent-fan` |

### Delta procedures (NEW — W11174814 only)

| Procedure ID | Component | Spec | Control / fuel | Tags |
|--------------|-----------|------|----------------|------|
| **`w11174814-warming-drawer-sensor`** | Warming drawer RTD | **1000–1200 Ω** P10-3↔P10-4 | Maxwell/MRC (optional drawer) | **F3E2**, sensor_check |
| **`w11174814-warming-drawer-element`** | Warming drawer element | **15–20 Ω** | Maxwell/MRC electric + gas | no_heat, heating_element_check |
| **`w11174814-gas-igniter`** | Bake / broil igniter | **40–400 Ω** P2-3 / P4-2 ↔ W | Indigo gas only | ignition_issue, no_bake_heat_issue |
| **`w11174814-ceran-element`** | Indigo ceran cooktop | **23–83 Ω** H1↔H2 | Indigo electric | heating_element_check, surface_burner |
| **`w11174814-oven-light`** | Oven light assembly | **0–40 Ω** | All families (pin varies) | light_check |

**Not duplicated:** Copernicus hidden bake 23.3 Ω (`w11746350-bake-element`), bridge/single/warming zone (`w11746350-bridge-element`), LCX infinite switches (`w11174426-infinite-switch`).

---

## 5. Measurement knowledge

| knowledgeId | Spec | Source |
|-------------|------|--------|
| `whirlpoolFreestandingRangeOvenSensorOhms` | 1000–1200 Ω | Reused for main + warming drawer RTD |
| `whirlpoolFreestandingRangeWarmingDrawerElementOhms` | 15–20 Ω | **batch31 new** |
| `whirlpoolFreestandingRangeIndigoCeranOhms` | 23–83 Ω | **batch31 new** |
| `whirlpoolFreestandingRangeOvenLightOhms` | 0–40 Ω | batch31 existing |
| `hotSurfaceIgniterOhms` | 40–400 Ω Indigo igniter | batch2 existing |

---

## 6. Pipeline

```bash
python backend/scripts/generate_w11174814_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

**WO smoke:** KitchenAid `KFEG500E` + KitchenAid → `whirlpool_freestanding_range`; F3E2 → `w11174814-warming-drawer-sensor`.  
JennAir `JGS1450F` + JennAir → gas range; Indigo igniter → `w11174814-gas-igniter`.
