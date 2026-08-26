import { hasSolomonDiagnosticProgress } from './solomonDiagnosticProgress';

/**
 * Confirm before switching diagnostic template — keeps draft row + equipment, resets wizard answers.
 */
export function confirmSolomonTemplateChange(payload, isDiyer) {
  if (!hasSolomonDiagnosticProgress(payload)) return true;
  return window.confirm(
    isDiyer
      ? 'Switch appliance type? Your troubleshooting answers will reset, but your appliance details and session stay saved.'
      : 'Switch template? Checklist answers will reset, but equipment and this diagnostic stay saved.',
  );
}
