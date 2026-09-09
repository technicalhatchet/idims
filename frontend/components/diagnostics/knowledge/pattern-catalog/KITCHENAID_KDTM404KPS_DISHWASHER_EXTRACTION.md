# KitchenAid KDTM404KPS dishwasher extraction

**Source:** `Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142.pdf`  
**Extracted text:** `Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142-extracted.txt`  
**Scope:** KitchenAid premium dishwasher; ACU + variable-speed wash motor; RIF filter; diverter  
**Status:** Phase A + B + C + D (procedures on `whirlpool_dishwasher_acu`, manual W11366142).

Cross-reference: [WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md](./WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md) for shared F#E# matrix.

---

## Error codes (F#E# + FAE aliases)

| Code | Meaning | First test |
|------|---------|------------|
| F1E1 | ACU failure | Replace ACU |
| F1E2 | MCU failure | Replace ACU |
| F2E1 | Stuck key | UI / console |
| F3E1 | Thermistor or OWI open/short | Harness; OWI |
| F3E2 | OWI calibration failed | Clean OWI; drain loop |
| F4E2 | Heater open / relay failed | Heater circuit |
| F4E3 | Heater relay shorted | Control + heater |
| F5E1 | Door stuck open | Latch |
| F5E2 | Door stuck closed | Latch; user education |
| F6E1 | No ACU response | HMI harness |
| F7E1 | Single-speed wash motor | Motor |
| F7E2 | Variable-speed wash motor | Motor |
| F7E4 | RIF filter plugged | Clean filter |
| F8E1 | No water / tap closed | Supply |
| F8E2 | Fill valve electrical | Valve coil |
| F8E3 | Low water / suds in pump | Detergent |
| F8E4 | Overfill / float | Float; inlet stuck |
| F8E5 | Fill valve stuck on | Replace valve |
| F8E6 | Flow meter failed | Flow meter |
| F9E1 | Not draining | Drain path |
| F9E2 | Drain motor electrical | Drain motor |
| F9E4 | Tub light failure | Tub light |
| F10E1 | Dispenser electrical | Dispenser |
| F10E2 | Vent wax motor | Vent motor |
| F10E3 | Drying fan | Fan motor |
| F10E4 | Diverter position | Diverter motor |
| F10E5 | Diverter leak | Diverter seal |

**FAE1–FAE5** mirror F10E1–E5 on some UI variants.

---

## Service mode

- Error history: most recent first; 3rd key advances; 3 tones at end
- Clear errors via service sequence on tech sheet

---

## Strip circuit Ω specs (W11366142 tech sheet)

| Component | Connector / pins | Spec | knowledgeId |
|-----------|------------------|------|-------------|
| Drain motor (SSM) | P5-3 & P5-4 | 27.4–32.2 Ω | `whirlpoolDishwasherPremiumDrainMotorOhms` (batch33) |
| Fill valve | P6-1 & P6-3 | 1200–1600 Ω | `whirlpoolDishwasherAcuFillValveOhms` (reused) |
| Diverter motor | P6-4 & P6-6 | 1100–1400 Ω | `whirlpoolDishwasherFiltrationDiverterMotorOhms` (reused) |
| Vent wax motor | harness, each coil | 1890–2310 Ω | `whirlpoolDishwasherPremiumVentWaxMotorOhms` (batch33) |
| Dispenser | P12-5 & P12-7 | 310–380 Ω | `whirlpoolDishwasherPremiumDispenserOhms` (batch33) |
| Heater | P4-2 & P4-3 | 10–40 Ω | `whirlpoolDishwasherAcuHeaterOhms` (reused) |
| VSM wash motor | P5-1 & P5-2 | 16–18 Ω (filtration VSM family) | `whirlpoolDishwasherFiltrationVsmWashMotorOhms` (reused) |
| DC fan (ProDry) | P14-1 & P14-2 | 145–185 kΩ | `whirlpoolDishwasherFiltrationDcFanOhms` (reused) |
| Tub light | P9 | 12 V PWM | visual — `w11366142-tub-light` |

**Model patterns:** `KDTM404*`, `KDTM604*`, `KDTM804*` (KitchenAid premium).

---

## Generated procedures (W11366142 deltas)

| ID | Tags / codes | Notes |
|----|--------------|-------|
| `w11366142-wash-motor-vsm` | F7E2 | A-SYNCH variable-speed wash; not WDT750 SSM |
| `w11366142-drain-motor` | F9E1, F9E2 | 27.4–32.2 Ω SSM drain (not VSM P5-5/6) |
| `w11366142-dispenser` | F10E1 | 310–380 Ω measured (replaces visual-only reuse) |
| `w11366142-vent-wax-motor` | F10E2 | First platform vent-wax bench proc |
| `w11366142-tub-light` | F9E4 | Tub light F9E4 (not generic interior LED) |
| `w11366142-rif-filter` | F7E4 | RIF filter clean — KitchenAid premium only |

**Reused** from W11633848 / W11480208: triac, ACU power, door, fill, heater, OWI, overfill, diverter motor/sensor, DC fan.

**Not reused:** W11499711 SSM wash, W11794121 D.O.S., W11480208 interior LED, W11480208 VSM drain.

**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual W11366142`

---

## Phase B/C (deferred)

- Manufacturer filter: KitchenAid vs Whirlpool same codes, different DMA manufacturer key
- Chips: `owi_calibration`, `rif_filter`, `diverter_leak`
- Evidence rules for F3E2, F8E3 suds, F10E5 diverter leak

**DMA:** Full KitchenAid `dishwasher` set in batch append.
