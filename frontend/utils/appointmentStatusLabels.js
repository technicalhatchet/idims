export {
  REPAIR_COMPLETE_APPOINTMENT_STATUSES,
  hasCompletedRepairAppointment,
  hasCompletedVisitWithRepairSku,
} from './visitSku';

/** Display labels for appointment_status_enum values (DB value unchanged). */
export const APPOINTMENT_STATUS_LABELS = {
  scheduled: 'Scheduled',
  reschedule: 'Needs Reschedule',
  completed: 'Completed',
  canceled: 'Canceled',
  phone_payment: 'Phone Payment',
  refund: 'Refund',
  en_route: 'En Route',
  in_progress: 'In Progress',
  completed_pending_payment: 'Completed — Pending Payment',
  unreachable: 'Unreachable',
  failed: 'APR',
  redo: 'Redo',
  refund: 'Refund',
};

export const APPOINTMENT_STATUS_DESCRIPTIONS = {
  failed: 'Additional Parts Required',
};

export function formatAppointmentStatus(status, { long = false } = {}) {
  if (!status) return 'Unknown';
  const key = String(status).toLowerCase();
  if (long && key === 'failed') {
    return 'APR (Additional Parts Required)';
  }
  if (APPOINTMENT_STATUS_LABELS[key]) {
    return APPOINTMENT_STATUS_LABELS[key];
  }
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
