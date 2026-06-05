import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FaRedo } from 'react-icons/fa';
import { format, parseISO } from 'date-fns';
import Button from '../ui/Button';
import WorkOrderRedoModal from './WorkOrderRedoModal';
import { getUserRole } from '../../utils/auth0-helpers';
import {
  canCreateRedoWorkOrder,
  getPendingRedoAppointments,
} from '../../utils/workOrderPermissions';

function visitLabel(appointment) {
  const type = appointment.appointment_type || 'visit';
  const when = appointment.scheduled_start
    ? format(parseISO(appointment.scheduled_start), 'MMM d, h:mm a')
    : 'unscheduled';
  return `${type} (${when})`;
}

export default function WorkOrderRedoBar({
  workOrder,
  workOrderId,
  user,
  onRefresh,
  variant = 'desktop',
  compact = false,
}) {
  const isMobile = variant === 'mobile';
  const [activeAppointment, setActiveAppointment] = useState(null);

  const role = useMemo(() => (user ? getUserRole(user) : null), [user]);
  const canCreate = canCreateRedoWorkOrder({ role });
  const pendingRedos = useMemo(
    () => getPendingRedoAppointments(workOrder),
    [workOrder]
  );
  const existingChildren = workOrder?.child_redo_work_orders || [];

  if (!pendingRedos.length && !existingChildren.length) {
    return null;
  }

  if (compact && canCreate && pendingRedos.length > 0) {
    const first = pendingRedos[0];
    return (
      <>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setActiveAppointment(first)}
          className="inline-flex items-center gap-1.5"
        >
          <FaRedo className="w-3 h-3" />
          Create redo
          {pendingRedos.length > 1 ? ` (${pendingRedos.length})` : ''}
        </Button>
        <WorkOrderRedoModal
          isOpen={Boolean(activeAppointment)}
          onClose={() => setActiveAppointment(null)}
          workOrderId={workOrderId}
          workOrder={workOrder}
          appointment={activeAppointment}
          onSuccess={onRefresh}
          variant={variant}
        />
      </>
    );
  }

  const shellClass = isMobile
    ? 'mb-4 rounded-xl border border-indigo-500/35 bg-[rgba(5,12,22,.88)] backdrop-blur-md p-4 space-y-3 shadow-[0_0_20px_rgba(99,102,241,.12)]'
    : 'mb-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 p-4 space-y-3';

  return (
    <>
      <div className={shellClass}>
        <div className="flex items-center gap-2">
          <FaRedo className={isMobile ? 'text-indigo-300' : 'text-indigo-600 dark:text-indigo-300'} />
          <p className={`text-sm font-semibold ${isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            Redo workflow
          </p>
        </div>

        {pendingRedos.length > 0 && (
          <div className="space-y-2">
            <p className={`text-xs ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
              Visits marked redo — create a linked child work order to schedule the return trip.
            </p>
            {pendingRedos.map((appt) => (
              <div
                key={appt.id}
                className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg px-3 py-2 ${
                  isMobile ? 'bg-white/5 border border-white/10' : 'bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900'
                }`}
              >
                <span className={`text-sm ${isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'}`}>
                  {visitLabel(appt)}
                </span>
                {canCreate && (
                  <Button
                    variant="primary"
                    size={isMobile ? 'md' : 'sm'}
                    fullWidth={isMobile}
                    onClick={() => setActiveAppointment(appt)}
                  >
                    Create redo order
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {existingChildren.length > 0 && (
          <div className="space-y-1">
            <p className={`text-xs ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
              Redo work orders already created
            </p>
            {existingChildren.map((child) => (
              <Link
                key={child.id}
                href={`/work_orders/${child.id}${isMobile ? '/mobile' : ''}`}
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                  isMobile ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-700 dark:text-indigo-300 hover:underline'
                }`}
              >
                <FaRedo className="w-3 h-3" />
                {child.order_number}
              </Link>
            ))}
          </div>
        )}
      </div>

      <WorkOrderRedoModal
        isOpen={Boolean(activeAppointment)}
        onClose={() => setActiveAppointment(null)}
        workOrderId={workOrderId}
        workOrder={workOrder}
        appointment={activeAppointment}
        onSuccess={onRefresh}
        variant={variant}
      />
    </>
  );
}
