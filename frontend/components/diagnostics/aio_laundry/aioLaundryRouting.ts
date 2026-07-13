import type { RoutingRule } from '../routing/types';
import { aioLaundryFieldVisibilityRules } from './aioLaundryFieldVisibility';
import { aioLaundryFieldHelp, aioLaundryRecommendations } from './aioLaundryFieldGuidance';

export const aioLaundryRoutingRules: RoutingRule[] = [
  {
    id: 'washer_drain',
    label: 'Washer drain path',
    when: ['washer_drain', 'won\'t drain', 'standing water'],
    enable: ['wash', 'washElectrical'],
  },
  {
    id: 'washer_spin',
    label: 'Washer spin path',
    when: ['washer_spin', 'won\'t spin', 'clothes wet'],
    enable: ['wash', 'washElectrical'],
  },
  {
    id: 'washer_leak',
    label: 'Washer leak path',
    when: ['washer_leak', 'leak', 'leaking'],
    enable: ['wash'],
  },
  {
    id: 'washer_fill',
    label: 'Washer fill path',
    when: ['washer_fill', 'won\'t fill', 'no water'],
    enable: ['wash', 'washElectrical'],
  },
  {
    id: 'dryer_no_heat',
    label: 'No heat / dry path',
    when: ['dryer_no_heat', 'no heat', 'not heating'],
    enable: ['dry', 'heatPump'],
  },
  {
    id: 'heat_pump_dry',
    label: 'Heat-pump drying path',
    when: ['heat_pump_dry', 'not drying', 'condenser', 'filter'],
    enable: ['dry', 'heatPump'],
  },
  {
    id: 'dryer_not_drying',
    label: 'Long dry time path',
    when: ['dryer_not_drying', 'damp', 'too long'],
    enable: ['dry', 'heatPump'],
  },
  {
    id: 'dryer_no_tumble',
    label: 'Drum tumble path',
    when: ['dryer_no_tumble', 'won\'t tumble', 'drum not'],
    enable: ['dry', 'washElectrical'],
  },
  {
    id: 'condensate',
    label: 'Condensate path',
    when: ['condensate', 'condensate', 'coin trap', 'drain pump'],
    enable: ['dry', 'washElectrical'],
  },
  {
    id: 'compressor',
    label: 'Compressor path',
    when: ['compressor', 'refrigerant', 'sealed system'],
    enable: ['heatPump', 'dry'],
  },
  {
    id: 'noisy',
    label: 'Noise path',
    when: ['noisy', 'banging', 'vibrat'],
    enable: ['wash', 'dry'],
  },
  {
    id: 'no_power',
    label: 'No power path',
    when: ['no_power', 'no power', 'dead'],
    enable: ['washElectrical', 'heatPump'],
  },
  {
    id: 'error_code',
    label: 'Error code path',
    when: ['error_code', 'error', 'fault'],
    enable: ['wash', 'dry', 'washElectrical', 'heatPump'],
  },
];

export const aioLaundryRoutingConfig = {
  alwaysOnStepKeys: ['commonly_missed', 'complaint', 'diagnosis'],
  reviewStepKey: 'review',
  rules: aioLaundryRoutingRules,
  prerequisites: {
    wash: ['complaint'],
    dry: ['complaint'],
    washElectrical: ['wash'],
    heatPump: ['dry'],
    diagnosis: ['complaint'],
    review: ['diagnosis'],
  },
  fieldVisibility: aioLaundryFieldVisibilityRules,
  fieldHelp: aioLaundryFieldHelp,
  recommendations: aioLaundryRecommendations,
};
