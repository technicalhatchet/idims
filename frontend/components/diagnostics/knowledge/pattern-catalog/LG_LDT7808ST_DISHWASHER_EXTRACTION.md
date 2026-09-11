# LG LDT7808ST dishwasher extraction

**Source:** `backend/docs/manuals/LDT7808ST.pdf`  
**Extracted text:** `backend/docs/manuals/LDT7808ST-extracted.txt`  
**Platform:** `lg_dishwasher_ldt7808` (`templateId`: `dishwasher`)  
**Models:** LDT7808**, LSDT9908** (manual cover; shared family with LDT7797, LDP6797, etc.)  
**Status:** Complete — procedures generated.

---

## Display error messages (§7-1)

| Message | Meaning | First checks |
|---------|---------|--------------|
| IE / INLET ERROR | Fill fault | Water supply; inlet valve 23~27 Ω; hall sensor 9 kΩ; air breaker |
| OE / DRAIN ERROR | Drain fault | Filter; drain hose; drain pump 4~5 Ω |
| AE / LEAKAGE ERROR | Leak detected | Door gasket; float; sump seal; level |
| BE / BUBBLE ERROR | Excess suds | Dishwasher detergent only; level |
| EXCESS ERROR | Overfill auto-drain | Inlet valve; hole sensor after PCB swap |
| tE / THERMAL ERROR | Thermistor abnormal | RD6 harness; thermistor 8~44 kΩ |
| HE / HEATER ERROR | Heater circuit | Inlet temp; heater 11.54 Ω ±10% |
| MOTOR ERROR | Wash motor fault | Impeller; wash motor 22.5~24.9 Ω @ 20°C |
| VARIO ERROR | Vario cam position | Vario S/W; vario motor 4 kΩ ±5% |

**AE checklist:** Level, mounting bracket, detergent type, cycle count, water supply temp, door opened during cycle (§7-1).

---

## Test mode (§3-3)

| Entry | Action | Load / display |
|-------|--------|----------------|
| Enter | Power + Start ×1 | Version (n35/U00/D00); nC = NFC/Wi-Fi fail |
| Start ×1 | | Sump temp; dispenser; EE = EEPROM fail |
| Start ×2 | Door closed | Drying fan motor |
| Start ×3 | Door closed | Soil sensor |
| Start ×4 | | Drain motor RPM |
| Start ×5 | Door closed | Inlet valve frequency |
| Start ×6 | Door closed | Wash motor RPM |
| Start ×7 | Door closed | Heater + Vario (nE = vario fail) |
| Start ×8 | | Power off |

**LQC water supply check (§7-2 p.49):** Power + Start → Start ×5 (listen for fill) → Power off.

---

## Procedure index (generated)

| ID | OEM | Tags |
|----|-----|------|
| `ldt7808-inlet-valve` | §7-1 IE / §7-2 | IE, fill_issue |
| `ldt7808-hall-sensor` | §7-2 hall | IE, fill_issue |
| `ldt7808-drain-pump` | §7-1 OE / §7-2 | OE, drain_issue |
| `ldt7808-thermistor` | §7-1 tE / §7-2 | tE |
| `ldt7808-heater` | §7-1 HE / §7-2 | HE, no_heat |
| `ldt7808-wash-motor` | §7-1 motor / §7-2 / §7-3 | motor_error |
| `ldt7808-vario-valve` | §7-1 VARIO / §7-2 | VARIO_ERROR, vario_error |
| `ldt7808-leak-float` | §7-1 AE / §7-2 | AE, leak_ae |
| `ldt7808-bubble-error` | §7-1 BE | BE, bubble_error |
| `ldt7808-excess-fill` | §7-1 EXCESS | fill_issue |

**Bundles:** `ldt7808-test-mode-entry`, `ldt7808-water-supply-check`

---

## Complaint routing

| Symptom | Route |
|---------|-------|
| Won't fill | IE → inlet valve → hall sensor |
| Won't drain | OE → drain pump |
| Leak on floor | AE → door gasket / float |
| Poor wash top rack | VARIO ERROR → vario valve |
| Suds overflow | BE |
| No heat | HE / tE → heater / thermistor |

---

## Measurements (batch35)

| knowledgeId | Spec | Field binding |
|-------------|------|---------------|
| `lgDishwasherLdt7808InletValveOhms` | 23~27 Ω | `motor_electrical.inlet_valve_ohms` |
| `lgDishwasherLdt7808HallSensorOhms` | 9 kΩ ±5% | (procedure only) |
| `lgDishwasherLdt7808DrainPumpOhms` | 4~5 Ω | `motor_electrical.drain_motor_ohms` |
| `lgDishwasherLdt7808ThermistorOhms` | 8~44 kΩ | `heat_water.thermistor` |
| `lgDishwasherLdt7808HeaterOhms` | 11.54 Ω ±10% | `heat_water.heater_ohms` |
| `lgDishwasherLdt7808WashMotorOhms` | 22.5~24.9 Ω @ 20°C | `motor_electrical.wash_motor_ohms` |
| `lgDishwasherLdt7808VarioMotorOhms` | 4 kΩ ±5% | (procedure only) |

**Pipeline:** `python backend/scripts/run_procedure_manual_pipeline.py --manual LG-LDT7808-DISHWASHER`
