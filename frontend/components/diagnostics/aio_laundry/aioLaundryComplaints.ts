import type { ComplaintChipDefinition } from '../routing/types';
import {
  LAUNDRY_COMBO_COMMON_CHIPS,
  LAUNDRY_COMBO_DRYER_CHIPS,
  LAUNDRY_COMBO_WASHER_CHIPS,
} from '../stacked_laundry/stackedLaundryComplaints';

export const AIO_LAUNDRY_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  ...LAUNDRY_COMBO_WASHER_CHIPS,
  ...LAUNDRY_COMBO_DRYER_CHIPS,
  ...LAUNDRY_COMBO_COMMON_CHIPS,
  {
    id: 'heat_pump_dry',
    label: 'Not Drying (Heat Pump)',
    keywords: ['not drying', 'damp', 'condenser', 'heat pump', 'filter clogged'],
  },
  {
    id: 'condensate',
    label: 'Condensate / Drain Issue',
    keywords: ['condensate', 'drain pump', 'water in drum', 'coin trap'],
  },
  {
    id: 'compressor',
    label: 'Compressor / Sealed System',
    keywords: ['compressor', 'refrigerant', 'sealed system', 'no heat pump'],
  },
];
