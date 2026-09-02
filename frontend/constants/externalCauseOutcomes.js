/**
 * Quick-close presets when the appliance is not at fault.
 * Maps to DMA resolution codes — still counts as a resolved visit for repair memory.
 */

export const EXTERNAL_CAUSE_PRESETS = [
  {
    id: 'clogged_dryer_vent',
    label: 'Clogged dryer vent / duct',
    description: 'Restricted airflow — refer vent cleaning',
    values: {
      problem_code: 'poor_drying',
      resolution_code: 'external_cause',
      confirmed_fix:
        'Restricted dryer vent/duct — appliance tested OK; referred customer for vent cleaning',
      replaced_parts: 'None',
      repair_successful: true,
      outcome_confidence: 'confirmed',
      callback_required: false,
      tags: ['restricted_airflow', 'external_cause'],
    },
  },
  {
    id: 'house_plumbing',
    label: 'House plumbing / water supply',
    description: 'Low pressure, closed valve, kinked hose — not unit fault',
    values: {
      problem_code: 'not_draining',
      resolution_code: 'external_cause',
      confirmed_fix:
        'House water supply / plumbing issue — appliance OK after supply restored',
      replaced_parts: 'None',
      repair_successful: true,
      outcome_confidence: 'confirmed',
      callback_required: false,
      tags: ['external_cause'],
    },
  },
  {
    id: 'customer_education',
    label: 'Customer education / usage',
    description: 'Overload, wrong cycle, detergent, installation habit',
    values: {
      problem_code: 'other',
      resolution_code: 'customer_education',
      confirmed_fix: 'Customer education provided — appliance operating normally',
      replaced_parts: 'None',
      repair_successful: true,
      outcome_confidence: 'confirmed',
      callback_required: false,
      tags: ['customer_education'],
    },
  },
  {
    id: 'referred_third_party',
    label: 'Referred third-party service',
    description: 'Vent cleaning, install crew, gas line, etc.',
    values: {
      problem_code: 'other',
      resolution_code: 'referred_third_party',
      confirmed_fix: 'Referred customer to third-party service — appliance not defective',
      replaced_parts: 'None',
      repair_successful: true,
      outcome_confidence: 'confirmed',
      callback_required: false,
      tags: ['external_cause', 'referred'],
    },
  },
];

export function findExternalCausePreset(presetId) {
  if (!presetId) return null;
  return EXTERNAL_CAUSE_PRESETS.find((p) => p.id === presetId) || null;
}

/** Merge preset into Solomon / DMA field-record form values (snake_case). */
export function applyExternalCausePreset(presetId, existing = {}) {
  const preset = findExternalCausePreset(presetId);
  if (!preset) return { ...existing };
  return {
    ...existing,
    ...preset.values,
    tags: [...new Set([...(existing.tags || []), ...(preset.values.tags || [])])],
  };
}

/** Merge preset into work-order Repair Outcome note fields (camelCase). */
export function applyExternalCauseToWorkOrderFields(presetId, existing = {}) {
  const preset = findExternalCausePreset(presetId);
  if (!preset) return { ...existing };
  const v = preset.values;
  return {
    ...existing,
    problemCode: v.problem_code || existing.problemCode,
    resolutionCode: v.resolution_code || existing.resolutionCode,
    confirmedFix: v.confirmed_fix || existing.confirmedFix,
    replacedParts: v.replaced_parts || existing.replacedParts || 'None',
    repairSuccessful: 'true',
    repairMemoryMatch: existing.repairMemoryMatch || 'didnt_use',
    callbackRequired: v.callback_required ?? existing.callbackRequired ?? false,
    tags: [...new Set([...(existing.tags || []), ...(v.tags || [])])],
  };
}
