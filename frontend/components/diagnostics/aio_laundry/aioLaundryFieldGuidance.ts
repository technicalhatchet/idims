import type { FieldRecommendationRule } from '../routing/types';

export const aioLaundryFieldHelp: Record<string, string> = {
  'commonly_missed.heat_pump_filter':
    'Clogged condenser filter is the #1 cause of poor drying on heat-pump combos.',
  'commonly_missed.drain_filter':
    'Coin trap / drain filter blocks wash drain and condensate removal.',
  'dry_functions.condensate_drain':
    'Condensate pump or drain path failure mimics poor drying.',
  'heat_pump_readings.compressor_amps':
    'Low or zero running amps with fan on = sealed system or compressor issue.',
  'heat_pump_readings.heat_pump_fan_amps':
    'No condenser airflow = overheating and short dry cycles.',
};

export const aioLaundryRecommendations: FieldRecommendationRule[] = [
  {
    id: 'heat_pump_dry',
    when: [{ type: 'chip', id: 'heat_pump_dry' }],
    message: 'Poor drying — clean heat-pump filter and verify condenser fan before compressor work.',
    tone: 'action',
  },
  {
    id: 'condensate',
    when: [{ type: 'chip', id: 'condensate' }],
    message: 'Condensate issue — check coin trap, drain pump, and condensate hose routing.',
    tone: 'action',
  },
  {
    id: 'compressor',
    when: [{ type: 'chip', id: 'compressor' }],
    message: 'Compressor / sealed system — confirm filter and fan first, then amp and winding tests.',
    tone: 'action',
  },
  {
    id: 'washer_drain',
    when: [{ type: 'chip', id: 'washer_drain' }],
    message: 'Won\'t drain — inspect drain filter and pump before assuming wash tub seal.',
    tone: 'tip',
  },
];
