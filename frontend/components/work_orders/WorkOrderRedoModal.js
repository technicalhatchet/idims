import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { formatScheduleForApi, formatScheduleTime } from '../../utils/schedule-time';
import { useRouter } from 'next/router';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { TextInput } from '../ui/FormElements';
import TimeWindowSelector from './TimeWindowSelector';
import { createRedoWorkOrder } from '../../services/api/workOrdersApi';
import { getTechnicianSchedule } from '../../services/api/appointmentsApi';
import {
  DEFAULT_MIN_SLOT_MINUTES,
  findNextAvailableSlot,
  filterSchedulingConflicts,
  getTimeWindowBoundaries,
  resolveWorkOrderServiceAddress,
} from '../../utils/appointment-scheduling';
import { DEFAULT_SHOP_ADDRESS } from '../../utils/google-maps-service';

function formatAppointmentLabel(appointment) {
  if (!appointment) return 'Visit';
  const type = appointment.appointment_type || 'visit';
  const start = appointment.scheduled_start
    ? format(parseISO(appointment.scheduled_start), 'MMM d, yyyy h:mm a')
    : 'Unscheduled';
  return `${type} — ${start}`;
}

function defaultScheduleDate() {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd');
}

export default function WorkOrderRedoModal({
  isOpen,
  onClose,
  workOrderId,
  workOrder,
  appointment,
  onSuccess,
  variant = 'desktop',
}) {
  const router = useRouter();
  const isMobile = variant === 'mobile';

  const [scheduleDate, setScheduleDate] = useState(defaultScheduleDate);
  const [timeWindow, setTimeWindow] = useState(null);
  const [scheduledSlot, setScheduledSlot] = useState(null);
  const [technicianDailySchedule, setTechnicianDailySchedule] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isCalculatingSlot, setIsCalculatingSlot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const serviceAddress = useMemo(
    () => resolveWorkOrderServiceAddress(workOrder || {}),
    [workOrder]
  );

  const technicianId =
    appointment?.assigned_technician_id ||
    workOrder?.assigned_technician_id ||
    null;

  const schedulingConflictAppointments = useMemo(
    () => filterSchedulingConflicts(technicianDailySchedule),
    [technicianDailySchedule]
  );

  const resetForm = useCallback(() => {
    setScheduleDate(defaultScheduleDate());
    setTimeWindow(null);
    setScheduledSlot(null);
    setTechnicianDailySchedule([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, appointment?.id, resetForm]);

  useEffect(() => {
    if (!isOpen || !scheduleDate || !technicianId) {
      setTechnicianDailySchedule([]);
      return;
    }

    let cancelled = false;
    const loadSchedule = async () => {
      setIsLoadingSchedule(true);
      try {
        const schedule = await getTechnicianSchedule(technicianId, scheduleDate);
        if (!cancelled) {
          setTechnicianDailySchedule(schedule || []);
        }
      } catch {
        if (!cancelled) {
          setTechnicianDailySchedule([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSchedule(false);
        }
      }
    };

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [isOpen, scheduleDate, technicianId]);

  const resolveSlotForWindow = useCallback(
    async (windowName) => {
      if (!scheduleDate || !windowName) {
        setScheduledSlot(null);
        return;
      }

      setIsCalculatingSlot(true);
      setError(null);

      try {
        const dateKey = `${scheduleDate}T09:00`;
        let slot = null;

        if (technicianId && serviceAddress) {
          slot = await findNextAvailableSlot(
            dateKey,
            windowName,
            technicianDailySchedule,
            technicianId,
            DEFAULT_SHOP_ADDRESS,
            serviceAddress,
            DEFAULT_MIN_SLOT_MINUTES
          );
        }

        if (!slot) {
          const { startTime, endTime } = getTimeWindowBoundaries(dateKey, windowName);
          const fallbackEnd = new Date(startTime.getTime() + DEFAULT_MIN_SLOT_MINUTES * 60 * 1000);
          slot = {
            startTime,
            endTime: fallbackEnd < endTime ? fallbackEnd : endTime,
          };
        }

        setScheduledSlot({
          start: formatScheduleForApi(slot.startTime),
          end: formatScheduleForApi(slot.endTime),
        });
      } catch (err) {
        setScheduledSlot(null);
        setError(err.message || 'Could not find an open slot in that window');
      } finally {
        setIsCalculatingSlot(false);
      }
    },
    [scheduleDate, technicianId, serviceAddress, technicianDailySchedule]
  );

  const handleTimeWindowSelect = useCallback(async (windowName) => {
    if (!windowName) {
      setTimeWindow(null);
      setScheduledSlot(null);
      return;
    }

    setTimeWindow(windowName);
    await resolveSlotForWindow(windowName);
  }, [resolveSlotForWindow]);

  useEffect(() => {
    if (!timeWindow || isLoadingSchedule) return;
    resolveSlotForWindow(timeWindow);
  }, [technicianDailySchedule, timeWindow, isLoadingSchedule, resolveSlotForWindow]);

  const handleCreate = async () => {
    if (!appointment?.id) return;

    if (!scheduleDate || !timeWindow || !scheduledSlot) {
      setError('Choose a visit date and an available morning or afternoon window.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        appointment_id: appointment.id,
        scheduled_start: scheduledSlot.start,
        scheduled_end: scheduledSlot.end,
        time_window: timeWindow,
      };
      const result = await createRedoWorkOrder(workOrderId, payload);
      onSuccess?.(result);
      onClose();
      if (result?.child_work_order_id) {
        const base = `/work_orders/${result.child_work_order_id}`;
        router.push(isMobile ? `${base}/mobile` : base);
      }
    } catch (err) {
      setError(err.message || 'Failed to create redo work order');
    } finally {
      setSubmitting(false);
    }
  };

  const slotPreview =
    scheduledSlot?.start && scheduledSlot?.end
      ? `${formatScheduleTime(scheduledSlot.start)} – ${formatScheduleTime(scheduledSlot.end)}`
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create redo work order"
      size="md"
    >
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This creates a new work order linked to the original. Diagnostic services are waived;
          repair SKUs carry over from the visit marked redo.
        </p>

        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 text-sm">
          <p className="font-medium text-gray-900 dark:text-white">Source visit</p>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {formatAppointmentLabel(appointment)}
          </p>
        </div>

        <div className="space-y-3">
          <TextInput
            label="First visit date"
            type="date"
            value={scheduleDate}
            onChange={(e) => {
              setScheduleDate(e.target.value);
              setTimeWindow(null);
              setScheduledSlot(null);
            }}
            required
          />

          {scheduleDate && (
            <>
              <TimeWindowSelector
                selectedDate={`${scheduleDate}T09:00`}
                onSelectTimeWindow={handleTimeWindowSelect}
                existingAppointments={schedulingConflictAppointments}
                technicianId={technicianId}
                initialValue={timeWindow}
                address={serviceAddress}
                minSlotMinutes={DEFAULT_MIN_SLOT_MINUTES}
                allowUnavailableSelection
              />
              {!serviceAddress && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No service address on this work order — window availability is approximate until an address is set.
                </p>
              )}
              {isLoadingSchedule && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Loading technician schedule…</p>
              )}
              {isCalculatingSlot && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Finding an open slot…</p>
              )}
              {timeWindow && slotPreview && !isCalculatingSlot && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Proposed arrival window: <span className="font-medium">{slotPreview}</span>
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div
          className={
            isMobile
              ? 'flex flex-col-reverse gap-2 pt-2'
              : 'flex justify-end gap-2 pt-2'
          }
        >
          <Button
            variant="secondary"
            fullWidth={isMobile}
            size={isMobile ? 'lg' : 'md'}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth={isMobile}
            size={isMobile ? 'lg' : 'md'}
            onClick={handleCreate}
            disabled={submitting || isCalculatingSlot}
          >
            {submitting ? 'Creating…' : 'Create redo order'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
