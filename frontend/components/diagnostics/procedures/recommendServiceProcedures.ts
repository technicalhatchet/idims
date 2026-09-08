import type { DiagnosticIntelligenceResult, ComponentEvidenceScore } from '../intelligence/evidenceTypes';
import type { MeasurementContext } from '../knowledge/types';
import { resolvePlatformIdFromModel } from '../knowledge/platformRegistry';
import { getServiceModeBundle, getServiceProceduresForPlatform } from './procedureRegistry';
import { isProcedureAllowedForTemplate } from './procedurePlatformAccess';
import { procedureMatchesErrorCode } from './parseProcedureErrorCodes';
import { SERVICE_MODE_KIND_LABELS } from './serviceModeCatalog';
import type { ProcedureRunState, ServiceModeUiVariant, ServiceProcedure } from './types';

export interface ProcedureRecommendation {
  procedureId: string;
  procedure: ServiceProcedure;
  reason: string;
  priority: number;
  matchedErrorCodes?: string[];
}

export interface RecommendServiceProceduresInput {
  templateId?: string | null;
  measurementContext?: MeasurementContext | null;
  intelligence?: DiagnosticIntelligenceResult | null;
  complaintChipIds?: string[];
  errorCodes?: string[];
  procedureRuns?: Record<string, ProcedureRunState>;
}

/** @deprecated Import from procedurePlatformAccess — kept for callers passing procedureId only. */
export function isProcedureAllowedForTemplateById(
  procedureId: string,
  templateId: string | null | undefined,
  procedures: ServiceProcedure[],
): boolean {
  const procedure = procedures.find((item) => item.id === procedureId);
  return isProcedureAllowedForTemplate(procedure, templateId);
}

function compareOemTestNumber(a: string, b: string): number {
  const parse = (value: string) => {
    const match = value.match(/^(\d+)([a-z]*)$/i);
    if (!match) return { num: 999, suffix: value.toLowerCase() };
    return { num: Number.parseInt(match[1], 10), suffix: (match[2] || '').toLowerCase() };
  };
  const left = parse(a);
  const right = parse(b);
  if (left.num !== right.num) return left.num - right.num;
  return left.suffix.localeCompare(right.suffix);
}

const COMPLAINT_CHIP_PROCEDURE_TAGS: Record<string, string[]> = {
  wont_spin: ['spin_issue', 'motor_check', 'door_lock_check', 'wont_spin'],
  wont_agitate: ['spin_issue', 'motor_check'],
  wont_drain: ['drain_issue', 'pump_check', 'wont_drain'],
  lid_lock: ['door_lock_check', 'lid_lock', 'F5E1', 'F5E2', 'F5E3'],
  no_heat: ['heating_element_check', 'F4E1', 'F4E2', 'no_heat', 'dry_heat', 'thermistor'],
  no_fill: ['water_valve_check', 'fill_issue', 'no_fill', 'F8E1'],
  vibration: ['motor_check'],
  noisy: ['motor_check', 'pump_check', 'vent_fan_check'],
  error_code: ['error_code', 'F3E1', 'F8E1', 'F4E1', 'voltage_check', 'hmi_check', 'supply_issue'],
  hmi_check: ['hmi_check', 'error_code', 'F3E1'],
  dispenser_check: ['dispenser_check', 'fill_issue'],
  vent_fan_check: ['vent_fan_check', 'noisy', 'dry_heat'],
};

const UI_VARIANT_LABELS: Record<ServiceModeUiVariant, string> = {
  console: 'Console',
  lcd_in_door: 'LCD in door',
  any: 'Any UI',
};

function collectComponents(
  intelligence?: DiagnosticIntelligenceResult | null,
): ComponentEvidenceScore[] {
  if (!intelligence?.componentsByCategory) return [];
  return Object.values(intelligence.componentsByCategory).flat();
}

function buildReason(
  procedure: ServiceProcedure,
  components: ComponentEvidenceScore[],
  complaintChipIds: string[],
  matchedErrorCodes: string[],
): string {
  if (matchedErrorCodes.length) {
    const codeLabel = matchedErrorCodes.join(', ');
    return `Fault code ${codeLabel} maps to ${procedure.title} on this platform.`;
  }

  const matchedComponents = procedure.componentIds
    .map((id) => components.find((item) => item.id === id))
    .filter(Boolean) as ComponentEvidenceScore[];

  const confirmed = matchedComponents.find((item) => item.state === 'confirmed');
  if (confirmed) {
    return `${confirmed.label} is a leading suspect — OEM test available for this platform.`;
  }

  const suspected = matchedComponents.find((item) => item.evidence > 0);
  if (suspected) {
    return `${suspected.label} is under investigation — run the matching OEM procedure.`;
  }

  const chipLabels = complaintChipIds.filter((chip) => COMPLAINT_CHIP_PROCEDURE_TAGS[chip]);
  if (chipLabels.length) {
    return `Complaint pattern matches ${procedure.title} on this platform.`;
  }

  return `OEM service procedure available for ${procedure.source.manualId} on this unit.`;
}

