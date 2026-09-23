# Canonical FL Washer — Mapping & Gap Analysis (Phase 0–1)

**Canonical graph:** `knowledge/canonical/front_load_washer.json`  
**Reference overlays:** `knowledge/canonical/platform_overlays/front_load_washer.reference.json`  
**Evidence graph:** `knowledge/evidence/washer.json`  
**Status:** Phase 0–1 complete; **Phase 2 evidence graph** — new components added to `evidence/washer.json`.

## Reference platforms

| Smoke model | Platform | Manual | Procedures |
|-------------|----------|--------|------------|
| WFW5620 | `whirlpool_fl_dd` | W11169652 | 17 TEST # (+ bundles) |
| WFW8300 | `whirlpool_duet_sport` | W8178558 | 9 §5-x procedures (+ bundles) |
| WF45T6000 | `samsung_fl_washer_wf6000r` | SAMSUNG-FL-WF6000R | 13 §4-x procedures (+ bundles) |

---

## Canonical component → evidence mapping

| Canonical `componentId` | Evidence graph | `categoryId` | Notes |
|-------------------------|----------------|--------------|-------|
| `supply` | ✅ exists | `electrical_supply` | |
| `control_board` | ✅ exists | `control_board` | Alias: `main_control` (Samsung seeds) |
| `motor_controller` | ✅ added Phase 2 | `drive_motor` | Alias: `inverter` (Samsung seeds) |
| `hmi_control` | ✅ exists | `control_hmi` | |
| `door_lock` | ✅ exists | `door_lock` | |
| `inlet_valve` | ✅ exists | `fill_supply` | |
| `water_level_sensor` | ✅ exists | `water_level` | |
| `pressure_hose` | ✅ added Phase 2 | `water_level` | Wizard `mechanical_controls.pressure_switch` |
| `pressure_chamber` | ✅ added Phase 2 | `water_level` | Passive path — paired with hose |
| `dosing_pump` | ✅ exists | `dispenser` | |
| `bulk_level_switch` | ✅ exists | `dispenser` | W11169652 combo only |
| `drain_pump` | ✅ exists | `drain_pump` | |
| `recirc_pump` | ✅ added Phase 2 | `drain_pump` | `whirlpoolFlWasherRecircPumpOhms`; no OEM seed on FL DD yet |
| `drive_motor` | ✅ exists | `drive_motor` | |
| `wash_heater` | ✅ exists | `wash_heating` | Optional on some models |
| `wash_ntc` | ✅ exists | `wash_heating` | |
| `drum_bearing` | ✅ added Phase 2 | `mechanical` | Wizard `visual_inspection.tub_movement` |
| `suspension` | ✅ added Phase 2 | `mechanical` | Wizard visual + UV/UB keywords |
| `drive_belt` | ✅ added Phase 2 | `mechanical` | Duet Sport belt-drive; wizard visual |
| `vent_fan` | ✅ exists | `vent_dry` | Combo only |
| `vent_baffle` | ✅ exists | `vent_dry` | Combo only |
| `dry_heater` | ✅ exists | `dry_heating` | Combo only |
| `dry_ntc` | ✅ exists | `dry_heating` | Combo only |
| `dry_blower` | ✅ exists | `vent_dry` | Combo only |

**Phase 2 evidence additions:** ✅ `mechanical` category + `motor_controller`, `recirc_pump`, `suspension`, `drum_bearing`, `pressure_hose`, `pressure_chamber`, `drive_belt`.

---

## System → evidence category mapping

| Canonical `systemId` | Evidence `categoryId` | Change needed? |
|----------------------|----------------------|----------------|
| `power` | `electrical_supply` | No |
| `control` | `control_board` | No |
| `user_interface` | `control_hmi` | No |
| `door_interlock` | `door_lock` | No |
| `water_inlet` | `fill_supply` | No |
| `water_level` | `water_level` | No |
| `dispensing` | `dispenser` | No |
| `drain` | `drain_pump` | No |
| `recirculation` | `drain_pump` (shared) | No — until `recirc_pump` split |
| `drive` | `drive_motor` | No |
| `heating` | `wash_heating` | No |
| `temperature` | `wash_heating` | No |
| `mechanical` | `mechanical` | ✅ added Phase 2 |
| `communication` | `control_board` | No |
| `vent_dry` | `vent_dry` / `dry_heating` | No |

---

## Platform procedure coverage

### Whirlpool FL DD (`whirlpool_fl_dd`)

