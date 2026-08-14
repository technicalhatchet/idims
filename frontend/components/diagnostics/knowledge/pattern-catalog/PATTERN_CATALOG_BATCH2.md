# Batch 2 — Multi-signal pattern catalog

**Status: IMPLEMENTED** (gas dryer + electric dryer)

Inventories: [INVENTORY_GAS_DRYER.md](./INVENTORY_GAS_DRYER.md), [INVENTORY_ELECTRIC_DRYER.md](./INVENTORY_ELECTRIC_DRYER.md)

## Gas dryer — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| GD-MS-001 | `no_heat` + ignition no | `gd_ms_001_no_heat_ignition_no` | `igniter` confirm |
| GD-MS-002 | `no_heat` + igniter OL | `gd_ms_002_no_heat_igniter_ol` | `igniter` confirm |
| GD-MS-003 | `no_heat` + thermal fuse open | `gd_ms_003_no_heat_thermal_fuse_open` | `thermal_fuse` confirm |
| GD-MS-004 | `no_heat` + gas valve OL | `gd_ms_004_no_heat_gas_valve_ol` | `gas_valve` confirm |
| GD-MS-005 | `not_drying` + airflow bad | `gd_ms_005_not_drying_airflow_bad` | `vent` confirm |
| GD-MS-006 | `not_drying` + airflow + lint bad | `gd_ms_006_not_drying_airflow_lint_bad` | `airflow` +28 |
| GD-MS-007 | `weak_flame` + flame quality bad | `gd_ms_007_weak_flame_flame_bad` | `gas_valve` confirm |
| GD-MS-008 | `weak_flame` + airflow bad | `gd_ms_008_weak_flame_airflow_bad` | `vent` confirm |
| GD-MS-009 | `no_spin` + drum not turning | `gd_ms_009_no_spin_drum_no` | `motor` confirm |
| GD-MS-010 | ignition no + igniter OL | `gd_ms_010_ignition_no_igniter_ol` | `igniter` confirm |
| GD-MS-011 | flame bad + gas valve OL | `gd_ms_011_flame_bad_gas_valve_ol` | `gas_valve` confirm |
| GD-MS-012 | `not_drying` + vent condition bad | `gd_ms_012_not_drying_vent_bad` | `vent` confirm |
| GD-MS-013 | `no_heat` + supply voltage critical | `gd_ms_013_no_heat_supply_critical` | `supply` confirm |
| GD-MS-014 | `no_heat` + ignition no + low igniter amps | `gd_ms_014_no_heat_ignition_no_igniter_low_amps` | `igniter` confirm |

**Totals:** 50 rules, 14 multi-signal (was 36 / 0).

## Electric dryer — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| ED-MS-001 | `no_heat` + heating no | `ed_ms_001_no_heat_heating_no` | `heating_element` confirm |
| ED-MS-002 | `no_heat` + element OL | `ed_ms_002_no_heat_heater_ol` | `heating_element` confirm |
| ED-MS-003 | `no_heat` + thermal fuse open | `ed_ms_003_no_heat_thermal_fuse_open` | `thermal_fuse` confirm |
| ED-MS-004 | `not_drying` + airflow bad | `ed_ms_004_not_drying_airflow_bad` | `vent` confirm |
| ED-MS-005 | `not_drying` + airflow + lint bad | `ed_ms_005_not_drying_airflow_lint_bad` | `airflow` +28 |
| ED-MS-006 | `no_spin` + drum not turning | `ed_ms_006_no_spin_drum_no` | `motor` confirm |
| ED-MS-007 | heating no + element OL | `ed_ms_007_heating_no_heater_ol` | `heating_element` confirm |
| ED-MS-008 | `not_drying` + heating no | `ed_ms_008_not_drying_heating_no` | `heat_circuit` +25 |
| ED-MS-009 | `no_heat` + 240 V supply critical | `ed_ms_009_no_heat_supply_critical` | `supply` confirm |
| ED-MS-010 | `no_power` + supply critical | `ed_ms_010_no_power_supply_critical` | `supply` confirm |
| ED-MS-011 | `no_heat` + cycling stat open | `ed_ms_011_no_heat_cycling_stat_open` | `cycling_thermostat` confirm |
| ED-MS-012 | `not_drying` + vent condition bad | `ed_ms_012_not_drying_vent_bad` | `vent` confirm |
| ED-MS-013 | lint bad + thermal fuse open | `ed_ms_013_lint_bad_thermal_fuse_open` | `thermal_fuse` confirm |
| ED-MS-014 | `no_heat` + heating no + fuse open | `ed_ms_014_no_heat_heating_no_thermal_fuse` | `thermal_fuse` confirm |

**Totals:** 55 rules, 14 multi-signal (was 41 / 0).

## Next: Batch 3 — washer + dishwasher
