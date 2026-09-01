import type { FieldRecommendationRule } from '../routing/types';

export const stackedLaundryFieldHelp: Record<string, string> = {
  'commonly_missed.shared_power':
    'Stacked units often share one 240V feed — verify both sections have correct voltage.',
  'commonly_missed.airflow_restrictions':
    'Top dryer vent runs are long — restriction mimics heater failure.',
  'commonly_missed.installation':
    'Stacking kit and level affect vibration and door alignment.',
  'commonly_missed.timer_platform':
    'GE GUD27 / unitized: mechanical timer — no display codes. Auto dry holds until outlet/cycling thermostats open.',
  'washer_section.drain':
    'Confirm drain hose height and standpipe before pump replacement.',
  'dryer_section.airflow':
    'Weak exterior airflow = vent restriction, not always heater.',
  'dryer_measurements.heater_ohms':
    'Electric stacked: open element = no heat. Gas: test igniter ohms/amps.',
  'dryer_section.timer_advances':
    'Auto cycles: timer pauses until outlet thermostat opens — weak vent or bad thermostat stalls timer.',
  'washer_measurements.drain_pump_ohms':
    'Open pump winding = standing water after wash.',
};

export const stackedLaundryRecommendations: FieldRecommendationRule[] = [
  {
    id: 'washer_drain',
    when: [{ type: 'chip', id: 'washer_drain' }],
    message: 'Washer won\'t drain — check pump, drain hose, and coin trap.',
    tone: 'action',
  },
  {
    id: 'dryer_no_heat',
    when: [{ type: 'chip', id: 'dryer_no_heat' }],
    message: 'Dryer no heat — verify vent airflow, then heater/igniter readings.',
    tone: 'action',
  },
  {
    id: 'dryer_not_drying',
    when: [{ type: 'chip', id: 'dryer_not_drying' }],
    message: 'Long dry times — inspect vent run and exterior hood first.',
    tone: 'action',
  },
  {
    id: 'washer_leak',
    when: [{ type: 'chip', id: 'washer_leak' }],
    message: 'Washer leak — fill and spin to isolate tub seal, hoses, or pump.',
    tone: 'tip',
  },
  {
    id: 'timer_not_advancing',
    when: [{ type: 'chip', id: 'timer_not_advancing' }],
    message: 'Timer stuck — on auto dry check outlet/cycling thermostats and vent first; timed dry = timer motor.',
    tone: 'action',
  },
  {
    id: 'unitized_timer',
    when: [{ type: 'chip', id: 'unitized_timer' }],
    message: 'GUD27 unitized — mechanical timer only; no F-codes. Use timer chart + thermostat ladder.',
    tone: 'tip',
  },
];
