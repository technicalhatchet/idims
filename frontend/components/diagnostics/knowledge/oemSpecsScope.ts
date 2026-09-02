import type { MeasurementContext } from './types';
import { normalizeMake, resolvePlatformIdFromModel } from './platformRegistry';
import {
  listLayeredFieldKeysForTemplate,
  resolveFieldKnowledgeId,
} from './resolveFieldKnowledge';

export function equipmentHasMakeAndModel(ctx: MeasurementContext): boolean {
  return Boolean(
    normalizeMake(ctx.equipmentMake) && String(ctx.equipmentModel || '').trim(),
  );
}

/** True when layered field knowledge resolves differently than the generic default. */
export function hasOemSpecificTolerances(ctx: MeasurementContext): boolean {
  if (!ctx.templateId || !equipmentHasMakeAndModel(ctx)) return false;

  const genericCtx: MeasurementContext = {
    templateId: ctx.templateId,
    equipmentMake: null,
    equipmentModel: null,
  };

  const keys = listLayeredFieldKeysForTemplate(ctx.templateId);
  for (const fieldKey of keys) {
    const genericId = resolveFieldKnowledgeId(ctx.templateId, fieldKey, genericCtx);
    const resolvedId = resolveFieldKnowledgeId(ctx.templateId, fieldKey, ctx);
    if (resolvedId && resolvedId !== genericId) return true;
  }

  return false;
}

export function buildOemSpecsToastMessage(ctx: MeasurementContext): string | null {
  if (!hasOemSpecificTolerances(ctx)) return null;

  const make = normalizeMake(ctx.equipmentMake);
  if (!make) return null;

  return `Tolerances updated for ${make}`;
}

/** Stable key for deduping toasts across debounced edits. */
export function oemSpecsScopeKey(ctx: MeasurementContext): string | null {
  if (!hasOemSpecificTolerances(ctx)) return null;

  const make = normalizeMake(ctx.equipmentMake);
  const model = String(ctx.equipmentModel || '').trim().toUpperCase();
  const platformId = resolvePlatformIdFromModel(ctx) || '';

  return `${ctx.templateId}|${make}|${model}|${platformId}`;
}
