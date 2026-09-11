# Samsung NX60T8311S / NE63 slide-in range — extraction

**Source:** `backend/docs/manuals/samsung range nx60t8311s.pdf`  
**Extracted text:** `backend/docs/manuals/samsung range nx60t8311s-extracted.txt`  
**Scope:** Slide-in self-cleaning gas range NX60T8311S*; electric NE63* family shares platform  
**Platform:** `samsung_range_nx60` (`gas_range` + `electric_range` registry rules)  
**Status:** Complete — §4-1 error codes + §4-2/3/4 component resistance checks  
**Knowledge:** batch32 (`samsungNx60*` IDs)

---

## 1. Model routing

| Pattern | Example models | Template |
|---------|----------------|----------|
| NX60* | NX60T8311SS/AA | `gas_range` |
| NE63* | NE63T8511SS/AA (electric variant) | `electric_range` |

Make: **Samsung** only.

---

## 2. Service modes (§4-1, hidden key table p.58)

| Mode | Entry (8311 UI) |
|------|-----------------|
| **Error history** | Clock → 1,2,3,4 (Timer OFF) → Start/Set → hold **Clock + 1** 3 s → press **0** for latest 5 codes |
| **ErrorHistory (alt)** | Timer + ∧ 3 s → Clock + Num1 |
| **Sub-Line-Test** | Keep Warm + Num4, **0.6 s** |
| **Wire-Test** | Keep Warm + Num6, **0.6 s** |
| **AD-Display** | Cooking Time + ∧, **5 s** |
| **Child lock** | Lock 3 s |
| **Sabbath** | Bake + Num1, 3 s |

---

## 3. Failure display codes (§4-1)

| Code | Meaning | Procedure |
|------|---------|-----------|
| **C-20** | Oven sensor open (>2950 Ω) or short (<930 Ω) | `samsungnx60-oven-sensor` |
| **C-21** | Oven heating over — sensor, heaters, DLB/bake/broil relays | `samsungnx60-oven-sensor`, `samsungnx60-heater-relays` |
| **C-d1** | Door lock malfunction | `samsungnx60-door-lock` |
| **C-F2** | Sub ↔ touch communication | `samsungnx60-touch-comm` |
| **C-A2** | Display PCB ambient over-temp — cooling fan | `samsungnx60-cooling-fan` |
| **C-24** | Oven vent blocked | `samsungnx60-oven-vent` |

---

## 4. Component resistance / current specs

| Component | Spec | Test point | Knowledge ID |
|-----------|------|------------|--------------|
| Oven sensor | **1080 Ω** @ room temp (open >2950, short <930) | CN100 pins 11–13 | `samsungNx60OvenSensorOhms` |
| Bake/broil HSI | **40–400 Ω** | HSI terminals | `samsungNx60OvenIgnitorOhms` |
| Safety valve current | **3.3–3.6 A** | Safety valve terminal | `samsungNx60GasSafetyValveAmps` |
| Door lock motor | **1750–1950 Ω** | Lock motor coil | `samsungNx60DoorLockMotorOhms` |
| Convection fan | **25–30 Ω** | Fan motor terminals | `samsungNx60ConvectionFanOhms` |
| DLB/bake/broil relays | **∞ Ω** (contacts open at rest) | TB200–TB205 | `samsungNx60HeaterRelayContactsOhms` |
| Oven lamp socket | **∞ Ω** (bulb removed) | Socket terminals | `samsungNx60OvenLampSocketOhms` |
| Supply | **120 VAC** | Plug, CNP100 5–7 | `supplyVoltage120` |

Relay terminals: DLB TB200–TB201; Broil TB202–TB203; Bake TB204–TB205.

Gas oven ignition voltage: Bake T504–T505, Broil T504–T503; valve TB201–TB204 / TB201–CN202.

---

## 5. Procedure index (generated)

| ID | OEM | templateIds | Tags / codes |
|----|-----|-------------|--------------|
| `samsungnx60-power` | §4-2 | both | no_power, display_dead |
| `samsungnx60-oven-sensor` | §4-1 | both | **C-20**, **C-21**, sensor_check |
| `samsungnx60-heater-relays` | §4-1 | both | **C-21**, relay_check |
| `samsungnx60-door-lock` | §4-1 | both | **C-d1** |
| `samsungnx60-touch-comm` | §4-1 | both | **C-F2**, hmi_check |
| `samsungnx60-cooling-fan` | §4-1 | both | **C-A2** |
| `samsungnx60-oven-vent` | §4-1 | both | **C-24** |
| `samsungnx60-bake-ignitor` | §4-4 | gas | igniter_check |
| `samsungnx60-broil-ignitor` | §4-4 | gas | igniter_check |
| `samsungnx60-safety-valve` | §4-4 | gas | gas_valve_check |
| `samsungnx60-convection-fan` | §4-3 | both | convection_issue |
| `samsungnx60-oven-lamp` | §4-3 | both | light_check |
| `samsungnx60-hmi-touch` | §4-2 | both | hmi_check |
| `samsungnx60-spark-module` | §4-3 | gas | surface_burner |
| `samsungnx60-bake-element` | §4-4 | electric | no_bake_heat_issue |
| `samsungnx60-broil-element` | §4-4 | electric | no_broil_heat_issue |

**Bundles:** `samsungnx60-error-recall-entry`, `samsungnx60-sub-line-test-entry`

---

## 6. Pipeline

```bash
python backend/scripts/generate_samsung_nx60_range_procedure_seeds.py
cd frontend && npx tsc --noEmit
```

WO smoke: NX60T8311SS + Samsung → `samsung_range_nx60`; C-20 → `samsungnx60-oven-sensor`.

---

## 7. Deferred v1

- PCB diagram crops (Main PCB / Display pinouts)
- Wi-Fi SmartThings diagnostics (§4-4 p.88)
- Cooktop single-burner flowchart (orifice table only in symptom tables)
