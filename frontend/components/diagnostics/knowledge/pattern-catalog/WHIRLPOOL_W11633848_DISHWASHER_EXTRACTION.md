# Whirlpool/Amana 24" dishwasher — W11633848 extraction

**Source:** `backend/docs/manuals/technical-manual-w11633848-revb amana and whirlpool dishwasher.pdf` (W11633848 Rev B)  
**Extracted text:** `backend/docs/manuals/technical-manual-w11633848-revb amana and whirlpool dishwasher-extracted.txt`  
**Platform:** `whirlpool_dishwasher_acu` (shared with W10751166 / W10867183 F#E# matrix — see [WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md](./WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md))  
**Measurements:** batch9 (`whirlpoolDishwasherAcu*` knowledge IDs)  
**Status:** Procedure seeds generated from §2 Service Diagnostics + §3 Component Testing

---

## 1. Service Diagnostics cycle (§2-3)

| Item | Detail |
|------|--------|
| Entry | Standby → press any 3 keys **1-2-3-1-2-3-1-2-3** (≤1 s between presses) |
| Start | Cycle begins when **door closes** |
| Advance | **START/RESUME** = rapid advance one interval (may skip sensor checks) |
| Pause | Opens on door open; resumes on close (no Start press) |
| Side effects | Clears status/history; forces next regular cycle = OWI calibration |
| Display test | All LEDs on 5 s after entry; 1 s off before error history |
| Clear codes | Hold **Cycle/Normal** during 9 s interval after customer codes (Clean LED blinks) |

**Loads exercised (timing chart §2-3):** fill valve, wash motor (pulsed), drain motor, heater, dispenser, diverter (+ position on some models), vent (visual), thermistor/OWI internal check, fan (some models).

**Bundle:** `w11633848-service-diagnostic-entry`

---

## 2. Service error codes → procedure routing

| Code | Meaning (summary) | Primary procedure |
|------|-------------------|-------------------|
| F1E1 | Pilot relay stuck / triac fuse | `w11633848-triac-fuse`, `w11633848-acu-power` |
| F1E2 | Control software | Replace ACU (no bench test) |
| F2E1 | Stuck key / UI | Deferred — no §3 meter procedure |
| F3E1 | OWI/thermistor open | `w11633848-owi-sensor` |
| F3E2 | OWI short / cal | `w11633848-owi-sensor` |
| F3E3 | OWI cal fail | `w11633848-owi-sensor` |
| F4E2 | Heater open | `w11633848-heater` |
| F4E3 | Wash motor not running | `w11633848-wash-motor` |
| F5E1 | Door stuck open | `w11633848-door-switch` |
| F5E2 | Door stuck closed | `w11633848-door-switch` |
| F6E1–E4 | Fill / suds / float | `w11633848-fill-valve`, `w11633848-overfill-switch` |
| F7E1 | No heat | `w11633848-heater` |
| F7E2 | Heater stuck on | `w11633848-heater` |
| F8E1 | Slow drain (mechanical) | `w11633848-drain-motor` + mechanical |
| F8E2 | Fill valve electrical | `w11633848-fill-valve` |
| F8E4 | Drain motor electrical | `w11633848-drain-motor` |
| F8E5 | Fill valve stuck open | `w11633848-overfill-switch` |
| F8E6 | Flow meter | **Gap** — error table only |
| F9E1 | Diverter can't find position | `w11633848-diverter-motor`, `w11633848-diverter-sensor` |
| F9E2 | Drain motor electrical | `w11633848-drain-motor` |
| F10E1–E3 | Dispenser / vent / fan | `w11633848-dispenser`, `w11633848-dc-fan` |
| F10E5 (FAE4) | Diverter leak | `w11633848-diverter-motor` |

Legacy aliases in manual: F10E2→FAE2, F10E3→FAE3, F10E5→FAE4.

---

## 3. Component tests (§3) — Ω / test points

| Circuit | Manual § | Connector / pins | Spec (W11633848) | batch9 knowledgeId |
|---------|----------|------------------|------------------|-------------------|
| F500 triac fuse | 3-3 | Control board | < 3 Ω OK | — (visual/instruction) |
| AC power | 3-6 | Terminal L1/N; P4-1 & P4-4 | 120 VAC | `supplyVoltage120` |
| Door switch | 3-7 | P9-5 & P9-6 | ≤3 Ω closed; OL open | `dishwasherDoorLatchSwitchOhms` |
| Fill valve | 3-8 | P6-1 & P6-3 | 1200–1600 Ω (manual); 890–1600 in overfill strip | `whirlpoolDishwasherAcuFillValveOhms` |
| Dispenser solenoid | 3-9 | P12-5 & P12-7 | 310–380 Ω | **Gap** — visual checkpoint |
| Heater | 3-10 | P4-2 & P4-3 | 8–30 Ω | `whirlpoolDishwasherAcuHeaterOhms` |
| OWI NTC | 3-11 | P10-1 & P10-3 | 46–52 kΩ @ 77°F; R/T table §3-11 | `whirlpoolDishwasherAcuOwiThermistorOhms` |
| Overfill float | 3-12 | P6-4 & P6-6 | ≤3 Ω float down; OL float up | `dishwasherFloatSwitchOhms` |
| Diverter motor | 3-13 | P7-4 & P7-6 | 600–1800 Ω | **Gap** — visual checkpoint |
| Diverter position | 3-14 | P11-2 vs P10-2 | 0 V ↔ 8–10 V as diverter rotates | Service Diagnostics observation |
| Wash motor (SSM) | 3-15 | P5-1 & P5-2 | 6.7–8.7 Ω @ 25°C; F501 fuse <3 Ω | `whirlpoolDishwasherAcuWashMotorOhms` (5–15 platform) |
| Drain motor | 3-16 | P5-3 & P5-4 | 27–33 Ω (procedure); strip 15–60 Ω | `whirlpoolDishwasherAcuDrainMotorOhms` |
| DC fan | 3-17 | P14-1 & P14-2 | 31–41 kΩ; 5 VDC run | **Gap** — some models only |

**Fuses:** F500 triac loads; F101 main LVPS; F501 wash motor (some models).

---

## 4. Generated procedures

| ID | OEM section | Title |
|----|-------------|-------|
| `w11633848-acu-power` | §3-6 | ACU power & DC supplies |
| `w11633848-triac-fuse` | §3-3 | F500 triac load fuse |
| `w11633848-door-switch` | §3-7 | Door switch circuit |
| `w11633848-fill-valve` | §3-8 | Fill valve circuit |
| `w11633848-dispenser` | §3-9 | Dispenser solenoid |
| `w11633848-heater` | §3-10 | Water heating / heat dry |
| `w11633848-owi-sensor` | §3-11 | OWI / thermistor |
| `w11633848-overfill-switch` | §3-12 | Overfill float & fill valve |
| `w11633848-diverter-motor` | §3-13 | Diverter motor |
| `w11633848-diverter-sensor` | §3-14 | Diverter position sensor |
| `w11633848-wash-motor` | §3-15 | Wash motor (SSM) |
| `w11633848-drain-motor` | §3-16 | Drain motor |
| `w11633848-dc-fan` | §3-17 | DC fan motor (optional) |

**Bundle:** `w11633848-service-diagnostic-entry`

---

## 5. Gaps / deferred

- **Variable-speed wash motor** models — separate pinout (§3-4–3-5 figures); SSM procedure §3-15 used for seeds
- **Vent wax motor** — referenced in troubleshooting / F10E2; no dedicated §3 bench procedure
- **Interior LED lighting** (§3-18) — some models; diode check only
- **UI / F2E1** — stuck key handling in error table; no harness meter procedure
- **F8E6 flow meter** — fault description only
- **Diagram crops** — not in v1 (no pinout figures attached)

---

## 6. Pipeline

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11633848
cd frontend && npx tsc --noEmit
```

Dev smoke: `/solomon/procedures/dev` with make Whirlpool + model WDT* / MDB*.
