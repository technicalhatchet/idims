import type { RoutingRule } from '../routing/types';
import { electricDryerFieldVisibilityRules } from './electricDryerFieldVisibility';
import {
  electricDryerFieldHelp,
  electricDryerRecommendations,
} from './electricDryerFieldGuidance';

export const electricDryerRoutingRules: RoutingRule[] = [
  {
    id: 'no_heat',
    label: 'No heat path',
    when: ['no_heat', 'no heat', 'not heating', 'cold'],
    enable: ['visual', 'functional', 'heat', 'motor'],
  },
  {
    id: 'not_drying',
    label: 'Poor drying / vent path',
    when: ['not_drying', 'not drying', 'damp', 'too long'],
    enable: ['visual', 'functional', 'heat'],
  },
  {
    id: 'no_spin',
    label: 'No tumble path',
    when: ['no_spin', 'won\'t tumble', 'not turning', 'drum'],
    enable: ['visual', 'functional', 'motor'],
  },
  {
    id: 'wont_stop_spinning',
    label: 'Won\'t stop spinning path',
    when: ['wont_stop_spinning', 'won\'t stop', 'keeps spinning'],
    enable: ['functional', 'motor'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'squeal', 'thump', 'grinding'],
    enable: ['visual', 'motor'],
  },
  {
    id: 'no_power',
    label: 'No power path',
    when: ['no_power', 'no power', 'dead', 'won\'t start'],
    enable: ['motor', 'functional'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault'],
    enable: ['motor', 'functional'],
  },
];

export const electricDryerRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: electricDryerRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    heat: ['visual', 'functional'],
    motor: ['visual', 'functional'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: electricDryerFieldVisibilityRules,
  fieldHelp: electricDryerFieldHelp,
  recommendations: electricDryerRecommendations,
};
