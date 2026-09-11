# Whirlpool/Maytag/Amana/IKEA SxS refrigerator — W11296289 extraction

**Source:** `backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator.pdf` (R-126, ©2018)  
**Extracted text:** `backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator-extracted.txt`  
**Scope:** 21–25 cu ft side-by-side, single evaporator, external dispenser (most models).  
**Status:** Phase A + B + C — service mode routing, voltage test points, bench Ω specs.

**Platform:** `whirlpool_sxs_w11296289` — `WRS321*`, `WRS325*`, `WRS315*`, `WRS311*`, `WRS312*`, `ASI2575*`, `WRSA15*`.

---

## 1. Control board variants

| Board | Wiring diagram | Models (examples) | Service UI |
|-------|----------------|-------------------|------------|
| **THESEUS** ACU | A (§3-3) | WRS321SD*, WRS325SD* | CUDA dispenser UI — LED step codes |
| **MINOTAUR** HMI | A (J1 only) | Same as THESEUS | 12.7 VDC + data on J1 |
| **ATHENA** ACU | B/C (§3-5, §3-7) | WRS311/315/312SN*, ASI2575*, WRSA15* | TEMP button + door switch |

---

## 2. Diagnostics mode — THESEUS / CUDA UI (§2-3–2-8)

**Entry (dispenser models):** First 5 min after power-on set RC + FC temp to minimum. Hold **FREEZER TEMP** + **ICE TYPE** 3 s. All LEDs verify, then press all 5 keys L→R to turn LEDs off.

| Key | Function |
|-----|----------|
| SW2 Light | Increment — next service step |
| SW4 Lock | Decrement — previous step |
| SW5 RC Temp | Change setting — ON/OFF load, PAUSE/RUN test |

Freezer TEMP LEDs = step code; Refrigeration TEMP LEDs = feedback.

| Step | Component | Action |
|------|-----------|--------|
| **1** | FC thermistor | Read/compare FC sensor — open/short/pass LED pattern |
| **3** | RC thermistor | Read/compare RC sensor |
| **5** | Defrost thermistor | Read/compare defrost sensor |
| **7** | Compressor & cond fan | Turn on cond fan; monitor load |
| **9** | Damper open | Open damper; monitor position |
| **11** | Damper heater | Energize damper heater |
| **13** | Defrost heater | Energize defrost heater |
| **15** | Evaporator fan | Turn on evap fan |
| **17** | Dispenser light | Dispenser lights on |
| **19** | Water valve | Press water paddle; valve stays on until Light key |
| **21** | RC door switch | RC lights on/off with door |
| **23** | FC door switch | FC lights on/off with door |
| **25** | Ice paddle | Paddle press feedback (no water) |
| **27** | Water paddle | Paddle press feedback (no dispense) |
| **29–35** | IDI twist-tray IM | Harvest, water fill, tray thermistor (door IM only) |

**Sensor LED feedback (steps 1, 3, 5, 33):** Open = LED6+LED7 on; Short = LED8 on; Pass = LED6–8 on; Blank = awaiting valid reading.

---

## 3. Diagnostics mode — ATHENA (§2-8)

**Entry:** Within 30 s of power-up, TEMP to min, hold **door switch closed** + **RC TEMP** 5 s.

Advance with **SW1** (3 s between presses). Steps 1–7 auto-cycle loads/sensors; **step 6** shows fail LED pattern if fault stored.

### Display fail message (step 6)

| D9 | D8 | D7 | D6 | Fault |
|----|----|----|-----|-------|
| off | off | off | on | Main board (heater or compressor driver) |
| off | on | off | off | Refrigerator sensor |
| on | off | off | off | Defrost sensor |
| on | on | off | off | RC + defrost sensor |
| off | on | on | off | Main board + RC sensor |
| on | off | on | off | Main board + defrost sensor |
| on | on | on | off | Multiple failures |

All LEDs blank at step 6 = drivers and sensors OK.

---

## 4. Voltage test points — THESEUS (§3-3, diagram A)

