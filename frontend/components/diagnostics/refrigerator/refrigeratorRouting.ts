import type { RoutingRule } from '../routing/types';
import { refrigeratorFieldVisibilityRules } from './refrigeratorFieldVisibility';
import {
  refrigeratorFieldHelp,
  refrigeratorRecommendations,
} from './refrigeratorFieldGuidance';

/** Deterministic refrigerator routes — config only, no imperative branches. */
export const refrigeratorRoutingRules: RoutingRule[] = [
  {
    id: 'frost_ice',
    label: 'Frost / ice buildup path',
    when: ['frost_buildup', 'frost', 'ice buildup'],
    enable: ['temperature', 'visual', 'defrost', 'fans', 'functional'],
  },
  {
    id: 'not_cooling',
    label: 'Not cooling path',
    when: ['not_cooling', 'not cooling', 'completely warm', 'both warm'],
    enable: ['temperature', 'visual', 'sealedSystem', 'fans', 'functional', 'defrost'],
  },
  {
    id: 'weak_cooling_ff',
    label: 'Weak cooling — fresh food path',
    when: [
      'weak_cooling_ff',
      'fresh food warm',
      'fridge warm',
      'refrigerator warm',
      'ff warm',
      'fridge section',
    ],
    enable: ['temperature', 'visual', 'functional', 'fans', 'defrost'],
  },
  {
    id: 'weak_cooling_fz',
    label: 'Weak cooling — freezer path',
    when: [
      'weak_cooling_fz',
      'freezer warm',
      'fz warm',
      'freezer not freezing',
      'soft ice',
      'ice melting',
    ],
    enable: ['temperature', 'visual', 'sealedSystem', 'functional', 'fans', 'defrost'],
  },
  {
    id: 'weak_cooling_general',
    label: 'Weak cooling — general path',
    when: ['weak_cooling', 'weak cooling', 'not cold enough', 'cooling poorly'],
    enable: ['temperature', 'visual', 'functional', 'fans', 'defrost', 'sealedSystem'],
  },
  {
    id: 'ice_maker',
    label: 'Ice maker path',
    when: ['ice_maker', 'ice maker', 'no ice'],
    enable: ['functional', 'fans', 'temperature'],
  },
  {
    id: 'water_dispenser',
    label: 'Water dispenser path',
    when: ['water_dispenser', 'water dispenser', "won't dispense", 'dispenser'],
    enable: ['functional', 'commonly_missed', 'temperature'],
  },
  {
    id: 'noisy',
    label: 'Noise / vibration path',
    when: ['noisy', 'noisy', 'vibrat', 'loud'],
    enable: ['visual', 'functional', 'fans', 'sealedSystem'],
  },
  {
    id: 'leaking',
    label: 'Leak path',
    when: ['leaking', 'leak', 'leaking'],
    enable: ['visual', 'functional', 'defrost', 'commonly_missed'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault code', '22e', '5e', '84c', '41e'],
    enable: ['complaint', 'functional', 'defrost', 'fans', 'sealedSystem'],
  },
  {
    id: 'cooling_off',
    label: 'Cooling Off / demo path',
    when: ['cooling_off', 'o ff', 'of of', 'demo mode', 'exhibition', 'cooling off'],
    enable: ['complaint', 'functional', 'commonly_missed'],
  },
  {
    id: 'door_alarm',
    label: 'Door alarm / buzzer path',
    when: ['door_alarm', 'buzzer', 'ding dong', 'door ajar'],
    enable: ['visual', 'functional', 'commonly_missed'],
  },
  {
    id: 'display_dead',
    label: 'Display / panel path',
    when: ['display_dead', 'panel dead', 'no display', 'keys not working'],
    enable: ['functional', 'fans', 'complaint'],
  },
  {
    id: 'fans_compressor_off',
    label: 'Fans on, compressor off',
    when: [{ type: 'field', path: 'functional_checks.fans_on_compressor_off', equals: 'yes' }],
    enable: ['commonly_missed', 'functional'],
  },
  {
    id: 'heavy_frost_yes',
    label: 'Heavy frost observed',
    when: [{ type: 'field', path: 'visual_inspection.frost_present', equals: 'yes' }],
    enable: ['defrost', 'fans'],
  },
  {
    id: 'defrost_heater_critical',
    label: 'Defrost heater open / failed',
    when: [{ type: 'measurement', knowledgeId: 'defrostHeaterOhms', statusIn: ['critical'] }],
    enable: ['defrost', 'fans', 'temperature'],
  },
  {
    id: 'compressor_amps_abnormal',
    label: 'Compressor amps abnormal',
    when: [{ type: 'measurement', knowledgeId: 'compressorRunAmps', statusIn: ['critical', 'warning'] }],
    enable: ['sealedSystem', 'fans'],
  },
  {
    id: 'supply_voltage_critical',
    label: 'Supply voltage out of range',
    when: [{ type: 'measurement', knowledgeId: 'supplyVoltage120', statusIn: ['critical'] }],
    enable: ['fans'],
  },
  {
    id: 'freezer_temp_high',
    label: 'Freezer cabinet temp high',
    when: [{ type: 'measurement', knowledgeId: 'freezerCabinetTemp', statusIn: ['critical', 'warning'] }],
    enable: ['temperature', 'sealedSystem', 'defrost', 'fans'],
  },
];

export const refrigeratorRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: refrigeratorRoutingRules,
  prerequisites: {
    temperature: ['complaint'],
    visual: ['complaint'],
    functional: ['visual'],
    sealedSystem: ['visual', 'functional'],
    defrost: ['visual'],
    fans: ['visual'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: refrigeratorFieldVisibilityRules,
  fieldHelp: refrigeratorFieldHelp,
  recommendations: refrigeratorRecommendations,
};

/** Short routing keys → diagnosticTemplates section ids. */
export const REFRIGERATOR_STEP_KEYS: Record<string, string> = {
  commonly_missed: 'commonly_missed',
  complaint: 'customer_complaint',
  temperature: 'temperature_checks',
  visual: 'visual_inspection',
  functional: 'functional_checks',
  sealedSystem: 'compressor_sealed_system',
  defrost: 'defrost_circuit',
  fans: 'fans_and_electrical',
  diagnosis: 'diagnosis',
  review: '__review__',
};
