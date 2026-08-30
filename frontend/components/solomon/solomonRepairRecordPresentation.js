import { DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../constants/dmaCodes';

/** Best available symptom / system label for outcome & memory list cards. */
export function getRepairRecordCategoryLabel(item) {
  if (!item) return null;
  if (item.problem_code && DMA_PROBLEM_CODES[item.problem_code]) {
    return DMA_PROBLEM_CODES[item.problem_code];
  }
  if (item.resolution_code && DMA_RESOLUTION_CODES[item.resolution_code]) {
    return DMA_RESOLUTION_CODES[item.resolution_code];
  }
  const tag = item.tags?.[0];
  return tag?.label || tag?.name || null;
}
