import type { EvidenceConfig, EvidenceRule } from './evidenceTypes';

/** Collect DMA tag slugs relevant to the current live evidence session. */
export function collectActiveDmaTags(
  config: EvidenceConfig | null | undefined,
  matchedRules: EvidenceRule[],
): string[] {
  if (!config) return [];

  const tags = new Set<string>();
  for (const rule of matchedRules) {
    for (const tag of rule.dmaTags || []) {
      if (tag) tags.add(tag);
    }
    if (rule.targetLayer === 'category') {
      const category = config.categories.find((entry) => entry.id === rule.target);
      for (const tag of category?.dmaTags || []) {
        if (tag) tags.add(tag);
      }
    }
    if (rule.targetLayer === 'component') {
      const component = config.components?.find((entry) => entry.id === rule.target);
      for (const tag of component?.dmaTags || []) {
        if (tag) tags.add(tag);
      }
    }
  }
  return [...tags];
}
