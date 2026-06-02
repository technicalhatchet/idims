import StatusBadge from '../ui/StatusBadge';
import {
  formatWorkOrderDisplayScheduleRange,
  sortAppointmentsChronologically,
} from '../../utils/schedule-time';

function formatAppointmentType(type) {
  if (!type) return 'Appointment';
  const s = String(type).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WorkOrderDetailsAppointmentsList({ appointments = [] }) {
  const sorted = sortAppointmentsChronologically(appointments);

  if (!sorted.length) {
    return (
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center">
        <span className="mr-2 inline-block w-2 h-2 rounded-full bg-gray-400" />
        Not scheduled
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-2">
      {sorted.map((appointment) => {
        const timeLabel = formatWorkOrderDisplayScheduleRange({
          start: appointment.scheduled_start,
          end: appointment.scheduled_end,
        });
        return (
          <li
            key={appointment.id || `${appointment.scheduled_start}-${appointment.appointment_type}`}
            className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/60 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatAppointmentType(appointment.appointment_type)}
                  {appointment.services?.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-cyan-600 dark:text-cyan-400">
                      — {appointment.services.map((s) => s.name).join(', ')}
                    </span>
                  )}
                </p>
                {timeLabel && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{timeLabel}</p>
                )}
                {appointment.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic line-clamp-2">
                    {appointment.notes}
                  </p>
                )}
                {appointment.assigned_technician_id && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Technician: {appointment.technician_name || 'Unassigned'}
                  </p>
                )}
              </div>
              {appointment.status && (
                <div className="shrink-0">
                  <StatusBadge status={appointment.status} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
