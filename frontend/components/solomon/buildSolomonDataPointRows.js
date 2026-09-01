import { buildTestsForTemplate } from '../diagnostics/intelligence/buildTestCatalogForTemplate';
import { getFieldKnowledgeId } from '../diagnostics/knowledge/fieldBindings';
import { buildFieldLabelsForTemplate } from '../diagnostics/intelligence/fieldLabels';

export const SOLOMON_DATA_POINT_STATUS = {
  pending: 'pending',
  observed: 'observed',
  measured: 'measured',
  unresolved: 'unresolved',
};

export const SOLOMON_DATA_POINT_STATUS_LABELS = {
  [SOLOMON_DATA_POINT_STATUS.pending]: 'Pending',
  [SOLOMON_DATA_POINT_STATUS.observed]: 'Observed',
  [SOLOMON_DATA_POINT_STATUS.measured]: 'Measured',
  [SOLOMON_DATA_POINT_STATUS.unresolved]: 'Unresolved',
};

function isFilled(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return true;
  return String(value).trim() !== '';
}

function formatDisplayValue(value) {
  if (!isFilled(value)) return null;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value).trim();
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

function resolveDataPointStatus({ templateId, fieldKey, rawValue, measurementStatuses }) {
  if (!isFilled(rawValue)) return SOLOMON_DATA_POINT_STATUS.pending;

  const knowledgeId = getFieldKnowledgeId(templateId, fieldKey);
  if (!knowledgeId) return SOLOMON_DATA_POINT_STATUS.observed;

  const evaluation = measurementStatuses?.get?.(knowledgeId);
  if (evaluation?.status === 'warning' || evaluation?.status === 'critical') {
    return SOLOMON_DATA_POINT_STATUS.unresolved;
  }
  if (evaluation) return SOLOMON_DATA_POINT_STATUS.measured;
  return SOLOMON_DATA_POINT_STATUS.observed;
}

const STATUS_SORT_ORDER = {
  [SOLOMON_DATA_POINT_STATUS.unresolved]: 0,
  [SOLOMON_DATA_POINT_STATUS.measured]: 1,
  [SOLOMON_DATA_POINT_STATUS.observed]: 2,
  [SOLOMON_DATA_POINT_STATUS.pending]: 3,
};

/**
 * Build data-point rows for Solomon session panels.
 * @param {object} args
 * @param {string} args.templateId
 * @param {Record<string, unknown>} [args.fields]
 * @param {Map<string, import('../diagnostics/knowledge/types').MeasurementEvaluation>} [args.measurementStatuses]
 * @param {string[]} [args.visitedStepKeys]
 * @param {number} [args.limit]
 */
export function buildSolomonDataPointRows({
  templateId,
  fields = {},
  measurementStatuses,
  visitedStepKeys = [],
  limit,
}) {
  if (!templateId) return [];

  const tests = buildTestsForTemplate(templateId);
  const labels = buildFieldLabelsForTemplate(templateId);
  const visited = new Set(visitedStepKeys);

  const rows = tests.map((test) => {
    const rawValue = fields[test.fieldKey];
    const status = resolveDataPointStatus({
      templateId,
      fieldKey: test.fieldKey,
      rawValue,
      measurementStatuses,
    });

    return {
      id: test.fieldKey,
      label: labels[test.fieldKey] || test.label,
      stepKey: test.wizardStepKey,
      status,
      value: formatDisplayValue(rawValue),
      isVisited: visited.has(test.wizardStepKey),
    };
  });

  const sorted = rows.sort((a, b) => {
    const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (a.isVisited !== b.isVisited) return a.isVisited ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return limit ? sorted.slice(0, limit) : sorted;
}