| Connector | Pins | Spec |
|-----------|------|------|
| P1 | P1-1 ↔ P1-2 | 120 VAC input (BK/WH) |
| P1 | P1-2 ↔ P1-4 | 120 VAC to compressor/cond fan when cooling (WH/RD) |
| P2 | P2-6 ↔ P1-2 | 120 VAC evap fan when cooling (RD/WH) |
| P2 | P2-7 ↔ P1-2 | 120 VAC defrost heater when defrosting (BR/WH) |
| P3 | P3-4 ↔ P1-2 | 120 VAC water valve when dispensing |
| P5 | P5-1 ↔ P5-2 | 5 VDC RC thermistor (GY) |
| P5 | P5-3 ↔ P5-4 | 5 VDC FC thermistor (TN) |
| P8 | P8-1 ↔ P8-2 | 5 VDC defrost thermistor (PK) |
| P70/P11 | damper coils | 12 VDC pulse damper stepper |
| P11 | P11-3 ↔ P11-4 | 12 VDC damper heater (BR) |
| P4 | P4-1 ↔ P4-4 | 12.7 VDC to UI (OR/LB) |

## 5. Voltage test points — ATHENA (§3-5, §3-7, diagrams B/C)

| Connector | Pins | Spec |
|-----------|------|------|
| J2 | J2-1 ↔ J2-2 | 5 VDC evaporator (FC) thermistor (PK) |
| J2 | J2-3 ↔ J2-4 | 5 VDC refrigerator (RC) thermistor (GY) |
| JP1 | JP1-3 ↔ JP1-6 | 120 VAC input constant (BK/WH) |
| JP1 | JP1-4 ↔ JP1-6 | 120 VAC compressor + fans when cooling (RD/WH) |
| JP1 | JP1-2 ↔ JP1-6 | 120 VAC defrost heater when defrosting (BR/WH) |
| JP1 | JP1-1 ↔ JP1-3 | 120 VAC FC light switch feedback when door open (YL/BK) |

---

## 6. Bench Ω specifications (§2-3 service matrix)

| Component | Resistance / notes |
|-----------|------------------|
| Thermistor | **2.7 kΩ @ 25°C** (all sizes) |
| Defrost heater | **550–650 Ω** @ 115 VAC |
| Evaporator fan motor | **2–9 Ω** |
| Condenser fan motor | **3–12 Ω** |
| Compressor run windings | **1–5 Ω** (EGX60HLC / EM3Y60HLP) |
| Electric air baffle | 12 VDC (damper stepper) |

**Compressors:** EGX60HLC (102 W) or EM3Y60HLP (109 W) per cu ft matrix.

**Performance (normal cycling, mid settings):** EG series 70°F amb ~140 W; EM3 ~120 W. High/low side PSIG per §2-4 table.

---

## 7. Complaint routing

| Symptom | Priority procedures |
|---------|---------------------|
| Warm FF, cold FZ | Damper open (step 9); RC thermistor (step 3) |
| Warm both | Compressor/cond fan (step 7); sealed system |
| Heavy frost / no defrost | Defrost heater (13); defrost thermistor (5) |
| Weak airflow | Evap fan (15); frost on evap |
| No water dispense | Water valve (19); paddle switches 25/27 |
| Athena fail LEDs | `w11296289-athena-fail-display` |
| No ice (IDI door IM) | Steps 29–33 harvest/fill/tray NTC |

---

## 8. Captured vs gaps

### Captured

- THESEUS service steps 1–28 + IDI 29–35  
- ATHENA 7-step auto service + fail LED decode  
- THESEUS P1–P11 + ATHENA J2/JP1 voltage tables  
- Bench Ω matrix (thermistor, heater, fans, compressor)  
- Diagram crops: voltage test point pages (p.33, 35, 37)

### Gaps

| Gap | Notes |
|-----|-------|
| No alphanumeric fault codes | LED patterns only (THESEUS + ATHENA) |
| MINOTAUR HMI | J1 UI supply only — no separate service steps |
| Non-dispenser models | Fewer service steps; ATHENA B/C wiring |
| Showroom mode | §2-9–2-10 — not procedure-seeded |

---

## 9. Re-seed & verify

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11296289
cd frontend && npx tsc --noEmit
```

WO smoke: Whirlpool `WRS325SDHZ` → `whirlpool_sxs_w11296289`; warm FF → `w11296289-test-09-damper-open`.

---

*Regenerate PDF text: `python backend/docs/manuals/extract_pdf.py "backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator.pdf"`*
