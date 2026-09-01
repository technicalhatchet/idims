import type { ComplaintChipDefinition } from '../routing/types';

export const MICROWAVE_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'no_heat',
    label: "Won't Heat / No Heat",
    keywords: ['no heat', 'won\'t heat', 'not heating', 'runs but cold', 'weak heat'],
  },
  {
    id: 'no_power',
    label: "Dead / Won't Start",
    keywords: ['no power', 'dead', 'won\'t start', 'no display', 'tripped breaker'],
  },
  {
    id: 'turntable',
    label: 'Turntable Not Turning',
    keywords: ['turntable', 'plate won\'t turn', 'not spinning', 'tray'],
  },
  {
    id: 'sparking',
    label: 'Arcing / Sparking',
    keywords: ['spark', 'arcing', 'fire', 'burn mark', 'metal'],
  },
  {
    id: 'door_issue',
    label: 'Door / Latch Problem',
    keywords: ['door', 'latch', 'won\'t close', 'won\'t open', 'switch', 'interlock'],
  },
  {
    id: 'noisy',
    label: 'Noisy / Loud Humming',
    keywords: ['noisy', 'loud', 'humming', 'buzzing', 'grinding'],
  },
  {
    id: 'vent_fan',
    label: 'Vent Fan Not Working',
    keywords: ['vent fan', 'exhaust fan', 'over range', 'hood fan', 'ventilation'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'fault', 'code', 'f1', 'f2', 'f-1', 'f-2', 'f-4', 'c-f1', 'c-f2', 'c-20'],
  },
];
