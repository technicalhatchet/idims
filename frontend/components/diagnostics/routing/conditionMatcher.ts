import type { MeasurementEvaluation, MeasurementContext } from '../knowledge/types';
import { normalizeMake, resolvePlatformId } from '../knowledge/platformRegistry';
import type { RoutingWhenClause } from './types';

function normalizeText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function getFieldValue(fields: Record<string, unknown>, path: string): unknown {
  return fields?.[path];
}

function clauseMatches(
  clause: RoutingWhenClause,
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  measurementContext?: MeasurementContext | null,
): boolean {
  if (typeof clause === 'string') {
    const needle = normalizeText(clause);
    if (complaintChipIds.some((id) => normalizeText(id) === needle || normalizeText(id).includes(needle))) {
      return true;
    }
    return normalizeText(complaintText).includes(needle);
  }

  if (clause.type === 'chip') {
    return complaintChipIds.includes(clause.id);
  }

  if (clause.type === 'keyword') {
    return normalizeText(complaintText).includes(normalizeText(clause.match));
  }

  if (clause.type === 'field') {
    const actual = getFieldValue(fields, clause.path);
    if (typeof clause.equals === 'boolean') {
      return Boolean(actual) === clause.equals;
    }
    return normalizeText(actual) === normalizeText(clause.equals);
  }

  if (clause.type === 'measurement') {
    const evaluation = measurementStatuses?.get(clause.knowledgeId);
    if (!evaluation) return false;
    const allowed = clause.statusIn || (clause.status ? [clause.status] : []);
    return allowed.includes(evaluation.status);
  }

  if (clause.type === 'make') {
    const make = normalizeMake(measurementContext?.equipmentMake);
    return make === normalizeMake(clause.match);
  }

  if (clause.type === 'platform') {
    if (!measurementContext?.templateId) return false;
    return resolvePlatformId(measurementContext) === clause.id;
  }

  return false;
}

export function ruleWhenMatches(
  when: RoutingWhenClause[],
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  measurementContext?: MeasurementContext | null,
): boolean {
  if (!when?.length) return false;
  return when.some((clause) =>
    clauseMatches(
      clause,
      complaintChipIds,
      complaintText,
      fields,
      measurementStatuses,
      measurementContext,
    ),
  );
}

export function collectClauseTriggers(
  when: RoutingWhenClause[],
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  chipLabels: Record<string, string>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  measurementContext?: MeasurementContext | null,
): string[] {
  const triggers: string[] = [];
  for (const clause of when || []) {
    if (
      !clauseMatches(
        clause,
        complaintChipIds,
        complaintText,
        fields,
        measurementStatuses,
        measurementContext,
      )
    ) {
      continue;
    }
    if (typeof clause === 'string') {
      triggers.push(chipLabels[clause] || clause);
    } else if (clause.type === 'chip') {
      triggers.push(chipLabels[clause.id] || clause.id);
    } else if (clause.type === 'keyword') {
      triggers.push(`Complaint mentions "${clause.match}"`);
    } else if (clause.type === 'field') {
      triggers.push(`Answer: ${clause.path} = ${String(clause.equals)}`);
    } else if (clause.type === 'measurement') {
      const statuses = clause.statusIn || (clause.status ? [clause.status] : []);
      triggers.push(`Reading: ${clause.knowledgeId} = ${statuses.join('/')}`);
    }
  }
  return triggers;
}