| Procedure | Seed `componentIds` | Canonical | Domains |
|-----------|---------------------|-----------|---------|
| test-01-acu-power | `supply` | `supply` | power |
| test-02-hmi | `hmi_control` | `hmi_control` | UI |
| test-03-motor (`w11169652-test-03-motor-circuit`) | `drive_motor` | `drive_motor` | drive |
| test-04-door-lock | `door_lock` | `door_lock` | door |
| test-06-inlet-valves | `inlet_valve` | `inlet_valve` | fill |
| test-07-water-level-sensor | `water_level_sensor` | `water_level_sensor` + pressure path | level |
| test-08-drain-pump | `drain_pump` | `drain_pump` | drain |
| test-09-wash-heater | `wash_heater` | `wash_heater` | heating |
| test-10-wash-temp-sensor | `wash_ntc` | `wash_ntc` | heating |
| test-11a/b dispenser | `dosing_pump` | `dosing_pump` | dispense |
| test-12a/b bulk | `bulk_level_switch` | `bulk_level_switch` | dispense |
| test-13–17 vent/dry | vent/dry ids | combo components | vent_dry |

**Gaps:** `recirc_pump`, `drum_bearing`, `suspension` — no OEM procedures.

### Whirlpool Duet Sport (`whirlpool_duet_sport`)

| Procedure | Seed `componentIds` | Canonical | Notes |
|-----------|---------------------|-----------|-------|
| w8178558-door-lock | `door_lock` | `door_lock`, `control_board` | Wizard OEM lead live |
| w8178558-motor-circuit | `drive_motor` | `drive_motor`, `motor_controller`, `drive_belt` | Belt + MCU |
| w8178558-pressure-switch | `water_level_sensor` | `water_level_sensor` + pressure path | |
| w8178558-interlock-switch | `supply` | `door_lock`, `wiring_connection` | Seed id mismatch — overlay corrects |

**Gaps:** No HMI procedure; mechanical components wizard-only.

### Samsung WF45T6000 (`samsung_fl_washer_wf6000r`)

| Procedure | Seed `componentIds` | Canonical (after alias) | Notes |
|-----------|---------------------|-------------------------|-------|
| power-supply | `supply`, `main_control` | `supply`, `control_board` | |
| communication | `main_control`, `inverter` | `control_board`, `motor_controller` | |
| unbalance | `drive_motor` | `drive_motor`, `suspension` | **Seed gap** — add suspension |
| mems-sensor | `main_control` | `control_board` | Tilt/vibration |

**Alias map (platform overlay):** `main_control` → `control_board`, `inverter` → `motor_controller`

---

## Diagnostic entry points (v1)

15 entry points defined in canonical JSON. Initial domains per complaint:

| Entry | Primary domains |
|-------|-----------------|
| dead | power, control |
| won't start | UI, control, door, power |
| won't fill | fill, door, level, control |
| overfills | level, fill, control |
| won't drain | drain, level, control |
| won't spin | drive, drain, level, door, mechanical, control |
| won't tumble | drive, door, mechanical, control |
| no heat | heating, control |
| leak | drain, fill, door, installation |
| noise | mechanical, drive |
| vibration/unbalance | mechanical, drive, installation |
| door lock | door, control, wiring |
| dispenser | dispense, fill |
| error code | control, UI |
| communication | communication, control |

---

## Known seed ↔ canonical mismatches (fix in Phase 2)

| Platform | Issue | Recommended fix |
|----------|-------|-----------------|
| `samsung_fl_washer_wf6000r` | `main_control`, `inverter` in seeds | ✅ Runtime aliases → `control_board`, `motor_controller` (`component_aliases.json`) |
| `samsung_fl_washer_wf6000r` | `unbalance` tags only `drive_motor` | ✅ `suspension` added to `componentIds` |
| `whirlpool_duet_sport` | `interlock-switch` uses `supply` | Consider `door_lock` or document wiring-only path |
| All FL washers | Mechanical (`drum_bearing`, `suspension`) | Add evidence components + rules when wizard/OEM links |

---

## Functional dependencies (quick reference)

```
cycle_start:  UI + control_board + door_lock → enables fill, drive
water_fill:   control + door + inlet + supply → feedback water_level_sensor
drain:        control + drain_pump → feedback water_level_sensor
drive:        control + door + drive_motor → conditional motor_controller, level, drain, suspension
heating:      control + wash_heater → conditional wash_ntc
spin_auth:    door_lock + drain_pump + water_level_sensor → conditional suspension
```

---

## Validation

```bash
python backend/scripts/validate_canonical_graph.py
```

---

## Next steps (Phase 2 continued)

1. ~~Add pending evidence components~~ ✅ Done
2. ~~Dev harness: complaint → entry domains → ranked procedures~~ ✅ `/solomon/procedures/dev` + canonical boost in `recommendServiceProcedures`
3. Wire `deprioritizeDomains` on procedure branches (Duet Sport door lock CCU path as template)
4. Normalize Samsung seed `componentIds` to canonical ids
5. TL agitator / impeller canonical graphs (reuse subsystem blocks from FL)
