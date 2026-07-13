import type { RoutingRule } from '../routing/types';
import { dishwasherFieldVisibilityRules } from './dishwasherFieldVisibility';
import { dishwasherFieldHelp, dishwasherRecommendations } from './dishwasherFieldGuidance';

export const dishwasherRoutingRules: RoutingRule[] = [
  {
    id: 'not_cleaning',
    label: 'Poor cleaning path',
    when: ['not_cleaning', 'not cleaning', 'dirty dishes', 'poor wash'],
    enable: ['visual', 'functional', 'heat'],
  },
  {
    id: 'wont_drain',
    label: 'Drain path',
    when: ['wont_drain', 'won\'t drain', 'not draining', 'standing water'],
    enable: ['visual', 'functional', 'motor'],
  },
  {
    id: 'leaking',
    label: 'Leak path',
    when: ['leaking', 'leak', 'leaking', 'water on floor'],
    enable: ['visual', 'functional', 'motor'],
  },
  {
    id: 'no_fill',
    label: 'Fill path',
    when: ['no_fill', 'won\'t fill', 'no water'],
    enable: ['functional', 'motor'],
  },
  {
    id: 'no_heat_dry',
    label: 'Heat / dry path',
    when: ['no_heat_dry', 'not drying', 'no heat', 'wet dishes'],
    enable: ['functional', 'heat', 'motor'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'grinding', 'humming', 'loud'],
    enable: ['visual', 'motor'],
  },
  {
    id: 'wont_start',
    label: 'No power path',
    when: ['wont_start', 'won\'t start', 'no power', 'dead'],
    enable: ['motor', 'functional'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault', 'i30', 'oe'],
    enable: ['motor', 'heat', 'functional'],
  },
];

export const dishwasherRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: dishwasherRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    heat: ['visual', 'functional'],
    motor: ['visual', 'functional'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: dishwasherFieldVisibilityRules,
  fieldHelp: dishwasherFieldHelp,
  recommendations: dishwasherRecommendations,
};
