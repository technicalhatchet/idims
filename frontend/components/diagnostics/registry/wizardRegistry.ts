import { DIAGNOSTIC_TEMPLATES } from '../../../constants/diagnosticTemplates';
import { dishwasherWizard } from '../dishwasher/dishwasherWizard';
import { electricRangeWizard } from '../electric_range/electricRangeWizard';
import { electricDryerWizard } from '../electric_dryer/electricDryerWizard';
import { gasRangeWizard } from '../gas_range/gasRangeWizard';
import { gasDryerWizard } from '../gas_dryer/gasDryerWizard';
import { aioLaundryWizard } from '../aio_laundry/aioLaundryWizard';
import { microwaveWizard } from '../microwave/microwaveWizard';
import { refrigeratorWizard } from '../refrigerator/refrigeratorWizard';
import { stackedLaundryWizard } from '../stacked_laundry/stackedLaundryWizard';
import { standaloneFreezerWizard } from '../standalone_freezer/standaloneFreezerWizard';
import { washerWizard } from '../washer/washerWizard';
import { createWizardDefinitionFromTemplate } from '../shared/createWizardDefinitionFromTemplate';
import type { WizardDefinition } from '../types';

const TEMPLATE_ALIASES: Record<string, string> = {
  range_oven: 'electric_range',
  dryer: 'electric_dryer',
};

const RICH_WIZARD_TEMPLATE_IDS = new Set([
  'refrigerator',
  'electric_range',
  'gas_range',
  'electric_dryer',
  'gas_dryer',
  'washer',
  'dishwasher',
  'microwave',
  'stacked_laundry',
  'aio_laundry',
  'standalone_freezer',
]);

const GENERATED_TEMPLATE_IDS = DIAGNOSTIC_TEMPLATES.map((t) => t.id).filter(
  (id) => !RICH_WIZARD_TEMPLATE_IDS.has(id),
);

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
  electric_range: electricRangeWizard,
  gas_range: gasRangeWizard,
  electric_dryer: electricDryerWizard,
  gas_dryer: gasDryerWizard,
  washer: washerWizard,
  dishwasher: dishwasherWizard,
  microwave: microwaveWizard,
  stacked_laundry: stackedLaundryWizard,
  aio_laundry: aioLaundryWizard,
  standalone_freezer: standaloneFreezerWizard,
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
