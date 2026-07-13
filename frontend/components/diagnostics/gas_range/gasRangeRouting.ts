import type { RoutingRule } from '../routing/types';
import { gasRangeFieldVisibilityRules } from './gasRangeFieldVisibility';
import { gasRangeFieldHelp, gasRangeRecommendations } from './gasRangeFieldGuidance';

export const gasRangeRoutingRules: RoutingRule[] = [
  {
    id: 'no_oven_heat',
    label: 'Oven not heating path',
    when: ['no_oven_heat', 'oven not heating', 'no heat', 'cold oven'],
    enable: ['visual', 'functional', 'electrical', 'flame', 'board'],
  },
  {
    id: 'no_ignition',
    label: 'No ignition path',
    when: ['no_ignition', 'won\'t ignite', 'no flame', 'glows no flame'],
    enable: ['visual', 'functional', 'electrical', 'board'],
  },
  {
    id: 'gas_smell',
    label: 'Gas odor path',
    when: ['gas_smell', 'gas smell', 'odor', 'leak'],
    enable: ['commonly_missed', 'visual'],
  },
  {
    id: 'surface_burners',
    label: 'Surface burner path',
    when: ['surface_burners', 'cooktop', 'top burner'],
    enable: ['visual', 'functional', 'flame'],
  },
  {
    id: 'weak_flame',
    label: 'Flame quality path',
    when: ['weak_flame', 'yellow flame', 'weak flame', 'lp'],
    enable: ['visual', 'flame', 'electrical'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'f2', 'f3'],
    enable: ['board', 'electrical', 'functional'],
  },
  {
    id: 'self_clean',
    label: 'Self-clean / lock path',
    when: ['self_clean', 'self clean', 'door lock'],
    enable: ['functional', 'board'],
  },
];

export const gasRangeRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: gasRangeRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    electrical: ['visual', 'functional'],
    flame: ['visual', 'functional'],
    board: ['visual', 'functional'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: gasRangeFieldVisibilityRules,
  fieldHelp: gasRangeFieldHelp,
  recommendations: gasRangeRecommendations,
};
