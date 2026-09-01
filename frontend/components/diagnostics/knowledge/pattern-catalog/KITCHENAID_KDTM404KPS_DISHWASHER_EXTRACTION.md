# KitchenAid KDTM404KPS dishwasher extraction

**Source:** `Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142.pdf`  
**Extracted text:** `Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142-extracted.txt`  
**Scope:** KitchenAid premium dishwasher; ACU + variable-speed wash motor; RIF filter; diverter  
**Status:** Phase A + B + C merged (shared dishwasher ACU routing/evidence).

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

## Phase B/C (deferred)

- Manufacturer filter: KitchenAid vs Whirlpool same codes, different DMA manufacturer key
- Chips: `owi_calibration`, `rif_filter`, `diverter_leak`
- Evidence rules for F3E2, F8E3 suds, F10E5 diverter leak

**DMA:** Full KitchenAid `dishwasher` set in batch append.
