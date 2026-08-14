# Batch 6 — Multi-signal pattern catalog

**Status: IMPLEMENTED** (stacked laundry + AIO laundry)

Inventories: [INVENTORY_STACKED_LAUNDRY.md](./INVENTORY_STACKED_LAUNDRY.md), [INVENTORY_AIO_LAUNDRY.md](./INVENTORY_AIO_LAUNDRY.md)

## Stacked laundry — 14 patterns (washer + dryer subsystems)

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| SL-MS-001 | `washer_drain` + drain bad | `sl_ms_001_washer_drain_drain_bad` | `washer_drain_pump` confirm |
| SL-MS-002 | `washer_drain` + pump OL | `sl_ms_002_washer_drain_pump_ol` | `washer_drain_pump` confirm |
| SL-MS-003 | `washer_spin` + spin bad | `sl_ms_003_washer_spin_spin_bad` | `washer_motor` confirm |
| SL-MS-004 | `washer_spin` + motor OL | `sl_ms_004_washer_spin_motor_ol` | `washer_motor` confirm |
| SL-MS-005 | drain bad + pump OL | `sl_ms_005_drain_bad_pump_ol` | `washer_drain_pump` confirm |
| SL-MS-006 | `dryer_no_heat` + heat no | `sl_ms_006_dryer_no_heat_heat_no` | `dryer_heat` confirm |
| SL-MS-007 | `dryer_no_heat` + fuse open | `sl_ms_007_dryer_no_heat_fuse_open` | `dryer_thermal_fuse` confirm |
| SL-MS-008 | `dryer_no_tumble` + drum no | `sl_ms_008_dryer_no_tumble_drum_no` | `dryer_motor` confirm |
| SL-MS-009 | `dryer_no_tumble` + motor OL | `sl_ms_009_dryer_no_tumble_motor_ol` | `dryer_motor` confirm |
| SL-MS-010 | `dryer_not_drying` + airflow bad | `sl_ms_010_dryer_not_drying_airflow_bad` | `dryer_vent` confirm |
| SL-MS-011 | `dryer_not_drying` + heat no | `sl_ms_011_dryer_not_drying_heat_no` | `dryer_heat` confirm |
| SL-MS-012 | `no_power` + supply critical | `sl_ms_012_no_power_supply_critical` | `supply` confirm |
| SL-MS-013 | heat no + fuse open | `sl_ms_013_heat_no_fuse_open` | `dryer_thermal_fuse` confirm |
| SL-MS-014 | spin bad + motor OL | `sl_ms_014_spin_bad_motor_ol` | `washer_motor` confirm |

**Totals:** 59 rules, 14 multi-signal (was 45 / 0).

## AIO laundry — 14 patterns (wash + heat-pump dry subsystems)

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| AL-MS-001 | `washer_drain` + drain bad | `al_ms_001_washer_drain_drain_bad` | `washer_drain_pump` confirm |
| AL-MS-002 | `washer_drain` + pump OL | `al_ms_002_washer_drain_pump_ol` | `washer_drain_pump` confirm |
| AL-MS-003 | `washer_spin` + spin bad | `al_ms_003_washer_spin_spin_bad` | `washer_motor` confirm |
| AL-MS-004 | `washer_spin` + motor OL | `al_ms_004_washer_spin_motor_ol` | `washer_motor` confirm |
| AL-MS-005 | drain bad + pump OL | `al_ms_005_drain_bad_pump_ol` | `washer_drain_pump` confirm |
| AL-MS-006 | `heat_pump_dry` + airflow bad | `al_ms_006_heat_pump_dry_airflow_bad` | `filter_airflow` confirm |
| AL-MS-007 | `heat_pump_dry` + heat no | `al_ms_007_heat_pump_dry_heat_no` | `compressor` confirm |
| AL-MS-008 | `dryer_no_heat` + compressor low amps | `al_ms_008_dryer_no_heat_compressor_low` | `compressor` confirm |
| AL-MS-009 | `compressor` + winding OL | `al_ms_009_compressor_chip_winding_ol` | `compressor` confirm |
| AL-MS-010 | `condensate` + condensate drain bad | `al_ms_010_condensate_drain_bad` | `condensate` confirm |
| AL-MS-011 | `condensate` + pump OL | `al_ms_011_condensate_pump_ol` | `condensate` confirm |
| AL-MS-012 | `heat_pump_dry` + fan low amps | `al_ms_012_heat_pump_dry_fan_low` | `heat_pump_fan` confirm |
| AL-MS-013 | `compressor` + low amps | `al_ms_013_compressor_chip_low_amps` | `sealed_system` confirm |
| AL-MS-014 | `no_power` + supply critical | `al_ms_014_no_power_supply_critical` | `supply` confirm |

**Totals:** 67 rules, 14 multi-signal (was 53 / 0).

## All 11 templates complete

Next: **Final** — UI validation (2–3 scripted scenarios per appliance; verify ledger, scores, no double-counting).
