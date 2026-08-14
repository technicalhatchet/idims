# Signal inventory — microwave

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `no_heat` | Won't Heat / No Heat | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `no_power` | Dead / Won't Start | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `turntable` | Turntable Not Turning | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `sparking` | Arcing / Sparking | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `door_issue` | Door / Latch Problem | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Loud Humming | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `vent_fan` | Vent Fan Not Working | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `microwave/microwaveComplaints.ts` | chip | Yes (multi-select) | |

### Combinability

Complaint chips are **multi-select** — any combination can be selected in the UI.

**Common co-occurring clusters** (not enforced):
- Cooling: `not_cooling` often pairs with section-specific weak cooling chips
- Frost path: `frost_buildup` + cooling complaints

**Semantic opposites** (UI allows both; interpret carefully):
- Section weak cooling chips are **not** mutually exclusive

**Elimination hypothesis `oppositeId` pairs** are true mutual exclusivity.

## 2. Wizard field signals

| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |
|------------|-------|------|--------|----------------|------------|-------------------|
| `commonly_missed.door_switch` | Door switch operation | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.installation` | Installation / clearance | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.misuse` | Customer misuse / metal | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.door_latching` | Intermittent door latching | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.ventilation` | Over-range vent / grease filter | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.door_condition` | Door Condition | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.latch_condition` | Latch / Hooks Condition | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.waveguide_condition` | Waveguide / Stirrer Cover | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.turntable_support` | Turntable / support ring | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `functional_checks.powers_on` | Unit Powers On | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.heats_properly` | Heats Properly (water test) | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.turntable_operation` | Turntable Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.fan_operation` | Cooling / stirrer Fan | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.cooktop_lights` | Cooktop / cavity lights (if equipped) | gb | good, bad | `functional_checks` | always when step enabled | — |
| `door_safety.primary_door_switch` | Primary door switch continuity | text | free text / numeric | `door_safety` | always when step enabled | `microwaveDoorInterlockSwitchOhms` |
| `door_safety.monitor_switch` | Monitor switch continuity | text | free text / numeric | `door_safety` | always when step enabled | `microwaveDoorInterlockSwitchOhms` |
| `door_safety.thermal_cutout` | Thermal cutout / thermostat | text | free text / numeric | `door_safety` | always when step enabled | `microwaveThermalCutoutOhms` |
| `door_safety.fuse_continuity` | Line fuse continuity | text | free text / numeric | `door_safety` | always when step enabled | `microwaveLineFuseOhms` |
| `electrical_hv.supply_voltage` | Supply voltage (V) | text | free text / numeric | `electrical_hv` | always when step enabled | `supplyVoltage120` |
| `electrical_hv.magnetron_ohms` | Magnetron resistance (Ω) — if tested | text | free text / numeric | `electrical_hv` | always when step enabled | `microwaveMagnetronFilamentOhms` |
| `electrical_hv.hv_diode` | HV diode — if tested | text | free text / numeric | `electrical_hv` | always when step enabled | `microwaveHVDiodeCheck` |
| `electrical_hv.capacitor_uf` | High-voltage capacitor (µF) — if tested | text | free text / numeric | `electrical_hv` | always when step enabled | `microwaveHVCapacitanceMFD` |
| `electrical_hv.hv_notes` | HV circuit notes (capacitor discharged?) | textarea | free text | `electrical_hv` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `microwaveDoorInterlockSwitchOhms` | Microwave Door Interlock Switch Continuity | Ω | normal 0-5 | warning 0-20 | critical <0 or >50 | door_safety.primary_door_switch, door_safety.monitor_switch | normal, warning, critical |
| `microwaveHVCapacitanceMFD` | High-Voltage Capacitor Capacitance | µF | normal 0.85-1.2 | warning 0.7-1.4 | critical <0.4 or >1.8 | electrical_hv.capacitor_uf | normal, warning, critical |
| `microwaveHVDiodeCheck` | High-Voltage Diode Check | Ω | critical <0 or >0 | — | — | electrical_hv.hv_diode | normal, warning, critical |
| `microwaveLineFuseOhms` | Microwave Line Fuse Continuity | Ω | normal 0-2 | critical <0 or >5 | — | door_safety.fuse_continuity | normal, warning, critical |
| `microwaveMagnetronFilamentOhms` | Magnetron Filament Resistance | Ω | normal 0.1-1 | warning 0.05-2 | critical <0.02 or >5 | electrical_hv.magnetron_ohms | normal, warning, critical |
| `microwaveThermalCutoutOhms` | Microwave Thermal Cutout Continuity | Ω | normal 0-2 | critical <0 or >5 | — | door_safety.thermal_cutout | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | electrical_hv.supply_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `magnetron_ok` | Magnetron OK | `hv_circuit` | `magnetron_failed` |
| `magnetron_failed` | Magnetron failed | `hv_circuit` | `magnetron_ok` |
| `hv_capacitor_ok` | HV capacitor OK | `hv_circuit` | `hv_capacitor_failed` |
| `hv_capacitor_failed` | HV capacitor failed | `hv_circuit` | `hv_capacitor_ok` |
| `door_interlock_ok` | Door interlock OK | `door_safety` | `door_interlock_failed` |
| `door_interlock_failed` | Door interlock failed | `door_safety` | `door_interlock_ok` |
| `line_fuse_ok` | Line fuse OK | `power_supply` | `line_fuse_failed` |
| `line_fuse_failed` | Line fuse blown | `power_supply` | `line_fuse_ok` |
| `thermal_cutout_ok` | Thermal cutout OK | `power_supply` | `thermal_cutout_failed` |
| `thermal_cutout_failed` | Thermal cutout tripped | `power_supply` | `thermal_cutout_ok` |
| `supply_ok` | Supply voltage OK | `power_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `power_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `magnetron_open` | measurement:microwaveMagnetronFilamentOhms in critical | `magnetron_ok` | `magnetron_failed` | — |
| `capacitor_bad` | measurement:microwaveHVCapacitanceMFD in critical|warning | `hv_capacitor_ok` | `hv_capacitor_failed` | — |
| `fuse_open` | measurement:microwaveLineFuseOhms in critical | `line_fuse_ok` | `line_fuse_failed` | — |
| `thermal_cutout_open` | measurement:microwaveThermalCutoutOhms in critical | `thermal_cutout_ok` | `thermal_cutout_failed` | — |
| `primary_switch_open` | measurement:microwaveDoorInterlockSwitchOhms in critical | `door_interlock_ok` | `door_interlock_failed` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `no_heat_functional` | field:functional_checks.heats_properly=no | `magnetron_ok` | `magnetron_failed` | — |
| `no_power_functional` | field:functional_checks.powers_on=no | `line_fuse_ok`, `door_interlock_ok` | `line_fuse_failed` | — |
| `no_heat_chip` | chip:no_heat | — | — | `magnetron_failed`, `hv_capacitor_failed`, `door_interlock_failed` |
| `no_power_chip` | chip:no_power | — | — | `line_fuse_failed`, `thermal_cutout_failed`, `door_interlock_failed` |
| `door_issue_chip` | chip:door_issue | — | — | `door_interlock_failed` |
| `sparking_chip` | chip:sparking | — | — | `magnetron_failed`, `hv_capacitor_failed` |

