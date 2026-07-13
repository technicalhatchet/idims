import type { RoutingRule } from '../routing/types';
import { stackedLaundryFieldVisibilityRules } from './stackedLaundryFieldVisibility';
import {
  stackedLaundryFieldHelp,
  stackedLaundryRecommendations,
} from './stackedLaundryFieldGuidance';

export const stackedLaundryRoutingRules: RoutingRule[] = [
  {
    id: 'washer_drain',
    label: 'Washer drain path',
    when: ['washer_drain', 'won\'t drain', 'standing water'],
    enable: ['washer', 'washerElectrical'],
  },
  {
    id: 'washer_spin',
    label: 'Washer spin path',
    when: ['washer_spin', 'won\'t spin', 'clothes wet'],
    enable: ['washer', 'washerElectrical'],
  },
  {
    id: 'washer_leak',
    label: 'Washer leak path',
    when: ['washer_leak', 'leak', 'leaking'],
    enable: ['washer'],
  },
  {
    id: 'washer_fill',
    label: 'Washer fill path',
    when: ['washer_fill', 'won\'t fill', 'no water'],
    enable: ['washer', 'washerElectrical'],
  },
  {
    id: 'dryer_no_heat',
    label: 'Dryer no heat path',
    when: ['dryer_no_heat', 'no heat', 'not heating'],
    enable: ['dryer', 'dryerElectrical'],
  },
  {
    id: 'dryer_not_drying',
    label: 'Dryer vent / dry time path',
    when: ['dryer_not_drying', 'not drying', 'damp', 'too long'],
    enable: ['dryer', 'dryerElectrical'],
  },
  {
    id: 'dryer_no_tumble',
    label: 'Dryer tumble path',
    when: ['dryer_no_tumble', 'won\'t tumble', 'drum not'],
    enable: ['dryer', 'dryerElectrical'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'banging', 'vibrat'],
    enable: ['washer', 'dryer'],
  },
  {
    id: 'no_power',
    label: 'No power path',
    when: ['no_power', 'no power', 'dead'],
    enable: ['washerElectrical', 'dryerElectrical'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault'],
    enable: ['washer', 'dryer', 'washerElectrical', 'dryerElectrical'],
  },
];

export const stackedLaundryRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: stackedLaundryRoutingRules,
  prerequisites: {
    washer: ['complaint'],
    dryer: ['complaint'],
    washerElectrical: ['washer'],
    dryerElectrical: ['dryer'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: stackedLaundryFieldVisibilityRules,
  fieldHelp: stackedLaundryFieldHelp,
  recommendations: stackedLaundryRecommendations,
};
