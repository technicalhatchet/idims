# Samsung NE58F9710WS Flex Duo electric range — extraction

**Source:** `backend/docs/manuals/SamsunNE58F electric range.pdf` (58 pp — FER710DRS / NE58F9710WS)  
**Extracted text:** `backend/docs/manuals/samsung ne58f9710ws-extracted.txt`  
**Scope:** NE58F9710WS*, NE58F9500SS*, FER710DRS — electric convection Flex Duo  
**Platform:** `samsung_range_ne58` (`electric_range` only — **not** NX60 gas family)  
**Manual ID:** `SAMSUNG-NE58-RANGE`  
**Status:** CG-10 R4 manufacturer-boundary ingest — PDF extracted via `extract_pdf.py`  
**Knowledge:** reuses batch32 `samsungNx60OvenSensorOhms` (1080 Ω RTD); generic `bakeElementOhms` / `broilElementOhms`

---

## Model routing

| Pattern | Example | Template |
|---------|---------|----------|
| NE58F9710* | NE58F9710WS/AA | `electric_range` |
| NE58F9500* | NE58F9500SS/AA | `electric_range` |
| FER710* | FER710DRS | `electric_range` |

Make: **Samsung** only. **Exclude** NX60*/NE63* (gas-primary `samsung_range_nx60` platform).

---

## Failure codes (§4-1)

| Code | Meaning | Procedure |
|------|---------|-----------|
| **E-21** | Oven sensor open | `samsungne58-oven-sensor` |
| **E-22** | Oven sensor short | `samsungne58-oven-sensor` |
| **E-24** | Safety / heater relay | `samsungne58-heater-relays` |
| **E-0E** | Door lock | `samsungne58-door-lock` |
| **-SE-** | Key short | `samsungne58-hmi-touch` |
| **-tE-** | Touch comm | `samsungne58-hmi-touch` |
| **E-83** | Main ↔ sub comm | `samsungne58-power` |

---

## Component resistance / voltage specs (§4-2)

| Component | Spec | Test style | Knowledge ID |
|-----------|------|------------|--------------|
| Oven sensor | **~1080 Ω** @ room temp | Resistance + E-21/E-22 | `samsungNx60OvenSensorOhms` |
| Bake element | Harness Ω + **240 VAC** when bake keyed | Separate bake test | `bakeElementOhms` |
| Broil element | Harness Ω + **240 VAC** when broil keyed | Separate broil test | `broilElementOhms` |
| Convection element | Harness Ω + **240 VAC** convection bake | Separate convection test | `bakeElementOhms` |
| Convection fan motor | Motor Ω + **120 VAC** when cycling | Fan motor terminals | `samsungNx60ConvectionFanOhms` |
| Door lock motor | Coil + micro COM-NO + 120 V | Lock command test | `samsungNx60DoorLockMotorOhms` |
| Door plunger switch | NC continuity | Switch state | — |
| Thermostat (thermal fuse) | **0 Ω** normal | Both thermostat terminals | — |
| Heater relays (DLB/bake/broil/convection) | Open at rest | Sub PCB relay contacts | `samsungNx60HeaterRelayContactsOhms` |
| Supply | **240 VAC** terminal block | Power path | `supplyVoltage240` |

**Platform vocabulary (not canonical):** Main PCB, Sub PCB, TE400, TE201, DLB relay, Ry08 convection relay, radiant surface elements, infinite-switch knobs.

---

## Procedure index

| ID | OEM | Tags / codes |
|----|-----|--------------|
| `samsungne58-power` | §4-2 power | no_power, E-83 |
| `samsungne58-hmi-touch` | §4-1 | **-SE-**, **-tE-**, hmi_check |
| `samsungne58-oven-sensor` | §4-2 | **E-21**, **E-22**, sensor_check |
| `samsungne58-bake-element` | §4-2 p.44 | no_bake_heat_issue |
| `samsungne58-broil-element` | §4-2 p.44 | no_broil_heat_issue |
| `samsungne58-convection-element` | §4-2 p.44 | convection_issue |
| `samsungne58-convection-fan` | §4-2 p.41/45 | convection_issue |
| `samsungne58-heater-relays` | §4-1 E-24 | relay_check, E-24 |
| `samsungne58-door-lock` | §4-2 p.45 | **E-0E**, door_latch_check |
| `samsungne58-door-switch` | §4-2 p.46 | door_switch_check |
| `samsungne58-thermal-cutoff` | §4-2 p.39 | overheat, E-08 |
| `samsungne58-surface-radiant` | §3-5 + symptom | surface_burner |

---

## CG-10 R4 role

**Not** part of R1–R3 discovery corpus. Validates post-R3 functional hypothesis against a **third manufacturer** (Samsung electric) before human freeze gate.

**Smoke:** Samsung + NE58F9710WS → `samsung_range_ne58`; bake element → `samsungne58-bake-element`.

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual SAMSUNG-NE58-RANGE
python backend/scripts/run_samsung_ne58_range_er_cg10x_observation.py
```
