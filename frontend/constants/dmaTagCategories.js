export const DMA_TAG_CATEGORY_ORDER = ['system', 'symptom', 'failure', 'action', 'confidence'];

export const DMA_TAG_CATEGORY_LABELS = {
  system: 'System',
  symptom: 'Symptom',
  failure: 'Failure type',
  action: 'Repair action',
  confidence: 'Confidence',
};

export function groupTagsByCategory(tags = []) {
  const buckets = Object.fromEntries(DMA_TAG_CATEGORY_ORDER.map((key) => [key, []]));
  const other = [];

  for (const tag of tags) {
    const category = tag?.category;
    if (category && buckets[category]) {
      buckets[category].push(tag);
    } else {
      other.push(tag);
    }
  }

  const groups = DMA_TAG_CATEGORY_ORDER
    .map((key) => ({ key, label: DMA_TAG_CATEGORY_LABELS[key], tags: buckets[key] }))
    .filter((group) => group.tags.length > 0);

  if (other.length) {
    groups.push({ key: 'other', label: 'Other', tags: other });
  }

  return groups;
}
