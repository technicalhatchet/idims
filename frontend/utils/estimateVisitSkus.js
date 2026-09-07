import { isUnscheduledEstimateLine } from './workOrderBilling';
import { serviceIdsMatch } from './visitSku';

/** Work-order service lines on the estimate with no visit yet. */
export function getUnscheduledEstimateLines(workOrderServices) {
  return (workOrderServices || []).filter(isUnscheduledEstimateLine);
}

export function estimateLineCatalogId(line) {
  if (!line?.service_id) return null;
  return String(line.service_id);
}

/** Unique catalog SKU ids from estimate lines (for appointment service_ids). */
export function getEstimateCatalogIds(lines) {
  const ids = (lines || [])
    .map(estimateLineCatalogId)
    .filter(Boolean);
  return [...new Set(ids)];
}

export function formatEstimateLineSkuLabel(line, catalogServices = []) {
  const catalog = catalogServices.find((s) => serviceIdsMatch(s.id, line?.service_id));
  const name = line?.name || catalog?.name || 'Service';
  const sku = line?.service_definition?.sku_code || catalog?.sku_code || '';
  const price = Number(line?.price ?? line?.unit_price ?? catalog?.base_price ?? 0);
  const duration = catalog?.duration_minutes;
  const skuPart = sku ? ` (${sku})` : '';
  const durationPart = duration ? ` — ${duration} min` : '';
  return `${name}${skuPart}${durationPart} — $${price.toFixed(2)}`;
}

/** Merge catalog ids into an existing visit SKU list (deduped). */
export function mergeCatalogIdsIntoVisit(existingIds, catalogIdsToAdd) {
  const merged = [...(existingIds || []).map(String)];
  const seen = new Set(merged);
  for (const id of catalogIdsToAdd || []) {
    const key = String(id);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(key);
    }
  }
  return merged;
}

export function estimateLinesNotOnVisit(estimateLines, visitCatalogIds) {
  const onVisit = new Set((visitCatalogIds || []).map(String));
  return (estimateLines || []).filter((line) => {
    const catalogId = estimateLineCatalogId(line);
    return catalogId && !onVisit.has(catalogId);
  });
}
