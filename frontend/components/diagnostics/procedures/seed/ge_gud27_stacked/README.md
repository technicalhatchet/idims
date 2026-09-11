# GE GUD27 stacked laundry — dryer procedures

**Platform:** `ge_gud27_stacked`  
**Template:** `stacked_laundry`  
**Manual:** GE-GUD27-STACKED (`gud27essmww.pdf`)

Mechanical timer dryer section only. No F-codes — route by complaint chips.

| Procedure | Symptom tags |
|-----------|--------------|
| `gegud27-no-heat-electric` | no_heat, dryer_no_heat |
| `gegud27-heater-thermostats-electric` | heating_element_check |
| `gegud27-no-heat-gas` | no_heat, ignition_issue |
| `gegud27-no-tumble` | dryer_no_tumble, motor_check |
| `gegud27-timer-not-advancing` | timer_not_advancing, unitized_timer |
| `gegud27-vent-restriction` | dryer_not_drying, long_dry |

**Pipeline:** `python backend/scripts/generate_ge_gud27_stacked_procedure_seeds.py`