function scoreProcedure(
  procedure: ServiceProcedure,
  components: ComponentEvidenceScore[],
  complaintChipIds: string[],
  errorCodes: string[],
  procedureRuns: Record<string, ProcedureRunState>,
): number {
  const saved = procedureRuns[procedure.id];
  if (saved?.status === 'in_progress') return 100;
  if (saved?.status === 'completed') return 80;

  let score = 0;

  const matchedErrorCodes = procedureMatchesErrorCode(procedure.tags, errorCodes);
  score += matchedErrorCodes.length * 35;

  for (const componentId of procedure.componentIds) {
    const component = components.find((item) => item.id === componentId);
    if (!component) continue;
    if (component.state === 'confirmed') score += 40;
    else if (component.evidence > 0) score += 25;
  }

  for (const chip of complaintChipIds) {
    const tags = COMPLAINT_CHIP_PROCEDURE_TAGS[chip] || [];
    if (tags.some((tag) => procedure.tags?.includes(tag))) {
      score += 20;
    }
  }

  for (const tag of procedure.tags || []) {
    if (complaintChipIds.includes(tag)) score += 15;
  }

  return score;
}

export function formatServiceModeRequirements(procedure: ServiceProcedure): string[] {
  const badges: string[] = [];
  const seenKinds = new Set<string>();

  for (const ref of procedure.serviceModePlan || []) {
    if (seenKinds.has(ref.modeKind)) continue;
    seenKinds.add(ref.modeKind);
    badges.push(SERVICE_MODE_KIND_LABELS[ref.modeKind] || ref.modeKind);
  }

  const uiVariants = new Set<ServiceModeUiVariant>();
  for (const ref of procedure.serviceModePlan || []) {
    const bundle = getServiceModeBundle(ref.bundleId);
    for (const variant of bundle?.uiVariants || []) {
      if (variant !== 'any') uiVariants.add(variant);
    }
  }

  if (uiVariants.size) {
    badges.push(
      [...uiVariants].map((variant) => UI_VARIANT_LABELS[variant] || variant).join(' or '),
    );
  }

  return badges;
}

export function listServiceProcedureCatalog({
  templateId,
  measurementContext,
}: Pick<RecommendServiceProceduresInput, 'templateId' | 'measurementContext'>): ProcedureRecommendation[] {
  const platformId = resolvePlatformIdFromModel(measurementContext || { templateId: templateId || '' });
  if (!platformId) return [];

  return getServiceProceduresForPlatform(platformId)
    .filter((procedure) => isProcedureAllowedForTemplate(procedure, templateId))
    .map((procedure) => ({
      procedureId: procedure.id,
      procedure,
      reason: '',
      priority: 0,
    }))
    .sort((a, b) =>
      compareOemTestNumber(a.procedure.source.oemTestNumber, b.procedure.source.oemTestNumber),
    );
}

export function recommendServiceProcedures({
  templateId,
  measurementContext,
  intelligence,
  complaintChipIds = [],
  errorCodes = [],
  procedureRuns = {},
}: RecommendServiceProceduresInput): ProcedureRecommendation[] {
  const platformId = resolvePlatformIdFromModel(measurementContext || { templateId: templateId || '' });
  if (!platformId) return [];

  const components = collectComponents(intelligence);
  const minScore = 20;

  return getServiceProceduresForPlatform(platformId)
    .filter((procedure) => isProcedureAllowedForTemplate(procedure, templateId))
    .map((procedure) => {
      const matchedErrorCodes = procedureMatchesErrorCode(procedure.tags, errorCodes);
      const priority = scoreProcedure(
        procedure,
        components,
        complaintChipIds,
        errorCodes,
        procedureRuns,
      );
      return {
        procedureId: procedure.id,
        procedure,
        reason: buildReason(procedure, components, complaintChipIds, matchedErrorCodes),
        priority,
        matchedErrorCodes: matchedErrorCodes.length ? matchedErrorCodes : undefined,
      };
    })
    .filter(
      (item) => item.priority >= minScore || Boolean(procedureRuns[item.procedureId]),
    )
    .sort((a, b) => b.priority - a.priority);
}
