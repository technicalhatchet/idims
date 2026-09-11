# Samsung ME11 / ME21 over-the-range microwave — extraction

**Source:** `backend/docs/manuals/Samsung ME11A7510DSAA.pdf`  
**Extracted text:** `backend/docs/manuals/Samsung ME11A7510DSAA microwave-extracted.txt`  
**Manual ID:** `SAMSUNG-ME11-MICROWAVE`  
**Platform:** `samsung_microwave_otr`  
**Template:** `microwave`  
**Status:** Complete — §4 alignment, §5 troubleshooting, information codes, PCB/wiring diagrams  
**Knowledge:** `measurement-knowledge-batch45.json` (ME11 microwave entries + shared M9 dishwasher batch) + generic microwave batch2/4

---

## 1. Model routing

| Pattern | Example models | Notes |
|---------|----------------|-------|
| `/ME11/i` | ME11A7510DSAA, ME11CB7510AA | Primary manual family |
| `/ME21/i` | ME21A706BQN | Same OTR platform — ME21 PDF has bad font encoding; use ME11 manual for procedures |
| `/ME21K/i` | ME21K* variants | Same platform |
| `/ME21A/i` | ME21A706BQN | Same platform |

Make: **Samsung** only. Distinct from `lg_microwave_otr` (LMHM/LMVM).

---

## 2. Information codes (§5-2, §5-3)

| Code | Meaning | Primary procedure |
|------|---------|-------------------|
| **C-10** | Gas/humidity sensor fault | Humidity sensor (§4-14 quick test + flowchart §5-3-1) |
| **C-20** | Temp sensor error | Temp sensor — short = black wire |
| **C-21** | Abnormal temp in microcooking | Cool down; retest — no dedicated Ω |
| **C-F0** | PCB / display communication | PCB comm (main ↔ sub CN370/CN01) |
| **C-F1** | PBA defect | Replace main PBA |
| **C-F2** | Touch defect | Keypad / touch film |
| **C-d0** | Key short | Keypad / membrane |

**Sensor quick test (§4-14):** Standby (clock) — hold **Auto Defrost** + **Popcorn** together → display shows diagnostic number: **15–185** normal; **≥213** open/unplugged/wiring; **<6** shorted.

---

## 3. Alignment measurements (§4)

| Component | Spec | Reference |
|-----------|------|-----------|
| HV transformer primary | **0.410–0.475 Ω** (SHV-U1870E) or **0.440–0.480 Ω** (SHV-U1850C) @ 20°C | §4-1 |
| HV transformer secondary | **~123.5 Ω ±2%** or **~131.0 Ω ±2%** | §4-1 |
| HV transformer filament | Continuity | §4-1 |
| Magnetron filament | **≤1 Ω**; filament-to-case **open** | §4-2 |
| HV capacitor | Charge then **~9 MΩ** terminal-to-terminal; infinite terminal-to-chassis | §4-3 |
| HV diode | **∞** one direction; **several hundred kΩ** other (9V+ meter) | §4-4 |
| Vent blower (via run cap leads) | **~94 Ω** across both cap wires | §4-7 |
| Humidity sensor heater (H terminals only) | **~30 Ω** (Black/Red — **do not** ohm White/Orange) | §4-14 |
| Interlock switches | See §4-6 table (Primary, Monitor COM-NC/NO, Door sensing) | §4-6 |
| Magnetron TCO | Closed normally; opens **302°F (150°C)**, resets **140°F (60°C)** | §4-8-5 |
| Cavity/flame TCO | **248°F (120°C)** non-resettable | §4-8-1 |
| Hood TCO | Normally **open** at room temp; closes **158°F (70°C)** | §4-8-3 |
| Bottom TCO | Opens **248°F (120°C)** — non-resettable | §4-8-4 |

**Deferred:** Turntable drive motor — no Ω spec in manual (operational / harness only).

---

## 4. Complaint routing (§5-1)

| Symptom | Route |
|---------|-------|
| Dead (no display) | Line power → magnetron TCO → interlock/monitor → PCB |
| No heat, lamp/fan run | Door interlock → magnetron TCO → HV components |
| Close Door message | Secondary interlock / latch adjustment |
| Touch dead | C-F2 / C-d0 → touch film FPC |
| Vent only on plug-in | Door sensing switch wiring |
| Turntable no rotate | Harness → motor → PCB RY206 |

---

## 5. Diagram pages (crop targets)

| Page | Content |
|------|---------|
| 12 | HV transformer / capacitor access (disassembly) |
| 16 | Door assembly disassembly |
| 24 | Interlock switch adjustment diagram + continuity table |
| 38 | Sub module PCB layout |
| 39 | Sub module connector pinouts |
| 40 | Main PBA layout |
| 41 | Main PBA connector pinouts (CN250 gas sensor, CN200 door/TCO) |
| 42–46 | Wiring diagrams (5 sheets) |

---

## 6. Procedure index (generated)

| ID | OEM section | Tags |
|----|-------------|------|
| `samsungotrmw-door-interlock` | §4-6 | door_switch_check, safety_switch, no_heat |
| `samsungotrmw-line-power` | §5-1 dead | no_power, fuse_check |
| `samsungotrmw-no-heat` | §5-1 no oscillation | no_heat, magnetron_check |
| `samsungotrmw-hv-transformer` | §4-1 | no_heat, high_voltage_safety |
| `samsungotrmw-hv-capacitor` | §4-3 | no_heat, hv_capacitor_check |
| `samsungotrmw-hv-diode` | §4-4 | no_heat, hv_diode_check |
| `samsungotrmw-magnetron` | §4-2 | no_heat, magnetron_check |
| `samsungotrmw-vent-motor` | §4-7 | motor_check, vent_issue |
| `samsungotrmw-humidity-sensor` | §4-14, C-10 | C-10, sensor_check |
| `samsungotrmw-temp-sensor` | C-20 | C-20, thermistor_check |
| `samsungotrmw-keypad-touch` | C-F2, C-d0 | C-F2, C-d0, hmi_check, touch_issue |
| `samsungotrmw-pcb-comm` | C-F0, C-F1 | C-F0, C-F1, hmi_check |
| `samsungotrmw-thermal-cutout` | §4-8 | no_heat, thermal_cutout |
| `samsungotrmw-turntable` | §3-7 | motor_check |

**Bundle:** `samsungotrmw-sensor-quick-test` (Auto Defrost + Popcorn hold — §4-14)

**Pipeline:**

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual SAMSUNG-ME11-MICROWAVE
```

**Smoke model:** ME11A7510DSAA + Samsung → `samsung_microwave_otr`; C-F2 → `samsungotrmw-keypad-touch`.
