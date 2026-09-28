# Samsung DV22N heat-pump dryer — extraction

**Source:** `backend/docs/manuals/samsung heat pump dryer dv22n8650.pdf`  
**Extracted text:** `backend/docs/manuals/samsung heat pump dryer dv22n8650-extracted.txt`  
**Scope:** DV22N6850* / DV22N6800* (DV6800N / DV6850N project)  
**Platform:** `samsung_hp_dryer_dv22n` · `templateId`: `electric_dryer`  
**Manual ID:** `SAMSUNG-HP-DRYER-DV22N`  
**Frozen ontology:** `heat_pump_dryer` (composition/reference — not rediscovery)  
**Fit context:** `CG_HPD_DV22N8650_FIT_OBSERVATION_v1.json`, `CG_HEAT_PUMP_DRYER_FREEZE_LOCK_v1.json`

---

## Pilot role (P07)

Prove frozen `heat_pump_dryer` is consumed as reference/composition during production normalization — `heat_pump_thermal_system` + `sealed_moisture_rejection_path` with `vented_dryer` reuse, not duplicate canonical nodes.

---

## Diagnostic codes (§4-1)

| Code | Domain | HP vs vented reuse |
|------|--------|-------------------|
| **dC** | Door | vented_dryer reuse |
| **3C** | Drum BLDC inverter | shared_function |
| **3CA / HC** | Compressor inverter / overheat | heat_pump_thermal_system |
| **tC / tC5 / tC7 / tC8 / tCA** | Refrigerant thermistors | heat_pump_thermal_system |
| **5C** | Condensate overflow / drain | sealed_moisture_rejection_path |
| **9C1 / 9C2** | Supply voltage | shared_function |
| **AC / AC6** | PBA communication | shared_function |
| **bC2** | Button stuck | hmi_check |

---

## Component tests (§4-5)

| Part | Spec |
|------|------|
| Thermistor | 50 kΩ @ 25 °C |
| Float switch | up 0–200 mΩ / down OL |
| Pump motor | 770 Ω |
| Condenser cap | 15 µF |

---

## Procedure index

| ID | OEM | Tags |
|----|-----|------|
| `samsungdv22n-door-switch` | dC | door_switch_check |
| `samsungdv22n-drum-motor` | 3C | motor_check |
| `samsungdv22n-compressor-inverter` | 3CA, HC | no_heat |
| `samsungdv22n-refrigerant-thermistors` | tC family | no_heat |
| `samsungdv22n-condensate-overflow` | 5C | long_dry |
| `samsungdv22n-drain-pump-float` | §4-5 float/pump | drain_issue |
| `samsungdv22n-power-supply` | 9C1, 9C2 | no_power |
| `samsungdv22n-pba-communication` | AC, AC6 | hmi_check |
| `samsungdv22n-hmi-button` | bC2 | hmi_check |
| `samsungdv22n-lint-filter` | tC filter path | long_dry |
