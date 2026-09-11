# Samsung RS28/RS23 side-by-side refrigerator — extraction

**Source:** `backend/docs/manuals/samsung rs28 sxs.pdf` (115 pp., RS28A500*/RS23A500*/Family Hub RS28A5F61*)  
**Cross-ref:** `backend/docs/manuals/samsung-refrigerator-sxs-svc manual.pdf` (128 pp., RS28T5B** dispenser LED-panel SxS)  
**Extracted text:** `backend/docs/manuals/samsung rs28 sxs-extracted.txt`  
**Platform:** `samsung_sxs` (delta procedures — extends RF260B, different connector map)  
**Status:** Complete — §4-2 self-diagnostic checklist + service modes  
**Knowledge:** batch6 (thermistor/fan/IPM voltage) + batch38 (RS28 damper heater 48 Ω)

Cross-reference: [SAMSUNG_RF260B_FRIDGE_EXTRACTION.md](./SAMSUNG_RF260B_FRIDGE_EXTRACTION.md), [SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md](./SAMSUNG_REFRIGERATOR_SXS_EXTRACTION.md), [SAMSUNG_RS22T_SXS_EXTRACTION.md](./SAMSUNG_RS22T_SXS_EXTRACTION.md).

---

## Platform decision

**Extend `samsung_sxs`** — same refrigerator template, same NTC voltage (4.5→1.0 V) and fan feedback (7–12 V) patterns, same 63 Ω F-DEF heater band. Architecture differs from RF260B (CN20/CN40/CN90 vs CN30/CN76/CN78) but not enough for a separate platform. Model routing adds RS28/RS23 patterns alongside RF260/RF261.

---

## 1. Model routing

| Pattern | Example models |
|---------|----------------|
| RS28A500* | RS28A500ASR, RS28A5000SR |
| RS28A5F61* | Family Hub RS28A5F61AST |
| RS23A500* | RS23A500ASR |
| RS28T5B* | Dispenser LED-panel (svc manual) |
| RS22T5561*, RS22T520* | RS5300TC project (svc manual) |
| RS27T5561*, RS27T520* | RS5300TC project (svc manual) |
| RS5300* | RS5300TC / RS5300T series name |

Make: **Samsung** only. Template: `refrigerator`.

---

## 2. Service modes

| Mode | Entry | Bundle |
|------|-------|--------|
| **Engineer / Fridge Function Test** | A-B-A-B-A-B touch within 3 s → Fridge Function Test | `samsungrs28-engineer-test-entry` |
| **Force Run / Force Defrost** | Engineer mode → Force Run 1/2/3 or Fd | (same bundle) |
| **LED test mode** | Fridge + Power Cool 6 s → Power Cool → FF/Fd cycle | `samsungrs28-led-test-mode-entry` |
| **Self-diagnostic (touch)** | Engineer mode → Self Diagnosis (60 s) | `samsungrs28-self-diagnostic-entry` |
| **Self-diagnostic (LED)** | Fridge + Power Cool 6 s then 10 s total → LEDs 30 s | (same bundle) |
| **Load status** | Engineer → Load Status (30 s) or LED: Fridge+Power Cool 6 s → Freezer key | — |

---

## 3. Self-diagnostic checklist (§4-2, pp. 67–69)

| LED item | Test point | Spec | Procedure ID |
|----------|------------|------|--------------|
| F-Sensor | CN20 1 ↔ 3 | 4.5→1.0 V | `samsungrs28-f-sensor` |
| R-Sensor | CN20 10 ↔ 12 | 4.5→1.0 V | `samsungrs28-r-sensor` |
| F-DEF-Sensor | CN20 5 ↔ 7 | 4.5→1.0 V | `samsungrs28-f-def-sensor` |
| Ambient | CN40 18 ↔ 20 | 4.5→1.0 V | `samsungrs28-ambient-sensor` |
| Humidity | CN40 14 ↔ 20 | 4.5→1.0 V | `samsungrs28-humidity-sensor` |
| Ice maker sensor | CN90 11 ↔ 13 | 4.5→1.0 V | `samsungrs28-ice-maker-sensor` |
| F-FAN | CN20 15 ↔ 17 | 7–12 V | `samsungrs28-f-fan` |
| C-FAN | CN20 22 ↔ 24 | 7–12 V | `samsungrs28-c-fan` |
| F-DEF heater | CN70-5 ↔ CN85-3 | 63/230 Ω ±7% | `samsungrs28-f-defrost-heater` |
| Damper heater | CN40 25 ↔ 27 | 48 Ω ±7% | `samsungrs28-damper-heater` |
| Ice pipe heater | CN90 1 ↔ 5 | 7–12 V | `samsungrs28-ice-pipe-heater` |
| Ice maker function | Replace + verify | functional | `samsungrs28-ice-maker-function` |
| 41Er | Main ↔ panel | harness / PCB | `samsungrs28-panel-communication` |
| 44Er | Main ↔ inverter | harness / PCB | `samsungrs28-inverter-communication` |
| 46Er | I/O expander | replace MAIN | `samsungrs28-io-expander-communication` |
| 47Er | Dispenser panel | harness / PCB | `samsungrs28-dispenser-communication` |
| 52Er | Wi-Fi module | harness / PCB | `samsungrs28-wifi-communication` |

### Variant notes

- **R-Sensor pins:** RS28A500 manual = CN20 10↔12; RS28T5B svc manual = CN20 2↔4 (LED panel).
- **Damper heater:** RS28A500 = 48 Ω resistance; RS28T5B svc manual lists 7–12 V when commanded.
- **No FF evaporator fan** on RS28 (single F-fan + C-fan only vs RF260B FZ/FF/C trio).
- **No pantry/humidity on RF260B-only paths** — humidity is RS28-specific on CN40.

---

## 4. Measurements

| Knowledge ID | Spec | Connector |
|--------------|------|-----------|
| `refrigeratorThermistorVoltage` | 4.5→1.0 V | CN20/CN40/CN90 per sensor |
| `refrigeratorEvapFanFeedbackVoltage` | 7–12 V | CN20 fan feedback; CN90 ice pipe |
| `refrigeratorInverterIpmVoltage` | >13.5 V DC | IPM / compressor path |
| `samsungRefrigeratorDefrostHeaterOhms` | 63 Ω ±7% | CN70-5 ↔ CN85-3 |
| `samsungRs28DamperHeaterOhms` | 48 Ω ±7% | CN40 25 ↔ 27 |

---

## 5. Diagrams

| Asset | Page | Section |
|-------|------|---------|
| `samsungrs28-main-pcb-layout.png` | 100 | §6-1 PBA layout |
| `samsungrs28-main-pcb-connectors.png` | 101 | §6-2 Connector layout |

---

## 6. Pipeline

```bash
python backend/scripts/crop_samsung_rs28_procedure_figures.py
python backend/scripts/generate_samsung_rs28_fridge_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

WO smoke: RS28A500ASR + Samsung → `samsung_sxs`; 5E → `samsungrs28-f-def-sensor`; 41E → `samsungrs28-panel-communication`.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/samsung rs28 sxs.pdf"`*
