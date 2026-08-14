# Batch 3 — Multi-signal pattern catalog

**Status: IMPLEMENTED** (washer + dishwasher)

Inventories: [INVENTORY_WASHER.md](./INVENTORY_WASHER.md), [INVENTORY_DISHWASHER.md](./INVENTORY_DISHWASHER.md)

## Washer — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| W-MS-001 | `wont_drain` + drain bad | `w_ms_001_wont_drain_drain_bad` | `drain_pump` confirm |
| W-MS-002 | `wont_drain` + pump OL | `w_ms_002_wont_drain_pump_ol` | `drain_pump` confirm |
| W-MS-003 | `no_fill` + fill bad | `w_ms_003_no_fill_fill_bad` | `inlet_valve` confirm |
| W-MS-004 | `no_fill` + valve OL | `w_ms_004_no_fill_valve_ol` | `inlet_valve` confirm |
| W-MS-005 | `wont_spin` + spin bad | `w_ms_005_wont_spin_spin_bad` | `drive_motor` confirm |
| W-MS-006 | `wont_spin` + motor OL | `w_ms_006_wont_spin_motor_ol` | `drive_motor` confirm |
| W-MS-007 | `wont_agitate` + agitate bad | `w_ms_007_wont_agitate_agitate_bad` | `drive_motor` confirm |
| W-MS-008 | `lid_lock` + lock bad | `w_ms_008_lid_lock_lock_bad` | `door_lock` confirm |
| W-MS-009 | `lid_lock` + lock switch open | `w_ms_009_lid_lock_switch_open` | `door_lock` confirm |
| W-MS-010 | drain bad + pump OL | `w_ms_010_drain_bad_pump_ol` | `drain_pump` confirm |
| W-MS-011 | `leaking` + hoses bad | `w_ms_011_leaking_hoses_bad` | `fill_supply` +28 |
| W-MS-012 | `vibration` + balance bad | `w_ms_012_vibration_balance_bad` | `drive_motor` +22 |
| W-MS-013 | `wont_drain` + pump low amps | `w_ms_013_wont_drain_pump_low_amps` | `drain_pump` confirm |
| W-MS-014 | `leaking` + door boot bad | `w_ms_014_leaking_door_boot_bad` | `door_lock` +25 |

**Totals:** 52 rules, 14 multi-signal (was 38 / 0).

## Dishwasher — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| DW-MS-001 | `wont_drain` + drain bad | `dw_ms_001_wont_drain_drain_bad` | `drain_pump` confirm |
| DW-MS-002 | `wont_drain` + pump OL | `dw_ms_002_wont_drain_pump_ol` | `drain_pump` confirm |
| DW-MS-003 | `no_fill` + fill bad | `dw_ms_003_no_fill_fill_bad` | `inlet_valve` confirm |
| DW-MS-004 | `no_fill` + valve OL | `dw_ms_004_no_fill_valve_ol` | `inlet_valve` confirm |
| DW-MS-005 | `not_cleaning` + wash bad | `dw_ms_005_not_cleaning_wash_bad` | `circulation_pump` confirm |
| DW-MS-006 | `not_cleaning` + circ pump OL | `dw_ms_006_not_cleaning_circ_pump_ol` | `circulation_pump` confirm |
| DW-MS-007 | `no_heat_dry` + dry bad | `dw_ms_007_no_heat_dry_dry_bad` | `heater` confirm |
| DW-MS-008 | `no_heat_dry` + heater OL | `dw_ms_008_no_heat_dry_heater_ol` | `heater` confirm |
| DW-MS-009 | `leaking` + gasket bad | `dw_ms_009_leaking_gasket_bad` | `door_gasket` confirm |
| DW-MS-010 | `leaking` + leak present | `dw_ms_010_leaking_leak_present` | `door_seal` +25 |
| DW-MS-011 | `not_cleaning` + spray arms blocked | `dw_ms_011_not_cleaning_spray_blocked` | `wash_circuit` +28 |
| DW-MS-012 | `no_heat_dry` + low incoming water | `dw_ms_012_no_heat_dry_low_incoming_water` | `heat_dry` +25 |
| DW-MS-013 | `wont_start` + supply critical | `dw_ms_013_wont_start_supply_critical` | `supply` confirm |
| DW-MS-014 | dry bad + heater OL | `dw_ms_014_dry_bad_heater_ol` | `heater` confirm |

**Totals:** 58 rules, 14 multi-signal (was 44 / 0).

## Next: Batch 4 — gas range + electric range
