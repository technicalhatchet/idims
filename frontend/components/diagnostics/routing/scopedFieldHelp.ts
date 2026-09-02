/** Brand/make-scoped field help helpers. Prefer makeWhen for OEM tips until all platforms are covered. */
import type { MeasurementContext, MeasurementEvaluation } from '../knowledge/types';
import { ruleWhenMatches } from './conditionMatcher';
import { getComplaintChipIds, getDiagnosticMatchText } from './routingEngine';
import type { FieldHelpEntry, RoutingWhenClause } from './types';

export function makeWhen(make: string): RoutingWhenClause {
  return { type: 'make', match: make };
}

export function platformWhen(id: string): RoutingWhenClause {
  return { type: 'platform', id };
}

/** All nested clauses must match (AND). */
export function allWhen(...clauses: RoutingWhenClause[]): RoutingWhenClause {
  return { type: 'all', clauses };
}

export function scopedHelp(
  variants: Array<{ when: RoutingWhenClause[]; text: string }>,
  fallback?: string,
): FieldHelpEntry {
  return { default: fallback, variants };
}

export function resolveFieldHelp(
  fieldKey: string,
  fieldHelp: Record<string, FieldHelpEntry> | undefined,
  fields: Record<string, unknown> = {},
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  measurementContext?: MeasurementContext | null,
): string | null {
  const entry = fieldHelp?.[fieldKey];
  if (!entry) return null;

  if (typeof entry === 'string') {
    const text = entry.trim();
    return text || null;
  }

  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getDiagnosticMatchText(fields);

  for (const variant of entry.variants || []) {
    if (
      ruleWhenMatches(
        variant.when,
        complaintChipIds,
        complaintText,
        fields,
        measurementStatuses,
        measurementContext,
      )
    ) {
      const text = variant.text.trim();
      if (text) return text;
    }
  }

  const fallback = entry.default?.trim();
  return fallback || null;
}
