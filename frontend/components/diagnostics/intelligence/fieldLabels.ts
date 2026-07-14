import { getDiagnosticTemplate } from '../../../constants/diagnosticTemplates';

/** Build fieldKey → label map from diagnostic template sections. */
export function buildFieldLabelsForTemplate(
  templateId: string | null | undefined,
): Record<string, string> {
  const template = getDiagnosticTemplate(templateId);
  if (!template?.sections) return {};

  const labels: Record<string, string> = {};
  for (const section of template.sections) {
    for (const field of section.fields || []) {
      const fieldRecord = field as { id: string; label: string };
      labels[`${section.id}.${fieldRecord.id}`] = fieldRecord.label;
    }
  }
  return labels;
}
