import { apiClient } from '../../utils/api-client';

export async function previewRouteOptimization({ technicianId, scheduleDate, dayStartHour = 8 }) {
  return apiClient('api/scheduling/route-optimize/preview', {
    method: 'POST',
    body: JSON.stringify({
      technician_id: technicianId,
      schedule_date: scheduleDate,
      day_start_hour: dayStartHour,
    }),
  });
}

export async function applyRouteOptimization({ technicianId, scheduleDate, changes }) {
  return apiClient('api/scheduling/route-optimize/apply', {
    method: 'POST',
    body: JSON.stringify({
      technician_id: technicianId,
      schedule_date: scheduleDate,
      changes,
    }),
  });
}
