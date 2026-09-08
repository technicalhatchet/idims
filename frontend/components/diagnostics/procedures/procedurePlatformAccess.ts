import { PLATFORM_RULES } from '../knowledge/platformRegistry';
import type { ServiceProcedure } from './types';

/** Gate procedures by diagnostic template via platformRegistry — no per-manual allowlists. */
export function isProcedureAllowedForTemplate(
  procedure: Pick<ServiceProcedure, 'platformId'> | null | undefined,
  templateId: string | null | undefined,
): boolean {
  if (!procedure?.platformId || !templateId) return false;
  const platformRules = PLATFORM_RULES.filter((rule) => rule.id === procedure.platformId);
  if (!platformRules.length) return false;
  return platformRules.some((rule) => rule.templateId === templateId);
}
