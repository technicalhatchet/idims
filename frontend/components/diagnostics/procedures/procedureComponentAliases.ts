import componentAliasConfig from '../knowledge/canonical/component_aliases.json';
import { getPlatformRule } from '../knowledge/platformRegistry';
import type { DiagnosticEffect } from './types';

type AliasMap = Record<string, string>;

const DISPLAY_LABELS: Record<string, string> = componentAliasConfig.displayLabels ?? {};
const TEMPLATE_ALIASES: Record<string, AliasMap> = componentAliasConfig.templateAliases ?? {};
const PLATFORM_ALIASES: Record<string, AliasMap> = componentAliasConfig.platformAliases ?? {};
const PROCEDURE_ALIASES: Record<string, AliasMap> = componentAliasConfig.procedureAliases ?? {};

export interface ProcedureComponentAliasContext {
  platformId?: string | null;
  templateId?: string | null;
  procedureId?: string | null;
}

function resolveTemplateId(context: ProcedureComponentAliasContext): string | null {
  if (context.templateId) return context.templateId;
  if (!context.platformId) return null;
  return getPlatformRule(context.platformId)?.templateId ?? null;
}

/**
 * Map a procedure seed componentId to the evidence-graph componentId used for scoring.
 * Seed ids (e.g. Samsung `main_control`, `inverter`) are preserved in procedure JSON.
 */
export function resolveProcedureComponentForEvidence(
  componentId: string,
  context: ProcedureComponentAliasContext,
): string {
  const procedureId = context.procedureId;
  if (procedureId && PROCEDURE_ALIASES[procedureId]?.[componentId]) {
    return PROCEDURE_ALIASES[procedureId][componentId];
  }

  const platformId = context.platformId;
  if (platformId && PLATFORM_ALIASES[platformId]?.[componentId]) {
    return PLATFORM_ALIASES[platformId][componentId];
  }

  const templateId = resolveTemplateId(context);
  if (templateId && TEMPLATE_ALIASES[templateId]?.[componentId]) {
    return TEMPLATE_ALIASES[templateId][componentId];
  }

  return componentId;
}

/** Tech-facing label for a procedure seed componentId (preferred over canonical evidence label). */
export function procedureComponentDisplayLabel(componentId: string): string {
  return DISPLAY_LABELS[componentId] ?? componentId;
}

export function resolveDiagnosticEffectForEvidence(
  effect: DiagnosticEffect,
  context: ProcedureComponentAliasContext,
): DiagnosticEffect {
  const resolvedId = resolveProcedureComponentForEvidence(effect.componentId, context);
  if (resolvedId === effect.componentId) return effect;
  return { ...effect, componentId: resolvedId };
}

export function resolveProcedureComponentIdsForEvidence(
  componentIds: string[],
  context: ProcedureComponentAliasContext,
): string[] {
  return componentIds.map((id) => resolveProcedureComponentForEvidence(id, context));
}
