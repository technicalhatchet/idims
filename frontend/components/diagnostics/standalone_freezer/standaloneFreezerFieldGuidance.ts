import type { FieldRecommendationRule } from '../routing/types';

export const standaloneFreezerFieldHelp: Record<string, string> = {
  'commonly_missed.door_sealing':
    'Chest and upright freezers rely on a tight lid/door seal — gasket gaps cause frost and warm spots.',
  'commonly_missed.frost_source':
    'Identify if frost is from air infiltration, defrost failure, or warm product load.',
  'commonly_missed.condenser_cleanliness':
    'Dirty coils raise head pressure and can cause constant running or poor pull-down.',
  'commonly_missed.defrost_drain':
    'Clogged defrost drain causes water under the unit and ice on the evaporator.',
  'temperature_checks.freezer_temp':
    'Target typically 0°F or below. Record after lid/door closed ~5 minutes.',
  'temperature_checks.ambient_temp':
    'Garage installs in summer heat can mimic sealed-system failure.',
  'visual_inspection.frost_pattern':
    'Solid blanket = defrost or evap fan; partial frost = possible sealed-system issue.',
  'visual_inspection.drain_clear':
    'Blocked drain pan or tube shows as ice buildup at evaporator base.',
  'functional_checks.compressor_running':
    'Hot and silent compressor often points to start device or failed windings.',
  'functional_checks.evaporator_fan_running':
    'Evap fan out causes warm cabinet and heavy coil frost on upright units.',
  'functional_checks.defrost_operational':
    'Force defrost or manual test to confirm heater, fuse, and termination thermostat.',
  'defrost_circuit.defrost_heater_ohms':
    'Open heater = no defrost cycle. Compare to spec — typically tens of ohms.',
  'compressor_sealed_system.suction_line_feel':
    'Cold suction with warm cabinet can indicate low charge or restriction.',
};

export const standaloneFreezerRecommendations: FieldRecommendationRule[] = [
  {
    id: 'frost_defrost_path',
    when: [{ type: 'chip', id: 'frost_buildup' }],
    message: 'Frost buildup — check door seal, defrost system, and evaporator fan before sealed system.',
    tone: 'action',
  },
  {
    id: 'drain_not_clear',
    field: 'visual_inspection.drain_clear',
    when: [{ type: 'field', path: 'visual_inspection.drain_clear', equals: 'no' }],
    message: 'Blocked defrost drain — clear pan and tube; inspect heater termination.',
    tone: 'action',
  },
  {
    id: 'compressor_not_running',
    field: 'functional_checks.compressor_running',
    when: [{ type: 'field', path: 'functional_checks.compressor_running', equals: 'no' }],
    message: 'Compressor not running — test start relay/overload, cap, and windings.',
    tone: 'action',
  },
  {
    id: 'evap_fan_no',
    field: 'functional_checks.evaporator_fan_running',
    when: [{ type: 'field', path: 'functional_checks.evaporator_fan_running', equals: 'no' }],
    message: 'Evap fan out — expect warm cabinet and heavy evaporator frost.',
    tone: 'action',
  },
  {
    id: 'not_cooling_path',
    when: [{ type: 'chip', id: 'not_cooling' }],
    message: 'Not cooling — confirm cabinet temp, then airflow vs sealed-system readings.',
    tone: 'tip',
  },
  {
    id: 'running_constant',
    when: [{ type: 'chip', id: 'running_constant' }],
    message: 'Runs constantly — check condenser coils, door seal, and thermostat/thermistor first.',
    tone: 'tip',
  },
  {
    id: 'leak_defrost',
    when: [{ type: 'chip', id: 'leaking' }],
    message: 'Water leak — inspect defrost drain, pan, and inlet if equipped with ice maker line.',
    tone: 'action',
  },
];
