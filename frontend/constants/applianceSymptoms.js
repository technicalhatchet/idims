/**
 * Appliance-specific symptom lists for booking flows and work order forms.
 * Keys match internal equipment subtype / symptom group names.
 */

export const SYMPTOMS_BY_TYPE = {
  refrigerator: [
    'Not Cooling',
    'Not Freezing',
    'Ice Maker Broken',
    'Leaking',
    'Loud Noise',
    "Won't Start",
    'Frost Buildup',
    'Door Seal Issue',
    'Water Dispenser Broken',
    'Temperature Fluctuating',
  ],
  washing_machine: [
    "Won't Start",
    "Won't Spin",
    "Won't Drain",
    'Leaking',
    'Loud Noise',
    "Won't Fill",
    "Door Won't Lock",
    'Shaking/Vibrating',
    'Error Code',
    "Won't Complete Cycle",
  ],
  dryer: [
    "Won't Heat",
    "Won't Start",
    'Takes Too Long',
    'Loud Noise',
    "Won't Turn",
    'Overheating',
    'No Power',
    'Shuts Off Early',
    'Error Code',
    "Door Won't Latch",
  ],
  dishwasher: [
    "Won't Drain",
    "Won't Fill",
    'Not Cleaning',
    'Leaking',
    "Won't Start",
    "Door Won't Latch",
    'Loud Noise',
    'Error Code',
    'Not Drying',
    'Cloudy Dishes',
  ],
  oven: [
    "Won't Heat",
    "Won't Ignite",
    'Uneven Cooking',
    "Door Won't Close",
    'Error Code',
    "Won't Self-Clean",
    'Temperature Off',
    'Burner Issue',
    'Control Panel Issue',
    "Won't Turn On",
  ],
  microwave: [
    "Won't Heat",
    'Sparking',
    'Turntable Not Spinning',
    "Door Won't Close",
    'Loud Noise',
    "Won't Start",
    'Display Issue',
    'Buttons Not Working',
  ],
  freezer: [
    'Not Freezing',
    'Frost Buildup',
    'Loud Noise',
    'Leaking',
    "Won't Start",
    'Door Seal Issue',
    'Temperature Fluctuating',
  ],
  tv: [
    'No Picture',
    'No Sound',
    "Won't Turn On",
    'Remote Not Working',
    'Lines on Screen',
    'Flickering',
    'No Signal',
    'Cracked Screen',
    'Backlight Issue',
    'HDMI Not Working',
  ],
};

/** All-in-one laundry: union of washer + dryer symptoms (stable order). */
const AIO_LAUNDRY_SYMPTOMS = [
  ...SYMPTOMS_BY_TYPE.washing_machine,
  ...SYMPTOMS_BY_TYPE.dryer.filter((s) => !SYMPTOMS_BY_TYPE.washing_machine.includes(s)),
];

SYMPTOMS_BY_TYPE.aiolaundry = AIO_LAUNDRY_SYMPTOMS;

/** book-test.js appliance id → symptom group key */
export const BOOK_APPLIANCE_SYMPTOM_KEY = {
  refrigerator: 'refrigerator',
  washer: 'washing_machine',
  dryer: 'dryer',
  aiolaundry: 'aiolaundry',
  oven: 'oven',
  dishwasher: 'dishwasher',
  microwave: 'microwave',
  freezer: 'freezer',
  tv: 'tv',
};

/** Fallback when appliance is unknown or "Other". */
export const BOOKING_GENERIC_SYMPTOMS = [
  'Not working at all',
  'Not cooling/heating',
  'Leaking water',
  'Making strange noise',
  'Showing error code',
];

export function getBookingSymptomsForAppliance(applianceId, equipmentSubtype = null) {
  if (!applianceId || applianceId === 'other') {
    return BOOKING_GENERIC_SYMPTOMS;
  }
  if (equipmentSubtype) {
    const equipmentType = applianceId === 'tv' ? 'tv' : 'appliance';
    const fromSubtype = getSymptomsForEquipmentSubtype(equipmentSubtype, equipmentType);
    if (fromSubtype) return fromSubtype;
  }
  const key = BOOK_APPLIANCE_SYMPTOM_KEY[applianceId];
  return (key && SYMPTOMS_BY_TYPE[key]) || BOOKING_GENERIC_SYMPTOMS;
}

/** Work order equipment_subtype → symptom group (staff forms). */
export const SUBTYPE_TO_SYMPTOM_KEY = {
  refrigerator: 'refrigerator',
  freezer: 'freezer',
  washing_machine: 'washing_machine',
  dryer: 'dryer',
  electric_dryer: 'dryer',
  gas_dryer: 'dryer',
  stacked_laundry: 'aiolaundry',
  aio_laundry: 'aiolaundry',
  dishwasher: 'dishwasher',
  oven: 'oven',
  range: 'oven',
  electric_range: 'oven',
  gas_range: 'oven',
  wall_oven: 'oven',
  cooktop: 'oven',
  microwave: 'microwave',
};

export function getSymptomsForEquipmentSubtype(subtype, equipmentType) {
  if (equipmentType === 'tv' || subtype === 'tv') {
    return SYMPTOMS_BY_TYPE.tv;
  }
  const key = SUBTYPE_TO_SYMPTOM_KEY[subtype];
  return key ? SYMPTOMS_BY_TYPE[key] : null;
}
