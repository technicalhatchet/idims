import { getPlatformRule } from '../knowledge/platformRegistry';
import type { ServiceProcedure } from './types';

/** Gate procedures by diagnostic template via platformRegistry — no per-manual allowlists. */
export function isProcedureAllowedForTemplate(
  procedure: Pick<ServiceProcedure, 'platformId'> | null | undefined,
  templateId: string | null | undefined,
): boolean {
  if (!procedure?.platformId || !templateId) return false;
  const platformRule = getPlatformRule(procedure.platformId);
  if (!platformRule) return false;
  return platformRule.templateId === templateId;
}
