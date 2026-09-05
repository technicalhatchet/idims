/**
 * Maytag model number prefixes → Whirlpool equivalent for platform pattern matching.
 * Same OEM hardware; manuals and measurements are shared. Longest prefix first.
 */
export const MAYTAG_TO_WHIRLPOOL_MODEL_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['MHWE', 'WFW'], // Duet Sport / Maxima front-load washer
  ['MED', 'WED'], // electric dryer
  ['MGD', 'WGD'], // gas dryer
  ['MDB', 'WDT'], // ACU dishwasher (same W10751166 platform as WDT/KDT)
  ['MFF', 'WRF'], // French door refrigerator
  ['MFI', 'WRF'],
  ['MFT', 'WRF'],
  ['MFW', 'WRF'],
  ['MRT', 'WRT'], // top-mount refrigerator (also matched directly on some rules)
  ['MHW', 'WFW'], // front-load washer (FL DD and overlapping eras)
  ['MER', 'WFE'], // freestanding electric range (platform TBD — WFE550* manual queue)
  ['MGR', 'WFG'], // freestanding gas range (platform TBD — WFG550* manual queue)
];

/** Model strings to test against platform modelPatterns (original + OEM rebadge variants). */
export function expandOemModelVariants(
  make: string | null | undefined,
  model: string | null | undefined,
): string[] {
  const trimmed = String(model || '').trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  if (String(make || '').trim().toLowerCase() !== 'maytag') return [...variants];

  const upper = trimmed.toUpperCase();
  for (const [from, to] of MAYTAG_TO_WHIRLPOOL_MODEL_PREFIXES) {
    if (upper.startsWith(from)) {
      variants.add(to + trimmed.slice(from.length));
    }
  }
  return [...variants];
}
