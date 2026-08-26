/** Equipment options for standalone DMA field records */

export const DMA_EQUIPMENT_TYPES = [
  { value: '', label: 'Select type…' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'tv', label: 'TV' },
];

export const DMA_APPLIANCE_SUBTYPES = [
  { value: '', label: 'Select appliance…' },
  { value: 'refrigerator', label: 'Refrigerator' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'dishwasher', label: 'Dishwasher' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'dryer', label: 'Dryer' },
  { value: 'aio_laundry', label: 'AIO Laundry' },
  { value: 'oven', label: 'Oven / Range' },
  { value: 'microwave', label: 'Microwave' },
  { value: 'cooktop', label: 'Cooktop' },
  { value: 'range_hood', label: 'Range Hood' },
  { value: 'other', label: 'Other' },
];

export const DMA_MANUFACTURERS = [
  { value: '', label: 'Select make…' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'LG', label: 'LG' },
  { value: 'Whirlpool', label: 'Whirlpool' },
  { value: 'GE', label: 'GE' },
  { value: 'Frigidaire', label: 'Frigidaire' },
  { value: 'Maytag', label: 'Maytag' },
  { value: 'KitchenAid', label: 'KitchenAid' },
  { value: 'Bosch', label: 'Bosch' },
  { value: 'Kenmore', label: 'Kenmore' },
  { value: 'Electrolux', label: 'Electrolux' },
  { value: 'Sony', label: 'Sony' },
  { value: 'Other', label: 'Other' },
];

export const OUTCOME_CONFIDENCE_OPTIONS = [
  { value: '', label: 'Select confidence…' },
  { value: 'confirmed', label: 'Confirmed — fix verified' },
  { value: 'likely', label: 'Likely — not fully verified' },
  { value: 'unconfirmed', label: 'Unconfirmed — repair not verified' },
  { value: 'incorrect', label: 'Incorrect — diagnosis or fix was wrong' },
];

export const OUTCOME_CONFIDENCE_OPTIONS_DIY = [
  { value: 'confirmed', label: 'Yes — that fixed it' },
  { value: 'unconfirmed', label: 'Not sure yet' },
  { value: 'incorrect', label: 'That did not fix it' },
];

export const EMPTY_FIELD_RECORD = {
  equipment_type: 'appliance',
  equipment_make: '',
  equipment_model: '',
  equipment_subtype: '',
  customer_complaint: '',
  problem_code: '',
  resolution_code: '',
  confirmed_fix: '',
  error_code_text: '',
  replaced_parts: '',
  repair_successful: true,
  outcome_confidence: '',
  callback_required: false,
  technician_summary: '',
  performed_on: '',
  tags: [],
};

export function formatDmaEquipment(record) {
  const parts = [record?.equipment_make, record?.equipment_model].filter(Boolean);
  const subtype = record?.equipment_subtype
    ? record.equipment_subtype.replace(/_/g, ' ')
    : '';
  if (parts.length) return parts.join(' ');
  return subtype || 'Unknown equipment';
}

export function recordToFormValues(record) {
  if (!record) return { ...EMPTY_FIELD_RECORD };
  return {
    equipment_type: record.equipment_type || 'appliance',
    equipment_make: record.equipment_make || '',
    equipment_model: record.equipment_model || '',
    equipment_subtype: record.equipment_subtype || '',
    customer_complaint: record.customer_complaint || '',
    problem_code: record.problem_code || '',
    resolution_code: record.resolution_code || '',
    confirmed_fix: record.confirmed_fix || '',
    error_code_text: record.error_code_text || '',
    replaced_parts: record.replaced_parts || '',
    repair_successful: record.repair_successful !== false,
    outcome_confidence: record.outcome_confidence || '',
    callback_required: !!record.callback_required,
    technician_summary: record.technician_summary || '',
    performed_on: record.performed_on || '',
    tags: Array.isArray(record.tags) ? record.tags.map((t) => t.slug || t) : [],
  };
}

export function formValuesToPayload(values) {
  const payload = {
    equipment_type: values.equipment_type || null,
    equipment_make: values.equipment_make?.trim() || null,
    equipment_model: values.equipment_model?.trim() || null,
    equipment_subtype: values.equipment_subtype || null,
    customer_complaint: values.customer_complaint?.trim() || null,
    problem_code: values.problem_code || null,
    resolution_code: values.resolution_code || null,
    confirmed_fix: values.confirmed_fix?.trim(),
    error_code_text: values.error_code_text?.trim() || null,
    replaced_parts: values.replaced_parts?.trim() || null,
    repair_successful: !!values.repair_successful,
    outcome_confidence: values.outcome_confidence || null,
    callback_required: !!values.callback_required,
    technician_summary: values.technician_summary?.trim() || null,
    performed_on: values.performed_on || null,
    tags: Array.isArray(values.tags) ? values.tags.filter(Boolean) : [],
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') payload[key] = null;
  });
  return payload;
}
