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

  return false;
}

export function ruleWhenMatches(
  when: RoutingWhenClause[],
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
): boolean {
  if (!when?.length) return false;
  return when.some((clause) => clauseMatches(clause, complaintChipIds, complaintText, fields));
}

export function collectClauseTriggers(
  when: RoutingWhenClause[],
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  chipLabels: Record<string, string>,
): string[] {
  const triggers: string[] = [];
  for (const clause of when || []) {
    if (!clauseMatches(clause, complaintChipIds, complaintText, fields)) continue;
    if (typeof clause === 'string') {
      triggers.push(chipLabels[clause] || clause);
    } else if (clause.type === 'chip') {
      triggers.push(chipLabels[clause.id] || clause.id);
    } else if (clause.type === 'keyword') {
      triggers.push(`Complaint mentions "${clause.match}"`);
    } else if (clause.type === 'field') {
      triggers.push(`Answer: ${clause.path} = ${String(clause.equals)}`);
    }
  }
  return triggers;
}
