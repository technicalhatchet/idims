/**
 * CG-RANGE-IMPLEMENTATION-GATE — canonical ontology alias registry.
 * electric_range is a legacy compatibility id only; range_oven is the organizational primary.
 * CG-10 freeze lock and electric_range.json remain the immutable historical record.
 */
export const PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID = 'range_oven';

/** Legacy ontology ids that resolve to a primary canonical id (not separate ontologies). */
export const CANONICAL_ONTOLOGY_LEGACY_ALIASES: Readonly<Record<string, string>> = {
  electric_range: PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID,
};

/** Implementation wizard / platform template ids that share the range_oven functional contract. */
export const RANGE_IMPLEMENTATION_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  'electric_range',
  'gas_range',
  'induction_range',
  'dual_fuel_range',
]);

export function isRangeImplementationTemplateId(
  templateId: string | null | undefined,
): boolean {
  return Boolean(templateId && RANGE_IMPLEMENTATION_TEMPLATE_IDS.has(templateId));
}

export function resolvePrimaryCanonicalOntologyId(
  ontologyOrAliasId: string | null | undefined,
): string | null {
  if (!ontologyOrAliasId) return null;
  return CANONICAL_ONTOLOGY_LEGACY_ALIASES[ontologyOrAliasId] ?? ontologyOrAliasId;
}
