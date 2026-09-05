import { DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../constants/dmaCodes';
import { formatCodeListLabels } from '../../utils/dmaListField';

/** Best available symptom / system label for outcome & memory list cards. */
export function getRepairRecordCategoryLabel(item) {
  if (!item) return null;
  if (item.problem_code) {
    const label = formatCodeListLabels(DMA_PROBLEM_CODES, item.problem_code);
    if (label) return label;
  }
  if (item.resolution_code) {
    const label = formatCodeListLabels(DMA_RESOLUTION_CODES, item.resolution_code);
    if (label) return label;
  }
  const tag = item.tags?.[0];
  return tag?.label || tag?.name || null;
}
