import { apiClient } from '../../utils/api-client';

function toDateParam(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
  return String(value);
}

export async function createCalendarBlock(payload) {
  return apiClient('scheduling/calendar-blocks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCalendarBlock(blockId, payload) {
  return apiClient(`scheduling/calendar-blocks/${blockId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCalendarBlock(blockId) {
  return apiClient(`scheduling/calendar-blocks/${blockId}`, { method: 'DELETE' });
}

export async function cancelCalendarBlock(blockId) {
  return apiClient(`scheduling/calendar-blocks/${blockId}/cancel`, { method: 'POST' });
}

export async function listCalendarBlocks({ startDate, endDate, technicianId }) {
  const params = new URLSearchParams();
  params.append('start_date', toDateParam(startDate));
  params.append('end_date', toDateParam(endDate));
  if (technicianId) params.append('technician_id', technicianId);
  return apiClient(`scheduling/calendar-blocks?${params.toString()}`);
}
