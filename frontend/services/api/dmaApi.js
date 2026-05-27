import { apiClient } from '../../utils/api-client';

export async function getDmaCodes() {
  return apiClient('dma/codes');
}

export async function searchDmaRepairs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return apiClient(`dma/search${qs ? `?${qs}` : ''}`);
}

export async function getWorkOrderDmaOutcome(workOrderId) {
  return apiClient(`dma/work-orders/${workOrderId}`);
}
