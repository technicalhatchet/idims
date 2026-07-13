import type { RoutingRule } from '../routing/types';
import { gasDryerFieldVisibilityRules } from './gasDryerFieldVisibility';
import { gasDryerFieldHelp, gasDryerRecommendations } from './gasDryerFieldGuidance';

export const gasDryerRoutingRules: RoutingRule[] = [
  {
    id: 'no_heat',
    label: 'No heat / ignition path',
    when: ['no_heat', 'no heat', 'won\'t ignite', 'no flame'],
    enable: ['visual', 'functional', 'ignition', 'motor'],
  },
  {
    id: 'not_drying',
    label: 'Poor drying / vent path',
    when: ['not_drying', 'not drying', 'damp', 'too long'],
    enable: ['visual', 'functional', 'ignition'],
  },
  {
    id: 'no_spin',
    label: 'No tumble path',
    when: ['no_spin', 'won\'t tumble', 'not turning'],
    enable: ['visual', 'functional', 'motor'],
  },
  {
    id: 'wont_stop_spinning',
    label: 'Won\'t stop spinning path',
    when: ['wont_stop_spinning', 'won\'t stop', 'keeps spinning'],
    enable: ['functional', 'motor'],
  },
  {
    id: 'gas_smell',
    label: 'Gas odor path',
    when: ['gas_smell', 'gas smell', 'odor', 'leak'],
    enable: ['commonly_missed', 'visual'],
  },
  {
    id: 'weak_flame',
    label: 'Flame quality path',
    when: ['weak_flame', 'weak flame', 'flame out', 'goes out'],
    enable: ['visual', 'functional', 'ignition'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'squeal', 'thump', 'grinding'],
    enable: ['visual', 'motor'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault'],
    enable: ['motor', 'functional', 'ignition'],
  },
];

export const gasDryerRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: gasDryerRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    ignition: ['visual', 'functional'],
    motor: ['visual', 'functional'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: gasDryerFieldVisibilityRules,
  fieldHelp: gasDryerFieldHelp,
  recommendations: gasDryerRecommendations,
};
