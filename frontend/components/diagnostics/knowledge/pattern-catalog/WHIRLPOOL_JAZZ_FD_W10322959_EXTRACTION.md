# Whirlpool Jazz French door refrigerator — W10322959 extraction

**Source:** `backend/docs/manuals/techsheet-w10322959-revb whirlpool FD fridge 2013.pdf` (2 pp., Rev B)  
**Extracted text:** `backend/docs/manuals/techsheet-w10322959-revb whirlpool FD fridge 2013-extracted.txt`  
**Scope:** Jazz control board era — 19–22 cu ft 2-door & French door (JZ 19-22). Embraco EM2Y60 compressor.  
**Status:** Phase A + B + C merged (batch15 measurements, service test routing, evidence).

Cross-reference: [WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md](./WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md) (newer WRF7/WRF8 ACU + ice E0–E5).

**Platform:** `whirlpool_jazz_french_door` — `WRF53/54/55/56/98/99`, `KRMF55`, `KRFF5`, `GI5F`.  
**Note:** `whirlpool_ka_french_door` scoped to `WRF7/8`, `KRMF70/706` ACU platform.

---

## 1. No display fault codes

Jazz uses **Service Test Mode** (S-E), **Forced Defrost** (F-d), and **Programming Mode** (P-E) — not alphanumeric fault codes. Program code **OO** prevents operation.

---

## 2. Service tests (S-E entry)

Door light switch held + **Fridge UP ×3** within 10 s → display **S-E** → Fridge UP once more.

| Test | Function | Display |
|------|----------|---------|
| **1** | Defrost thermostat + heater | FZ=1, FF=O (open) or S (closed) |
| **2** | Compressor / condenser fan | FZ=2, FF=O/F toggle |
| **3** | Evaporator / freezer fan | FZ=3, FF=O/F |
| **4** | Fresh food thermistor | FZ=4, FF=P/O/S |
| **5** | Freezer thermistor | FZ=5, FF=P/O/S |
| **6** | Damper open/close | FZ=6, FF=O/C (1 min per move) |
| **7–8** | FF/FZ performance offset | default 5 |
| **9** | Defrost interval A/F | Adaptive vs fixed 6 hr |

**Forced defrost:** door switch + **Fridge DOWN ×3** → **F-d** → confirm with Fridge DOWN.

**Programming:** door switch + **Freezer DOWN ×3** → **P-E** — validate program code on serial plate.

---

## 3. Component specifications (batch15)

| Knowledge ID | Spec |
|--------------|------|
| `whirlpoolJazzFdThermistorOhms` | 10 kΩ @ 77°F; 29.5 kΩ @ 36°F; 86.3 kΩ @ 0°F |
| `whirlpoolJazzFdDefrostHeaterOhms` | 19 cu 33 Ω; 22 cu 30 Ω; 20/25 cu 28 Ω |
| `whirlpoolJazzFdDefrostBimetalOhms` | Closed >42°F; open <12°F |
| `whirlpoolJazzFdCompressorRunOhms` | EM2Y60 run 4.75 Ω ±8% |
| `whirlpoolJazzFdCompressorStartOhms` | Start 6.1 Ω ±8%; 12 µfd cap |

**Adaptive defrost:** 15 min optimum; board terminates at 25 min if bimetal stuck; 4 hr compressor run resets interval.

---

## 4. Complaint routing

| Symptom | Priority |
|---------|----------|
| Weak FF, cold FZ | Service test 6 damper; test 4 thermistor |
| Warm both | Test 2 compressor; condenser fan; sealed system |
| Heavy frost | Test 1 defrost heater/bimetal; test 3 evap fan |
| Won't run | Program code OO; relay/cap/start windings |
| No water (if equipped) | Dual valve brown 35 W / yellow 20 W |

---

## 5. Captured vs gaps

### Captured

- Full service test 1–9 tree + F-d / P-E entry  
- EM2Y60 compressor + relay/cap specs  
- Thermistor R/T table (77/36/0°F)  
- Defrost heater by cu ft + adaptive defrost logic  
- Platform split from ACU French door (`whirlpool_ka_french_door`)  

### Gaps

| Gap | Notes |
|-----|-------|
| No ice maker diagnostics on sheet | Modular IM uses separate 2225623 doc |
| Model list incomplete | Extend WRF5x patterns if field data shows more Jazz models |
| In-door dispenser specifics | Valve watts only — no flow test procedure |
| Maytag MFF/MFI rebadges | Resolved — `MFF`/`MFI`→`WRF` prefix map + explicit MFF5/MFI5 patterns |

---

## 6. Re-seed & verify

```bash
cd frontend && npx tsc --noEmit
```

No new DMA rows (no display fault codes on this sheet).

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/techsheet-w10322959-revb whirlpool FD fridge 2013.pdf"`*
