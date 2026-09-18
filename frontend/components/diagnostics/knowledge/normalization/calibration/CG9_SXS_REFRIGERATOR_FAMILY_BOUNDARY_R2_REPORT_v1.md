# CG-9 R2 — SxS Family Boundary Triangulation (Whirlpool falsification probe)

**Verdict:** family_boundary_closed · **New canonical concepts:** 0

The frozen french_door_refrigerator contract behaves as a generic refrigerator functional ontology across side-by-side configuration. Configuration differences (door layout, fan count, ice placement, harness naming) are overlay/instance concerns — not a separate canonical family. Ontology rename (e.g. to 'refrigerator') is an organizational re-freeze decision, not required for continued compounding.

## Cross-manufacturer KEEP intersection

| Concept | Samsung SxS | Whirlpool SxS | Intersects |
|---------|-------------|---------------|------------|
| control_board | shared_function | maps_to_frozen_contract | True |
| user_interface | shared_function | maps_to_frozen_contract | True |
| door_switch | shared_function | maps_to_frozen_contract | True |
| evaporator_fan | shared_function | maps_to_frozen_contract | True |
| air_damper | shared_function | maps_to_frozen_contract | True |
| defrost_heater | shared_function | maps_to_frozen_contract | True |

## Cross-manufacturer conditional intersection

| Concept | Samsung | Whirlpool | Intersects |
|---------|---------|-----------|------------|
| temperature_sensor | shared_function | maps_to_frozen_contract | True |
| compressor | shared_function | maps_to_frozen_contract | True |
| condenser_fan | needs_second_manual | maps_to_frozen_contract | True (condenser_fan: Samsung ambiguous (22C); Whirlpool step 7 confirms role — stays conditional, not promoted.) |
| ice_maker | shared_function | maps_to_frozen_contract | True |
| water_dispenser | shared_function | maps_to_frozen_contract | True |

## Recommended next step

stop_digging_use_frozen_contract_for_sxs_compounding_when_needed

Organizational rename deferred: rename french_door_refrigerator → refrigerator at future human re-freeze gate