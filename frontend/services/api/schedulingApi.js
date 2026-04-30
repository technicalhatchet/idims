import { apiClient } from '../../utils/api-client';

function toDateParam(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0];
  }
  return String(value);
}

/**
 * GET /api/scheduling/schedule — calendar / list view data for a date range.
 *
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string} [technicianId]
 * @param {string} [clientId]
 * @param {string} [viewType] — day | week | month | list
 */
export async function getSchedule(
  startDate,
  endDate,
  technicianId,
  clientId,
  viewType = 'day'
) {
  if (!startDate || !endDate) {
    throw new Error('getSchedule requires startDate and endDate');
  }
  const params = new URLSearchParams();
  params.append('start_date', toDateParam(startDate));
  params.append('end_date', toDateParam(endDate));
  params.append('view_type', viewType || 'day');
  if (technicianId) params.append('technician_id', technicianId);
  if (clientId) params.append('client_id', clientId);
  // Use combined endpoint — queries WorkOrderAppointment dates, not work order level dates
  return apiClient(`scheduling/schedule/combined?${params.toString()}`);
}

/**
 * POST /api/scheduling/schedule — assign times / technician on a work order.
 *
 * @param {string} workOrderId — UUID
 * @param {string|Date} startTime — ISO datetime
 * @param {string|Date} endTime — ISO datetime
 * @param {string} [technicianId]
 * @param {string} [notes]
 */
export async function scheduleAppointment(
  workOrderId,
  startTime,
  endTime,
  technicianId,
  notes
) {
  const start =
    startTime instanceof Date ? startTime.toISOString() : startTime;
  const end = endTime instanceof Date ? endTime.toISOString() : endTime;
  return apiClient('scheduling/schedule', {
    method: 'POST',
    body: JSON.stringify({
      work_order_id: workOrderId,
      start_time: start,
      end_time: end,
      technician_id: technicianId || null,
      notes: notes || null,
    }),
  });
}

/**
 * GET /api/scheduling/schedule/available-slots
 *
 * @param {Date|string} date — day to search (YYYY-MM-DD or Date)
 * @param {string} [technicianId]
 * @param {number} [durationMinutes]
 */
export async function getAvailableSlots(date, technicianId, durationMinutes = 60) {
  if (!date) {
    throw new Error('getAvailableSlots requires date');
  }
  const params = new URLSearchParams();
  params.append('date', toDateParam(date));
  params.append('duration_minutes', String(durationMinutes ?? 60));
  if (technicianId) params.append('technician_id', technicianId);
  return apiClient(`scheduling/schedule/available-slots?${params.toString()}`);
}

/**
 * Preview bookable slots without creating a work order.
 * Uses GET /api/scheduling/appointment-preview-slots (conflicts from WorkOrderAppointment rows).
 *
 * @param {Object} opts
 * @param {string} opts.date - YYYY-MM-DD
 * @param {string} [opts.technicianId]
 * @param {number} [opts.durationMinutes]
 * @param {string[]} [opts.serviceIds] - if set, duration = sum of service duration_minutes
 */
export async function getAppointmentPreviewSlots(opts = {}) {
  const { date, technicianId, durationMinutes, serviceIds } = opts;
  if (!date) {
    throw new Error('date is required (YYYY-MM-DD)');
  }
  const params = new URLSearchParams();
  params.append('date', date);
  if (technicianId) {
    params.append('technician_id', technicianId);
  }
  if (durationMinutes != null && durationMinutes !== '') {
    params.append('duration_minutes', String(durationMinutes));
  }
  if (serviceIds && serviceIds.length > 0) {
    serviceIds.forEach((id) => params.append('service_ids', id));
  }
  return apiClient(`scheduling/appointment-preview-slots?${params.toString()}`);
}
