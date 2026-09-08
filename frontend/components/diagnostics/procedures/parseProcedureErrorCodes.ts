import { getDiagnosticMatchText } from '../routing/routingEngine';

/** Whirlpool-style F-codes and MCE-era two-digit codes from free text. */
const ERROR_CODE_PATTERN =
  /\bF[\s-]*(\d{1,2})(?:[\s-]*E[\s-]*(\d{1,2}))?\b|\b(?:SD|SU)\b/gi;

function canonicalizeErrorCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase().replace(/\s+/g, '');
  if (upper === 'SD' || upper === 'SU') return 'Sd';

  const fMatch = upper.match(/^F(\d{1,2})(?:E(\d{1,2}))?$/);
  if (!fMatch) return null;

  const major = fMatch[1];
  const minor = fMatch[2];
  if (minor) return `F${major}E${minor}`;
  return `F${major}`;
}

/** Extract normalized fault codes for procedure tag matching (e.g. F21, F7E2, Sd). */
export function parseProcedureErrorCodes(text: string): string[] {
  const source = String(text || '');
  const found = new Set<string>();

  let match: RegExpExecArray | null;
  const pattern = new RegExp(ERROR_CODE_PATTERN.source, ERROR_CODE_PATTERN.flags);
  while ((match = pattern.exec(source)) !== null) {
    const token = match[0];
    if (/^s[du]$/i.test(token)) {
      found.add('Sd');
      continue;
    }
    const major = match[1];
    const minor = match[2];
    const canonical = minor ? `F${major}E${minor}` : `F${major}`;
    const normalized = canonicalizeErrorCode(canonical);
    if (normalized) found.add(normalized);
  }

  return [...found];
}

export function getErrorCodesFromDiagnosticFields(
  fields: Record<string, unknown> = {},
): string[] {
  return parseProcedureErrorCodes(getDiagnosticMatchText(fields));
}

export function normalizeProcedureErrorCodeTag(tag: string): string | null {
  if (!tag) return null;
  if (/^sd$/i.test(tag)) return 'Sd';
  return canonicalizeErrorCode(tag);
}

export function procedureMatchesErrorCode(
  procedureTags: string[] | undefined,
  errorCodes: string[],
): string[] {
  if (!procedureTags?.length || !errorCodes.length) return [];

  const normalizedTags = new Set(
    procedureTags
      .map((tag) => normalizeProcedureErrorCodeTag(tag))
      .filter(Boolean) as string[],
  );

  return errorCodes.filter((code) => normalizedTags.has(code));
}
