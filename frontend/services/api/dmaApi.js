import { apiClient } from '../../utils/api-client';

export async function getDmaCodes() {
  return apiClient('dma/codes');
}

export async function getDmaTags() {
  return apiClient('dma/tags');
}

export async function getDmaSuggestions(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return apiClient(`dma/suggestions${qs ? `?${qs}` : ''}`);
}

export async function searchDmaErrorCodes(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return apiClient(`dma/error-codes/search${qs ? `?${qs}` : ''}`);
}

export async function getDmaErrorCode(referenceId) {
  return apiClient(`dma/error-codes/${referenceId}`);
}

export async function searchDmaRepairs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'tags' && Array.isArray(value)) {
      value.filter(Boolean).forEach((tag) => query.append('tags', tag));
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  return apiClient(`dma/search${qs ? `?${qs}` : ''}`);
}

export async function getDmaEvidenceNudges({
  equipmentSubtype,
  equipmentMake = null,
  tags = [],
  excludeWorkOrderId = null,
} = {}) {
  const subtype = String(equipmentSubtype || '').trim();
  const tagList = (Array.isArray(tags) ? tags : []).map((tag) => String(tag).trim()).filter(Boolean);
  if (!subtype || !tagList.length) {
    return { equipment_subtype: subtype || null, nudges: [] };
  }

  const params = new URLSearchParams();
  params.set('equipment_subtype', subtype);
  if (equipmentMake) params.set('equipment_make', String(equipmentMake));
  tagList.forEach((tag) => params.append('tags', tag));
  if (excludeWorkOrderId) {
    params.set('exclude_work_order_id', String(excludeWorkOrderId));
  }

  return apiClient(`dma/evidence-nudges?${params.toString()}`);
}

export async function getDmaPatternReport(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'tags' && Array.isArray(value)) {
      value.filter(Boolean).forEach((tag) => query.append('tags', tag));
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  return apiClient(`dma/pattern-report${qs ? `?${qs}` : ''}`);
}

export async function getWorkOrderDmaOutcome(workOrderId) {
  return apiClient(`dma/work-orders/${workOrderId}`);
}

export async function getWorkOrderOutcomeStatus(workOrderId) {
  return apiClient(`dma/work-orders/${workOrderId}/outcome-status`);
}

export async function createDmaRepairRecord(body) {
  return apiClient('dma/records', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getDmaRepairRecord(recordId) {
  return apiClient(`dma/records/${recordId}`);
}

export async function updateDmaRepairRecord(recordId, body) {
  return apiClient(`dma/records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteDmaRepairRecord(recordId) {
  return apiClient(`dma/records/${recordId}`, {
    method: 'DELETE',
  });
}

export async function moderateDmaRepairRecord(recordId, body) {
  return apiClient(`dma/records/${recordId}/moderate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function importDmaRecordToWorkOrder(recordId, workOrderId) {
  return apiClient(`dma/records/${recordId}/import-to-work-order/${workOrderId}`, {
    method: 'POST',
  });
}

function dmaDiagnosticsQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export async function listDmaStandaloneDiagnostics(params = {}) {
  const qs = dmaDiagnosticsQuery(params);
  return apiClient(`dma/diagnostics${qs ? `?${qs}` : ''}`);
}

export async function createDmaStandaloneDiagnostic(body) {
  return apiClient('dma/diagnostics', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getDmaStandaloneDiagnostic(diagnosticId) {
  return apiClient(`dma/diagnostics/${diagnosticId}`);
}

export async function updateDmaStandaloneDiagnostic(diagnosticId, body) {
  return apiClient(`dma/diagnostics/${diagnosticId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteDmaStandaloneDiagnostic(diagnosticId) {
  return apiClient(`dma/diagnostics/${diagnosticId}`, {
    method: 'DELETE',
  });
}

export async function linkDmaDiagnosticToOutcome(diagnosticId, outcomeId) {
  return apiClient(`dma/diagnostics/${diagnosticId}/link-outcome/${outcomeId}`, {
    method: 'POST',
  });
}

export async function unlinkDmaDiagnosticFromOutcome(diagnosticId) {
  return apiClient(`dma/diagnostics/${diagnosticId}/unlink-outcome`, {
    method: 'POST',
  });
}

export async function importDmaDiagnosticToWorkOrder(diagnosticId, workOrderId) {
  return apiClient(`dma/diagnostics/${diagnosticId}/import-to-work-order/${workOrderId}`, {
    method: 'POST',
  });
}
