import type { RoutingRule } from '../routing/types';
import { washerFieldVisibilityRules } from './washerFieldVisibility';
import { washerFieldHelp, washerRecommendations } from './washerFieldGuidance';

export const washerRoutingRules: RoutingRule[] = [
  {
    id: 'leaking',
    label: 'Leak path',
    when: ['leaking', 'leak', 'leaking', 'water on floor'],
    enable: ['visual', 'functional', 'electrical', 'mechanical'],
  },
  {
    id: 'wont_drain',
    label: 'Drain path',
    when: ['wont_drain', 'won\'t drain', 'not draining', 'standing water'],
    enable: ['visual', 'functional', 'electrical', 'mechanical'],
  },
  {
    id: 'wont_spin',
    label: 'Spin path',
    when: ['wont_spin', 'won\'t spin', 'not spinning', 'clothes wet'],
    enable: ['visual', 'functional', 'electrical', 'mechanical'],
  },
  {
    id: 'wont_agitate',
    label: 'Agitate path',
    when: ['wont_agitate', 'won\'t agitate', 'not agitating'],
    enable: ['functional', 'electrical', 'mechanical'],
  },
  {
    id: 'no_fill',
    label: 'Fill path',
    when: ['no_fill', 'won\'t fill', 'slow fill', 'no water'],
    enable: ['functional', 'electrical', 'mechanical'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'banging', 'grinding', 'squeal'],
    enable: ['visual', 'mechanical'],
  },
  {
    id: 'vibration',
    label: 'Vibration path',
    when: ['vibration', 'vibrat', 'walking', 'shaking'],
    enable: ['visual', 'functional', 'mechanical'],
  },
  {
    id: 'lid_lock',
    label: 'Lid / door lock path',
    when: ['lid_lock', 'lid lock', 'door lock', 'f dl'],
    enable: ['functional', 'mechanical'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault', 'ue', 'oe'],
    enable: ['electrical', 'mechanical', 'functional'],
  },
];

export const washerRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: washerRoutingRules,
  prerequisites: {
    visual: ['complaint'],
    functional: ['visual'],
    electrical: ['visual', 'functional'],
    mechanical: ['visual', 'functional'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: washerFieldVisibilityRules,
  fieldHelp: washerFieldHelp,
  recommendations: washerRecommendations,
};
