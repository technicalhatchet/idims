# Samsung vs Whirlpool dryer manual comparison

**Samsung source:** `backend/docs/manuals/samsung-dryer-electric-gas.pdf` (28 pp., DV7000R / DVE(G)50R5400* / DVG50R5200*)  
**Samsung extracted text:** `backend/docs/manuals/samsung-dryer-electric-gas-extracted.txt`  
**Whirlpool reference:** [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md)

**Purpose:** Compare a second OEM manual to see what is universal vs brand-specific, and fold brand-agnostic insights into Solomon without duplicating Whirlpool-only F-code tables.

---

## 1. Document shape (similar)

| | Whirlpool | Samsung |
|---|-----------|---------|
| Pages | 28 | 28 |
| Extracted chars | ~67k | ~51k |
| Structure | Safety → specs → disassembly → troubleshooting → component tests | Same general arc |
| Electric + gas in one doc | Yes | Yes |

Both manuals are **service data sheets**, not consumer use & care. Troubleshooting depth is comparable; Samsung has more consumer-feature content (Smart Care, Child Lock, Eco Dry).

---

## 2. Error / information codes (biggest difference)

### Whirlpool (Maytag-style F-codes)

Dense **F#E#** matrix: F1E1 (CCU), F2Ex (UI), F3Ex (thermistors / moisture), F4Ex (heater relay, vent AF, L2 supply), F6Ex (UI↔CCU comm). Dedicated **Restricted Air Flow / AF** and **L2** customer codes.

### Samsung (alphanumeric display codes)

From §4-1 — no F-code pattern:

| Code | Meaning | First actions | Whirlpool analog (conceptual) |
|------|---------|---------------|-------------------------------|
| **tC** | Thermistor1 resistance out of range | Lint screen, **vent restriction**, thermistor Ω | F3E1/F3E2 exhaust + vent (F4E3) |
| **tC5** | Thermistor2 resistance out of range | Same | F3E3/F3E4 inlet + vent |
| **dC** | Running with door open | Close door; door sensor loose/short | Door switch / start interlock |
| **dF** | Incorrect door switch | Door sensor harness | Door switch |
| **bC2** | Stuck / invalid button state | Display PCB | F2E1 UI |
| **FC** | Invalid power frequency | Frequency sensor circuit | Rare on Whirlpool doc |
| **9C1** | Control — invalid voltage | PCB, harness, supply | F4E4 / supply |
| **AC** | Control — invalid communication | PCB, harness | F1E1 / F6Ex |
| **HC** | Invalid heating temp while running | PCB + thermistor | Heat + thermistor path (no exact F-code) |

**Notable gaps in Samsung table (vs Whirlpool):**

- No **moisture-sensor-specific** codes (Whirlpool F3E6/F3E7).
- No **dedicated vent-restriction code** — vent is the **first fix** on tC/tC5 instead of a separate AF/F4E3.
- No **heater-relay-stuck** code (Whirlpool F4E1 / heats-on-AIR branch).

**Solomon handling:** `expandErrorCodeTokens()` in `routingEngine.ts` maps Samsung codes to the same **component categories** (vent, thermistor, door, supply, control) so evidence and chip inference work without a parallel rule set.

---

## 3. Symptom routing (high overlap)

Samsung §4-3 trouble diagnosis aligns with Whirlpool complaint matrix:

| Symptom | Samsung emphasis | Already in Solomon |
|---------|------------------|-------------------|
| Does not run | Breaker, Start after door open, plug | `no_power`, `no_spin` |
| Does not heat | Gas supply, cool-down phase, vent, 4" rigid duct, overload | `no_heat`, vent fields |
| Does not dry | **Washer extraction**, small/large load, **Eco Dry air phase**, mixed fabric | `not_drying` — **added Eco/washer tips** |
| Dries unevenly | Mixed heavy/light in same load | `not_drying` guidance |
| Noisy | Leveling, normal high-velocity air hum | `noisy` |
| Extended time | Sensor Dry variability | `not_drying` |

**Samsung-only customer-education items** (now in field guidance, brand-agnostic):

- **Eco Dry** on Normal/Time Dry runs an unheated air phase first → clothes can feel damp mid-cycle.
- **Child Lock** (Dryness + Temp 3 sec) disables all keys except Power → mimics dead UI.
- **Cool-down phase** at end of cycle can feel like “no heat.”
- **1 wash load = 1 dryer load**; separate heavy vs light items.
- **Washer not extracting** → dryer cannot fix wet clothes.
- **Annual** exhaust duct inspection; **4" rigid metal** duct recommended.

---

## 4. Built-in diagnostics (Samsung richer)

