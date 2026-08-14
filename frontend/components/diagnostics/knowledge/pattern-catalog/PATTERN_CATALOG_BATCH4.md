# Batch 4 — Multi-signal pattern catalog

**Status: IMPLEMENTED** (gas range + electric range)

Inventories: [INVENTORY_GAS_RANGE.md](./INVENTORY_GAS_RANGE.md), [INVENTORY_ELECTRIC_RANGE.md](./INVENTORY_ELECTRIC_RANGE.md)

## Gas range — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| GR-MS-001 | `no_ignition` + bake ignition bad | `gr_ms_001_no_ignition_bake_bad` | `igniter` confirm |
| GR-MS-002 | `no_oven_heat` + bake ignition bad | `gr_ms_002_no_oven_heat_bake_bad` | `igniter` confirm |
| GR-MS-003 | `no_ignition` + igniter OL | `gr_ms_003_no_ignition_igniter_ol` | `igniter` confirm |
| GR-MS-004 | `no_oven_heat` + igniter OL | `gr_ms_004_no_oven_heat_igniter_ol` | `igniter` confirm |
| GR-MS-005 | `no_ignition` + gas valve OL | `gr_ms_005_no_ignition_gas_valve_ol` | `gas_valve` confirm |
| GR-MS-006 | bake bad + igniter OL | `gr_ms_006_bake_bad_igniter_ol` | `igniter` confirm |
| GR-MS-007 | bake bad + flame sensor open | `gr_ms_007_bake_bad_flame_sensor_open` | `flame_sensor` confirm |
| GR-MS-008 | `surface_burners` + surface ignition bad | `gr_ms_008_surface_burners_surface_bad` | `surface_ignition` confirm |
| GR-MS-009 | `weak_flame` + oven flame bad | `gr_ms_009_weak_flame_oven_flame_bad` | `gas_valve` confirm |
| GR-MS-010 | `no_ignition` + low igniter amps | `gr_ms_010_no_ignition_igniter_low_amps` | `igniter` confirm |
| GR-MS-011 | `no_oven_heat` + supply critical | `gr_ms_011_no_oven_heat_supply_critical` | `supply` confirm |
| GR-MS-012 | `no_ignition` + flame sensor open | `gr_ms_012_no_ignition_flame_sensor_open` | `flame_sensor` confirm |
| GR-MS-013 | `surface_burners` + surface flame bad | `gr_ms_013_surface_burners_surface_flame_bad` | `surface_ignition` confirm |
| GR-MS-014 | broil bad + igniter OL | `gr_ms_014_broil_bad_igniter_ol` | `igniter` confirm |

**Totals:** 48 rules, 14 multi-signal (was 34 / 0).

## Electric range — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| ER-MS-001 | `no_bake` + bake operation bad | `er_ms_001_no_bake_bake_bad` | `bake_element` confirm |
| ER-MS-002 | `no_bake` + bake element OL | `er_ms_002_no_bake_bake_element_ol` | `bake_element` confirm |
| ER-MS-003 | `no_broil` + broil operation bad | `er_ms_003_no_broil_broil_bad` | `broil_element` confirm |
| ER-MS-004 | `no_broil` + broil element OL | `er_ms_004_no_broil_broil_element_ol` | `broil_element` confirm |
| ER-MS-005 | `uneven_heat` + temp sensor bad | `er_ms_005_uneven_heat_temp_sensor_bad` | `temp_sensor` confirm |
| ER-MS-006 | `no_power` + L1–L2 critical | `er_ms_006_no_power_l1_l2_critical` | `supply` confirm |
| ER-MS-007 | `no_power` + neutral–ground bad | `er_ms_007_no_power_neutral_ground_bad` | `supply` confirm |
| ER-MS-008 | bake bad + bake element OL | `er_ms_008_bake_bad_bake_element_ol` | `bake_element` confirm |
| ER-MS-009 | broil bad + broil element OL | `er_ms_009_broil_bad_broil_element_ol` | `broil_element` confirm |
| ER-MS-010 | `no_bake` + temp sensor bad | `er_ms_010_no_bake_temp_sensor_bad` | `temp_sensor` confirm |
| ER-MS-011 | `uneven_heat` + convection bad | `er_ms_011_uneven_heat_convection_bad` | `convection_fan` confirm |
| ER-MS-012 | `no_bake` + L1–L2 critical | `er_ms_012_no_bake_l1_l2_critical` | `supply` confirm |
| ER-MS-013 | bake bad + low element amps | `er_ms_013_bake_bad_low_element_amps` | `bake_element` confirm |
| ER-MS-014 | `self_clean` + door lock bad | `er_ms_014_self_clean_door_lock_bad` | `electrical_supply` +25 |

**Totals:** 55 rules, 14 multi-signal (was 41 / 0).

## Next: Batch 5 — microwave
