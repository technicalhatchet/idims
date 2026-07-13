import type { RoutingRule } from '../routing/types';
import { electricRangeFieldVisibilityRules } from './electricRangeFieldVisibility';
import {
  electricRangeFieldHelp,
  electricRangeRecommendations,
} from './electricRangeFieldGuidance';

export const electricRangeRoutingRules: RoutingRule[] = [
  {
    id: 'no_bake',
    label: 'No bake path',
    when: ['no_bake', 'no bake', 'oven not heating', 'not heating'],
    enable: ['visual', 'functional', 'terminal', 'elements', 'board'],
  },
  {
    id: 'no_broil',
    label: 'No broil path',
    when: ['no_broil', 'no broil', 'broil'],
    enable: ['visual', 'functional', 'elements', 'board'],
  },
  {
    id: 'surface_burners',
    label: 'Surface burner path',
    when: ['surface_burners', 'burner', 'cooktop', 'surface'],
    enable: ['visual', 'functional', 'terminal'],
  },
  {
    id: 'uneven_heat',
    label: 'Temperature / calibration path',
    when: ['uneven_heat', 'uneven', 'temperature', 'calibration'],
    enable: ['visual', 'functional', 'elements', 'board'],
  },
  {
    id: 'no_power',
    label: 'No power path',
    when: ['no_power', 'no power', 'dead', 'breaker'],
    enable: ['terminal', 'board', 'functional'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'f2', 'f3'],
    enable: ['board', 'functional', 'elements'],
  },
  {
    id: 'self_clean',
    label: 'Self-clean / lock path',
    when: ['self_clean', 'self clean', 'door lock'],
    enable: ['functional', 'board'],
  },
];

export const electricRangeRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: electricRangeRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    terminal: ['visual'],
    elements: ['visual', 'functional'],
    board: ['visual', 'functional'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: electricRangeFieldVisibilityRules,
  fieldHelp: electricRangeFieldHelp,
  recommendations: electricRangeRecommendations,
};
