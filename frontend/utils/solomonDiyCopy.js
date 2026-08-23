/**
 * Homeowner-facing labels (Phase 3b — no internal jargon).
 */
export const SOLOMON_DIY_COPY = {
  diagnosticsTitle: 'My troubleshooting sessions',
  diagnosticNew: 'Start troubleshooting',
  diagnosticOne: 'Troubleshooting session',
  outcomesTitle: 'My repair notes',
  outcomeNew: 'Save what you learned',
  outcomeOne: 'Repair note',
  saveDiagnostic: 'Save my notes',
  saveOutcome: 'Save repair note',
  equipmentOptional: 'About your appliance (optional)',
  make: 'Brand',
  model: 'Model number',
  serial: 'Serial (optional)',
  changeAppliance: 'Change appliance',
};

export function solomonCopy(isDiyer, key) {
  if (!isDiyer) {
    const staff = {
      diagnosticsTitle: 'My diagnostics',
      diagnosticNew: 'New diagnostic',
      outcomesTitle: 'Repair outcomes',
      outcomeNew: 'New outcome',
      saveDiagnostic: 'Save Diagnostic Results',
      saveOutcome: 'Save outcome',
      equipmentOptional: 'Equipment (optional)',
      make: 'Make',
      model: 'Model',
      serial: 'Serial',
      changeAppliance: 'Change template',
    };
    return staff[key] ?? SOLOMON_DIY_COPY[key];
  }
  return SOLOMON_DIY_COPY[key] ?? key;
}
