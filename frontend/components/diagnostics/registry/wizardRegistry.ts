import { DIAGNOSTIC_TEMPLATES } from '../../../constants/diagnosticTemplates';
import { refrigeratorWizard } from '../refrigerator/refrigeratorWizard';
import { createWizardDefinitionFromTemplate } from '../shared/createWizardDefinitionFromTemplate';
import type { WizardDefinition } from '../types';

const TEMPLATE_ALIASES: Record<string, string> = {
  range_oven: 'electric_range',
  dryer: 'electric_dryer',
};

const GENERATED_TEMPLATE_IDS = DIAGNOSTIC_TEMPLATES.map((t) => t.id).filter((id) => id !== 'refrigerator');

function buildGeneratedRegistry(): Record<string, WizardDefinition> {
  const entries: Record<string, WizardDefinition> = {};
  for (const templateId of GENERATED_TEMPLATE_IDS) {
    const def = createWizardDefinitionFromTemplate(templateId);
    if (def) entries[templateId] = def;
  }
  return entries;
}

export const wizardRegistry: Record<string, WizardDefinition> = {
  refrigerator: refrigeratorWizard,
  ...buildGeneratedRegistry(),
};

export function resolveWizardTemplateId(templateId: string): string {
  return TEMPLATE_ALIASES[templateId] || templateId;
}

export function getWizardDefinition(templateId: string | null | undefined): WizardDefinition | null {
  if (!templateId) return null;
  const resolved = resolveWizardTemplateId(templateId);
  return wizardRegistry[resolved] || null;
}

export function listWizardDefinitions(): Array<{
  id: string;
  label: string;
  title: string;
  estimatedCompletionMinutes?: number;
  version: string;
}> {
  return Object.values(wizardRegistry).map((def) => ({
    id: def.templateId,
    label: def.title.replace(/ Diagnostic$/, ''),
    title: def.title,
    estimatedCompletionMinutes: def.estimatedCompletionMinutes,
    version: def.version,
  }));
}

export function hasWizardDefinition(templateId: string): boolean {
  return Boolean(getWizardDefinition(templateId));
}
