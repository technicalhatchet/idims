# Insignia NS-DWR3SS1 dishwasher extraction

**Source (canonical):** `NS-DWR3SS1 service manual again-ocr.pdf`  
**Extracted text:** `NS-DWR3SS1 service manual again-ocr-extracted.txt` (24k chars, 4 empty pages)  
**Legacy:** `NS-DWR3SS1 service manual again.pdf` — same layout but pages 8–24 were image-only to PyMuPDF; **use `-ocr` file**  
**Scope:** Insignia top-control dishwasher; Midea OEM platform (Whirlpool ADA–like E-family)  
**Status:** Phase A + B + C merged (E-family routing/evidence).

---

## Error codes (§28 / page 26)

| Code | Meaning | First checks |
|------|---------|--------------|
| E1 | Water inlet failure (4 min fill) | Supply; inlet valve; flow meter; pressure switch; drain; PCB |
| E3 | Heater failure (90 min) | Heater; thermistor; PCB |
| E4 | Overflow / base pan | Detergent; level; micro-switch; drain pump; leak source |
| E6 | NTC open (factory mode) | Inlet water temp; thermistor |
| E7 | NTC short (factory mode) | Thermistor; PCB |
| E8 | Diverter valve assembly | Diverter motor; micro switch; PCB |
| E9 | Stuck button (>30 s) | Control panel assembly |
| Ed | Display ↔ main comm (>20 s) | Display board; harness; PCB |

**Note:** OCR renders **E1** as `El` in raw text — normalize to E1 in DMA lookup.

---

## Complaint routing

| Symptom | Route |
|---------|-------|
| Won't fill | E1 |
| Won't heat / long cycle | E3 |
| Leak / water in base | E4 |
| Top rack poor wash | E8 diverter |
| Panel dead / intermittent | Ed |
| Button stuck alarm | E9 |

---

## vs Whirlpool ADA dishwasher

Same E1/E3/E4/E6/E7 semantics as W11187658 platform — Insignia rows seeded under **manufacturer: Insignia**, subtype `dishwasher`.

**DMA:** New Insignia `dishwasher` rows in supplement append.

---

## Measurements (Phase D — brand-aware)

Platform: `insignia_dishwasher` (NS-DWR3*)

| knowledgeId | Spec | Field |
|-------------|------|-------|
| `insigniaDishwasherFillValveOhms` | ~1 kΩ | `motor_electrical.inlet_valve_ohms` |
| `insigniaDishwasherDrainPumpOhms` | ~25–35 Ω | `motor_electrical.drain_motor_ohms` |
| `insigniaDishwasherHeaterOhms` | 10–15 Ω | `heat_water.heater_ohms` |
| `insigniaDishwasherTubThermistorOhms` | 10 kΩ ±2% @ 25°C | `heat_water.thermistor` |
