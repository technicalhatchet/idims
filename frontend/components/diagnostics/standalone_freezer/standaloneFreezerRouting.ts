import type { RoutingRule } from '../routing/types';
import { standaloneFreezerFieldVisibilityRules } from './standaloneFreezerFieldVisibility';
import {
  standaloneFreezerFieldHelp,
  standaloneFreezerRecommendations,
} from './standaloneFreezerFieldGuidance';

export const standaloneFreezerRoutingRules: RoutingRule[] = [
  {
    id: 'frost_ice',
    label: 'Frost / ice buildup path',
    when: ['frost_buildup', 'frost', 'ice buildup', 'icing'],
    enable: ['temperature', 'visual', 'defrost', 'fans', 'functional'],
  },
  {
    id: 'not_cooling',
    label: 'Not cooling path',
    when: ['not_cooling', 'not cooling', 'warm', 'thaw'],
    enable: ['temperature', 'visual', 'sealedSystem', 'fans', 'functional'],
  },
  {
    id: 'too_cold',
    label: 'Too cold path',
    when: ['too_cold', 'too cold', 'over freeze'],
    enable: ['temperature', 'functional', 'defrost'],
  },
  {
    id: 'noisy',
    label: 'Noise / vibration path',
    when: ['noisy', 'noisy', 'vibrat', 'loud', 'buzz'],
    enable: ['visual', 'functional', 'fans', 'sealedSystem'],
  },
  {
    id: 'leaking',
    label: 'Leak path',
    when: ['leaking', 'leak', 'leaking', 'water on floor'],
    enable: ['visual', 'functional', 'defrost', 'commonly_missed'],
  },
  {
    id: 'running_constant',
    label: 'Constant run path',
    when: ['running_constant', 'never stops', 'runs all', 'constantly'],
    enable: ['temperature', 'visual', 'functional', 'fans', 'sealedSystem'],
  },
  {
    id: 'drain_blocked',
    label: 'Blocked drain observed',
    when: [{ type: 'field', path: 'visual_inspection.drain_clear', equals: 'no' }],
    enable: ['defrost', 'functional'],
  },
  {
    id: 'compressor_not_running',
    label: 'Compressor not running',
    when: [{ type: 'field', path: 'functional_checks.compressor_running', equals: 'no' }],
    enable: ['sealedSystem', 'fans'],
  },
];

export const standaloneFreezerRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: standaloneFreezerRoutingRules,
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
  fieldVisibility: standaloneFreezerFieldVisibilityRules,
  fieldHelp: standaloneFreezerFieldHelp,
  recommendations: standaloneFreezerRecommendations,
};
