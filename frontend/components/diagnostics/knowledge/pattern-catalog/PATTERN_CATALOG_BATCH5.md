# Batch 5 — Multi-signal pattern catalog

**Status: IMPLEMENTED** (microwave)

Inventory: [INVENTORY_MICROWAVE.md](./INVENTORY_MICROWAVE.md)

## Microwave — 14 patterns

| ID | Pattern | JSON rule ID | Target |
|----|---------|--------------|--------|
| MW-MS-001 | `no_heat` + heats properly no | `mw_ms_001_no_heat_functional_magnetron` | `magnetron` confirm |
| MW-MS-002 | `no_heat` + magnetron OL | `mw_ms_002_no_heat_magnetron_ol` | `magnetron` confirm |
| MW-MS-003 | `no_heat` + HV capacitor bad | `mw_ms_003_no_heat_capacitor_bad` | `hv_capacitor` confirm |
| MW-MS-004 | `no_heat` + door switch open | `mw_ms_004_no_heat_door_switch_open` | `door_interlock` confirm |
| MW-MS-005 | `no_power` + powers on no | `mw_ms_005_no_power_functional_fuse` | `line_fuse` confirm |
| MW-MS-006 | `no_power` + line fuse open | `mw_ms_006_no_power_fuse_open` | `line_fuse` confirm |
| MW-MS-007 | `no_power` + thermal cutout open | `mw_ms_007_no_power_thermal_cutout` | `thermal_cutout` confirm |
| MW-MS-008 | `no_power` + door switch open | `mw_ms_008_no_power_door_switch_open` | `door_interlock` confirm |
| MW-MS-009 | `door_issue` + door switch open | `mw_ms_009_door_issue_switch_open` | `door_interlock` confirm |
| MW-MS-010 | `door_issue` + latch bad | `mw_ms_010_door_issue_latch_bad` | `door_interlock` confirm |
| MW-MS-011 | `sparking` + magnetron OL | `mw_ms_011_sparking_magnetron_ol` | `magnetron` confirm |
| MW-MS-012 | `sparking` + HV capacitor bad | `mw_ms_012_sparking_capacitor_bad` | `hv_capacitor` confirm |
| MW-MS-013 | `no_heat` + supply critical | `mw_ms_013_no_heat_supply_critical` | `supply` confirm |
| MW-MS-014 | `sparking` + waveguide bad | `mw_ms_014_sparking_waveguide_bad` | `magnetron` confirm |

**Totals:** 45 rules, 14 multi-signal (was 31 / 0).

## Next: Batch 6 — stacked laundry + AIO laundry
