import type { RoutingRule } from '../routing/types';
import { microwaveFieldVisibilityRules } from './microwaveFieldVisibility';
import { microwaveFieldHelp, microwaveRecommendations } from './microwaveFieldGuidance';

export const microwaveRoutingRules: RoutingRule[] = [
  {
    id: 'no_heat',
    label: 'No heat path',
    when: ['no_heat', 'no heat', 'won\'t heat', 'not heating'],
    enable: ['visual', 'functional', 'door', 'hv'],
  },
  {
    id: 'no_power',
    label: 'No power path',
    when: ['no_power', 'no power', 'dead', 'won\'t start'],
    enable: ['functional', 'door', 'hv'],
  },
  {
    id: 'turntable',
    label: 'Turntable path',
    when: ['turntable', 'turntable', 'plate won\'t turn'],
    enable: ['visual', 'functional'],
  },
  {
    id: 'sparking',
    label: 'Arcing path',
    when: ['sparking', 'spark', 'arcing', 'fire'],
    enable: ['visual', 'hv'],
  },
  {
    id: 'door_issue',
    label: 'Door / latch path',
    when: ['door_issue', 'door', 'latch', 'won\'t close'],
    enable: ['visual', 'functional', 'door'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'loud', 'humming', 'buzzing'],
    enable: ['functional', 'hv'],
  },
  {
    id: 'vent_fan',
    label: 'Vent / OTR fan path',
    when: ['vent_fan', 'vent fan', 'exhaust', 'hood fan'],
    enable: ['functional'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault'],
    enable: ['door', 'hv', 'functional'],
  },
];

export const microwaveRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: microwaveRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    door: ['visual', 'functional'],
    hv: ['door'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: microwaveFieldVisibilityRules,
  fieldHelp: microwaveFieldHelp,
  recommendations: microwaveRecommendations,
};
