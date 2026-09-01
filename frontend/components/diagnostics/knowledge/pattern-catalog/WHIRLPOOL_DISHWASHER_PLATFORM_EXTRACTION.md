# Whirlpool dishwasher platform extraction

**Sources:**
- `Whirlpool Dishwasher Service Manual.pdf` — W11187658 (ADA 18"/24" built-in)
- `Whirlpool dishwasher tech-sheet-W10751166-RevC.pdf`
- `Tech Sheet - W10867183 - Rev B.pdf`

**Extracted text:** `*-extracted.txt` in `backend/docs/manuals/`  
**Scope:** Whirlpool ADA legacy (E-series) + modern ACU F#E# matrix (W10751166/W10867183)  
**Status:** Phase A + B + C merged (shared dishwasher ACU routing/evidence).

**Phase B warning:** Existing Whirlpool `dishwasher` DMA rows may mis-map F# function numbers vs tech sheets — reconcile during merge.

---

## 1. ADA legacy platform (W11187658)

| Code | Display | Meaning | Checks |
|------|---------|---------|--------|
| E1 | Quick flashes | Water inlet failure (4 min) | Supply; inlet valve; flow meter; pressure switch; drain |
| E3 | Quick + Glass | Heater failure (90 min) | Heater; thermistor; control |
| E4 | Light flashes | Overflow / base pan | Detergent; level; overflow switch; leak |
| E6 | Light + Glass | NTC open | Thermistor harness |
| E7 | Light + Glass + Quick | NTC short | Thermistor harness |

**No consumer F-codes** on this platform — LED flash patterns only.

---

## 2. Modern ACU platform (W10751166 / W10867183)

Full F#E# matrix shared with KitchenAid/Whirlpool premium dishwashers:

| Family | Examples | Domain |
|--------|----------|--------|
| F1 | F1E1 ACU, F1E2 MCU | Control |
| F2 | F2E1 stuck key | UI |
| F3 | F3E1 thermistor/OWI, F3E2 OWI cal | Sensing |
| F4 | F4E2 heater open, F4E3 relay short | Heat |
| F5 | F5E1 door open, F5E2 door closed | Latch |
| F6 | F6E1 UI↔ACU comm | Harness |
| F7 | F7E1/E2 wash motor, F7E4 RIF filter | Wash path |
| F8 | F8E1–E6 fill / overfill / flow meter | Fill |
| F9 | F9E1 drain, F9E2 drain motor, F9E4 tub light | Drain |
| F10 | F10E1–E5 dispenser, vent, diverter | Outputs |

**Service aids:** Error history (3rd key advance); fuse F600 wash motor, F601 triac loads (W10867183).

---

## 3. Complaint routing

| Symptom | Priority |
|---------|----------|
| Won't fill | E1 / F8E1; inlet valve; flow meter |
| Won't heat | E3 / F4E2; heater; OWI |
| Won't drain | F9E1; drain motor; filter |
| Leak / E4 | Base pan; door gasket; diverter F10E5 |
| Stuck keys | F2E1 |

---

## 4. Measurements (Phase D — brand-aware)

Platform: `whirlpool_dishwasher_acu` (Whirlpool + KitchenAid)

| knowledgeId | Spec | Field |
|-------------|------|-------|
| `whirlpoolDishwasherAcuWashMotorOhms` | 5–15 Ω | `motor_electrical.wash_motor_ohms` |
| `whirlpoolDishwasherAcuDrainMotorOhms` | 15–60 Ω | `motor_electrical.drain_motor_ohms` |
| `whirlpoolDishwasherAcuHeaterOhms` | 8–30 Ω | `heat_water.heater_ohms` |
| `whirlpoolDishwasherAcuFillValveOhms` | 890–1,600 Ω | `motor_electrical.inlet_valve_ohms` |
| `whirlpoolDishwasherAcuOwiThermistorOhms` | 46–52 kΩ @ 77°F | `heat_water.thermistor` |

Source: W10751166 Rev C tech sheet.

---

## 5. Consolidation

Single platform doc for Whirlpool dishwasher — subtype `dishwasher`. KitchenAid KDTM404KPS uses same ACU F#E# set (separate manufacturer DMA rows).

**DMA:** E1–E7 ADA rows + KitchenAid F#E# rows in batch append (Whirlpool F#E# may already partially exist — deduped on append).