## 5. Existing evidence rules

Total: **45** (31 single-signal, 14 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_magnetron_open_magnetron_failed` | measurement:microwaveMagnetronFilamentOhms in critical | `magnetron` | component | confirm | no |
| `cat_up_magnetron_open_magnetron_failed` | measurement:microwaveMagnetronFilamentOhms in critical | `hv_circuit` | category | +38 | no |
| `eliminate_magnetron_open_magnetron_ok` | measurement:microwaveMagnetronFilamentOhms in critical | `magnetron` | component | eliminate | no |
| `confirm_capacitor_bad_hv_capacitor_failed` | measurement:microwaveHVCapacitanceMFD in critical|warning | `hv_capacitor` | component | confirm | no |
| `cat_up_capacitor_bad_hv_capacitor_failed` | measurement:microwaveHVCapacitanceMFD in critical|warning | `hv_circuit` | category | +38 | no |
| `eliminate_capacitor_bad_hv_capacitor_ok` | measurement:microwaveHVCapacitanceMFD in critical|warning | `hv_capacitor` | component | eliminate | no |
| `confirm_fuse_open_line_fuse_failed` | measurement:microwaveLineFuseOhms in critical | `line_fuse` | component | confirm | no |
| `cat_up_fuse_open_line_fuse_failed` | measurement:microwaveLineFuseOhms in critical | `power_supply` | category | +38 | no |
| `eliminate_fuse_open_line_fuse_ok` | measurement:microwaveLineFuseOhms in critical | `line_fuse` | component | eliminate | no |
| `confirm_thermal_cutout_open_thermal_cutout_failed` | measurement:microwaveThermalCutoutOhms in critical | `thermal_cutout` | component | confirm | no |
| `cat_up_thermal_cutout_open_thermal_cutout_failed` | measurement:microwaveThermalCutoutOhms in critical | `power_supply` | category | +38 | no |
| `eliminate_thermal_cutout_open_thermal_cutout_ok` | measurement:microwaveThermalCutoutOhms in critical | `thermal_cutout` | component | eliminate | no |
| `confirm_primary_switch_open_door_interlock_failed` | measurement:microwaveDoorInterlockSwitchOhms in critical | `door_interlock` | component | confirm | no |
| `cat_up_primary_switch_open_door_interlock_failed` | measurement:microwaveDoorInterlockSwitchOhms in critical | `door_safety` | category | +38 | no |
| `eliminate_primary_switch_open_door_interlock_ok` | measurement:microwaveDoorInterlockSwitchOhms in critical | `door_interlock` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `power_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `confirm_no_heat_functional_magnetron_failed` | field:functional_checks.heats_properly=no | `magnetron` | component | confirm | no |
| `cat_up_no_heat_functional_magnetron_failed` | field:functional_checks.heats_properly=no | `hv_circuit` | category | +35 | no |
| `eliminate_no_heat_functional_magnetron_ok` | field:functional_checks.heats_properly=no | `magnetron` | component | eliminate | no |
| `confirm_no_power_functional_line_fuse_failed` | field:functional_checks.powers_on=no | `line_fuse` | component | confirm | no |
| `cat_up_no_power_functional_line_fuse_failed` | field:functional_checks.powers_on=no | `power_supply` | category | +35 | no |
| `eliminate_no_power_functional_line_fuse_ok` | field:functional_checks.powers_on=no | `line_fuse` | component | eliminate | no |
| `eliminate_no_power_functional_door_interlock_ok` | field:functional_checks.powers_on=no | `door_interlock` | component | eliminate | no |
| `chip_no_heat_hv_circuit` | chip:no_heat | `hv_circuit` | category | +22 | no |
| `chip_no_heat_door_safety` | chip:no_heat | `door_safety` | category | +22 | no |
| `chip_no_power_power_supply` | chip:no_power | `power_supply` | category | +22 | no |
| `chip_no_power_door_safety` | chip:no_power | `door_safety` | category | +22 | no |
| `chip_door_issue_door_safety` | chip:door_issue | `door_safety` | category | +22 | no |
| `chip_sparking_hv_circuit` | chip:sparking | `hv_circuit` | category | +22 | no |
| `mw_ms_001_no_heat_functional_magnetron` | chip:no_heat AND field:functional_checks.heats_properly=no | `magnetron` | component | confirm | **yes** |
| `mw_ms_002_no_heat_magnetron_ol` | chip:no_heat AND measurement:microwaveMagnetronFilamentOhms in critical | `magnetron` | component | confirm | **yes** |
| `mw_ms_003_no_heat_capacitor_bad` | chip:no_heat AND measurement:microwaveHVCapacitanceMFD in critical|warning | `hv_capacitor` | component | confirm | **yes** |
| `mw_ms_004_no_heat_door_switch_open` | chip:no_heat AND measurement:microwaveDoorInterlockSwitchOhms in critical | `door_interlock` | component | confirm | **yes** |
| `mw_ms_005_no_power_functional_fuse` | chip:no_power AND field:functional_checks.powers_on=no | `line_fuse` | component | confirm | **yes** |
| `mw_ms_006_no_power_fuse_open` | chip:no_power AND measurement:microwaveLineFuseOhms in critical | `line_fuse` | component | confirm | **yes** |
| `mw_ms_007_no_power_thermal_cutout` | chip:no_power AND measurement:microwaveThermalCutoutOhms in critical | `thermal_cutout` | component | confirm | **yes** |
| `mw_ms_008_no_power_door_switch_open` | chip:no_power AND measurement:microwaveDoorInterlockSwitchOhms in critical | `door_interlock` | component | confirm | **yes** |
| `mw_ms_009_door_issue_switch_open` | chip:door_issue AND measurement:microwaveDoorInterlockSwitchOhms in critical | `door_interlock` | component | confirm | **yes** |
| `mw_ms_010_door_issue_latch_bad` | chip:door_issue AND field:visual_inspection.latch_condition=bad | `door_interlock` | component | confirm | **yes** |
| `mw_ms_011_sparking_magnetron_ol` | chip:sparking AND measurement:microwaveMagnetronFilamentOhms in critical | `magnetron` | component | confirm | **yes** |
| `mw_ms_012_sparking_capacitor_bad` | chip:sparking AND measurement:microwaveHVCapacitanceMFD in critical|warning | `hv_capacitor` | component | confirm | **yes** |
| `mw_ms_013_no_heat_supply_critical` | chip:no_heat AND measurement:supplyVoltage120 in critical | `supply` | component | confirm | **yes** |
| `mw_ms_014_sparking_waveguide_bad` | chip:sparking AND field:visual_inspection.waveguide_condition=bad | `magnetron` | component | confirm | **yes** |

### Existing multi-signal rules (do not duplicate)

- `mw_ms_001_no_heat_functional_magnetron`: chip:no_heat AND field:functional_checks.heats_properly=no → `magnetron` (No-heat complaint with failed water test — magnetron or HV output path.)
- `mw_ms_002_no_heat_magnetron_ol`: chip:no_heat AND measurement:microwaveMagnetronFilamentOhms in critical → `magnetron` (No heat with magnetron filament open — magnetron failure confirmed.)
- `mw_ms_003_no_heat_capacitor_bad`: chip:no_heat AND measurement:microwaveHVCapacitanceMFD in critical|warning → `hv_capacitor` (No heat with HV capacitor out of spec — weak or failed cap reduces magnetron drive.)
- `mw_ms_004_no_heat_door_switch_open`: chip:no_heat AND measurement:microwaveDoorInterlockSwitchOhms in critical → `door_interlock` (No heat with door interlock open — safety circuit prevents HV energize.)
- `mw_ms_005_no_power_functional_fuse`: chip:no_power AND field:functional_checks.powers_on=no → `line_fuse` (Dead unit complaint with no power at panel — line fuse or supply path first.)
- `mw_ms_006_no_power_fuse_open`: chip:no_power AND measurement:microwaveLineFuseOhms in critical → `line_fuse` (No power with line fuse open — replace fuse and find root cause.)
- `mw_ms_007_no_power_thermal_cutout`: chip:no_power AND measurement:microwaveThermalCutoutOhms in critical → `thermal_cutout` (Dead unit with thermal cutout open — overtemp safety tripped.)
- `mw_ms_008_no_power_door_switch_open`: chip:no_power AND measurement:microwaveDoorInterlockSwitchOhms in critical → `door_interlock` (No power with door switch open — interlock prevents line voltage.)
- `mw_ms_009_door_issue_switch_open`: chip:door_issue AND measurement:microwaveDoorInterlockSwitchOhms in critical → `door_interlock` (Door/latch complaint with interlock open at meter — switch or latch alignment.)
- `mw_ms_010_door_issue_latch_bad`: chip:door_issue AND field:visual_inspection.latch_condition=bad → `door_interlock` (Door complaint with damaged latch/hooks — switches may not engage.)
- `mw_ms_011_sparking_magnetron_ol`: chip:sparking AND measurement:microwaveMagnetronFilamentOhms in critical → `magnetron` (Arcing with failed magnetron — damaged emitter or grounded filament.)
- `mw_ms_012_sparking_capacitor_bad`: chip:sparking AND measurement:microwaveHVCapacitanceMFD in critical|warning → `hv_capacitor` (Sparking with HV capacitor out of spec — failing cap can arc in HV section.)
- `mw_ms_013_no_heat_supply_critical`: chip:no_heat AND measurement:supplyVoltage120 in critical → `supply` (No heat with supply voltage out of range — low line voltage limits HV output.)
- `mw_ms_014_sparking_waveguide_bad`: chip:sparking AND field:visual_inspection.waveguide_condition=bad → `magnetron` (Arcing with damaged waveguide/stirrer cover — metal exposure or burn-through.)