| Feature | Samsung | Whirlpool |
|---------|---------|-----------|
| Service test mode | **Smart Install** (Adjust Time Up + Temp 7s → “SC”) — touch sensor, motor+heater OK/HC | Manual service mode matrix (motor, heat, thermistors, moisture) |
| Error history | **Error Recall** (Dryness + Wrinkle Prevent) | Not highlighted same way |
| App / camera | **Smart Care** (Wrinkle Prevent 3s) | — |
| Vent test | **Vent Blockage Test** (model feature flag) | AF / F4E3 + timed exhaust temp |
| Post-repair check | Time dry 20 min, watch for HE/HC | Similar heat/airflow verification |

Solomon does not model keystrokes (brand-specific) but **Smart Install motor+heater OK/HC** maps to our functional checks + motor circuit / heat path.

---

## 5. Component specs (same parts, different numbers)

Use Whirlpool-anchored measurement knowledge for **generic** ranges; note Samsung deltas when the tech names the brand.

### Thermistors

| | Whirlpool (doc) | Samsung (doc) |
|---|-----------------|---------------|
| Electric | Inlet ~61–64 kΩ @ 68°F; exhaust ~11–14 kΩ @ 70°F | **10 kΩ @ 25°C (77°F)** (electric table) |
| Gas | Separate inlet curve | **238.23 kΩ @ 25°C** (gas table) |

Samsung gas inlet thermistor curve is **not** interchangeable with Whirlpool gas inlet thresholds — do not use `dryerInletThermistorOhmsGas` typical band for Samsung without a brand note.

### Heat / ignition (gas)

| Part | Whirlpool (prior seed) | Samsung |
|------|------------------------|---------|
| Igniter Ω | ~50–500 Ω | **40–400 Ω** |
| Valve coils | ~1400 / 570 / 1300 Ω | **1365 / 560 / 1325 / 1000 Ω** (4 coils) |
| Flame / radiant sensor | Continuity | **< 1 Ω** (10RS) |

### Heat (electric)

| | Whirlpool | Samsung |
|---|-----------|---------|
| Element | ~10–20 Ω typical single | **10 Ω** single; **13 Ω + 34 Ω** dual windings |
| Thermal cut-off | In heat path | 160°C / 25 A; hi-limit 179/99°C |

### Motor / belt

| | Whirlpool | Samsung |
|---|-----------|---------|
| Motor quick check | 1–6 Ω door-to-motor path | Centrifugal switch **2.88 Ω** (pins 3–4), **3.5 Ω** (4–5) |
| Belt interlock | Belt switch | **Belt cut-off switch** — open lever = ∞, pushed = < 1 Ω |

### Door switch

Both: COM–NC < 1 Ω closed, COM–NO open when door open (Samsung documents pin pairs explicitly).

---

## 6. What we added to Solomon from Samsung

| Change | Location |
|--------|----------|
| Samsung code → category aliases (tC, tC5, dC, dF, 9C1, AC, HC, FC, bC2) | `routing/routingEngine.ts` → `getDiagnosticMatchText()` |
| Eco Dry / washer extraction / child-lock / cool-down tips | `electricDryerFieldGuidance.ts`, `gasDryerFieldGuidance.ts` |
| Samsung code keywords on complaint chips | `electricDryerComplaints.ts`, `gasDryerComplaints.ts` |
| Error field help mentions Samsung codes | field help on `customer_complaint.error_codes` |
| Reusable PDF extract script | `backend/docs/manuals/extract_pdf.py` |

**Not added (brand-specific or low ROI):**

- Smart Care / SmartThings app flows  
- Samsung connector pinouts and part numbers  
- Separate measurement seed rows per Samsung curve (needs brand field on equipment or subtype)  
- Samsung-only DMA seed entries (different code strings; aliases cover routing)

---

## 7. Bottom line

| Category | Overlap |
|----------|---------|
| Complaint clusters (no heat, long dry, no tumble, vent) | **~90%** — same physics |
| Error code vocabulary | **Low** — F#E# vs tC/dC/9C1; mapped via aliases |
| Measurement numeric thresholds | **Moderate** — same components, different Ω tables |
| Pre-service / vent / lint | **~95%** |
| Control/UI/door paths | **~85%** |

The Whirlpool extraction remains the **primary** knowledge source. Samsung confirms vent-first thermistor faults, door/belt interlocks, and adds **Eco Dry / washer spin-out / child lock** as real-world long-dry and “dead UI” causes worth capturing generically.

---

## 8. Re-extract command

```bash
python backend/docs/manuals/extract_pdf.py backend/docs/manuals/samsung-dryer-electric-gas.pdf
```
