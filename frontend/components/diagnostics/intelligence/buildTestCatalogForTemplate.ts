import { getDiagnosticTemplate } from '../../../constants/diagnosticTemplates';
import { getWizardDefinition } from '../registry/wizardRegistry';
import { getFieldKnowledgeId, listSmartFieldKeysForTemplate } from '../knowledge/fieldBindings';
import type { DiagnosticTestDefinition } from './evidenceTypes';

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

/** Build test catalog entries from template sections + smart-field bindings. */
export function buildTestsForTemplate(templateId: string): DiagnosticTestDefinition[] {
  const template = getDiagnosticTemplate(templateId);
  if (!template?.sections?.length) return [];

  const wizard = getWizardDefinition(templateId);
  const smartKeys = new Set(listSmartFieldKeysForTemplate(templateId));
  const tests: DiagnosticTestDefinition[] = [];
  const seen = new Set<string>();

  for (const section of template.sections) {
    const step = wizard?.defaultSteps?.find((entry) => entry.sectionId === section.id);
    const wizardStepKey = step?.stepKey || section.id;

    for (const field of section.fields || []) {
      const fieldRecord = field as { id: string; label: string; type?: string };
      if (fieldRecord.type === 'check') continue;

      const fieldKey = `${section.id}.${fieldRecord.id}`;
      const testId = slugify(`${templateId}_${fieldKey}`);
      if (seen.has(testId)) continue;
      seen.add(testId);

      tests.push({
        testId,
        label: fieldRecord.label || fieldRecord.id,
        templateId,
        fieldKey,
        knowledgeId: getFieldKnowledgeId(templateId, fieldKey) || undefined,
        wizardStepKey,
      });
    }
  }

  // Ensure every smart measurement field has a catalog row even if template layout differs.
  for (const fieldKey of smartKeys) {
    const testId = slugify(`${templateId}_${fieldKey}`);
    if (seen.has(testId)) continue;
    seen.add(testId);

    const sectionId = fieldKey.split('.')[0];
    const fieldId = fieldKey.split('.').pop() || fieldKey;
    const section = template.sections.find((entry) => entry.id === sectionId);
    const field = section?.fields?.find(
      (entry: { id: string }) => entry.id === fieldId,
    ) as { id: string; label: string } | undefined;
    const step = wizard?.defaultSteps?.find((entry) => entry.sectionId === sectionId);

    tests.push({
      testId,
      label: field?.label || fieldId.replace(/_/g, ' '),
      templateId,
      fieldKey,
      knowledgeId: getFieldKnowledgeId(templateId, fieldKey) || undefined,
      wizardStepKey: step?.stepKey || sectionId,
    });
  }

  return tests;
}
