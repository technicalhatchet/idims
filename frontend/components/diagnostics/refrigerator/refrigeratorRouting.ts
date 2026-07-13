import type { RoutingRule } from '../routing/types';

/** Deterministic refrigerator routes — config only, no imperative branches. */
export const refrigeratorRoutingRules: RoutingRule[] = [
  {
    id: 'frost_ice',
    label: 'Frost / ice buildup path',
    when: ['frost_buildup', 'frost', 'ice buildup', 'freezer warm'],
    enable: ['temperature', 'visual', 'defrost', 'fans', 'functional'],
  },
  {
    id: 'not_cooling',
    label: 'Not cooling path',
    when: ['not_cooling', 'not cooling', 'warm'],
    enable: ['temperature', 'visual', 'sealedSystem', 'fans', 'functional'],
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
    id: 'heavy_frost_yes',
    label: 'Heavy frost observed',
    when: [{ type: 'field', path: 'visual_inspection.frost_present', equals: 'yes' }],
    enable: ['defrost', 'fans'],
  },
];

export const refrigeratorRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: refrigeratorRoutingRules,
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
