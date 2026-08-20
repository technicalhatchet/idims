import { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, addDays, parseISO } from 'date-fns';
import Select from 'react-select';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { TextInput, TextareaInput } from '../ui/FormElements';
import {
  createWorkOrderAppointment,
  updateAppointment,
  getTechnicianSchedule,
} from '../../services/api/appointmentsApi';
import { useShopHours, isDayOpen } from '../../hooks/useShopHours';
import {
  filterSchedulingConflicts,
  findScheduleConflictsForInterval,
  DEFAULT_MIN_SLOT_MINUTES,
} from '../../utils/appointment-scheduling';
import {
  deriveLegacyAppointmentType,
  formatVisitSkuChipLabel,
  sumPlannedDurationMinutes,
  resolveAppointmentServiceIds,
} from '../../utils/visitSku';
import WoForceScheduleDayView from './WoForceScheduleDayView';
import { forceOrange } from './forceScheduleTheme';

const SHOP_CLOSED_DATE_MESSAGE = 'Shop is closed on this day. Select another date.';

function serviceIdsMatch(a, b) {
  return String(a) === String(b);
}

function formIncludesServiceId(serviceIds, candidateId) {
  return (serviceIds || []).some((id) => serviceIdsMatch(id, candidateId));
}

function formatDateTimeForInput(dateString) {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function formatSkuPickerOption(service) {
  return {
    value: service.id,
    label: `${service.name}${service.duration_minutes ? ` (${service.duration_minutes}m)` : ''}`,
  };
}

function formatCategoryLabel(category) {
  if (!category) return '';
  if (category === 'other') return 'Other';
  return `${category.charAt(0).toUpperCase()}${category.slice(1).toLowerCase()}`;
}

const SKU_MULTI_SELECT_STYLES = {
  container: (base) => ({
    ...base,
    width: '100%',
  }),
  control: (base, state) => ({
    ...base,
    width: '100%',
    backgroundColor: 'var(--color-bg-input, #1f2937)',
    borderColor: state.isFocused
      ? 'var(--color-ring-focus, #3b82f6)'
      : 'var(--color-border-input, #4b5563)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--color-ring-focus, #3b82f6)' : 'none',
    '&:hover': {
      borderColor: 'var(--color-border-input-hover, #6b7280)',
    },
    borderRadius: '0.375rem',
    minHeight: '38px',
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '8px 12px',
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--color-bg-menu, #1f2937)',
    zIndex: 50,
    width: '100%',
    maxWidth: '100%',
    marginTop: '4px',
    left: 0,
    right: 0,
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: '220px',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--color-bg-option-selected, #3b82f6)'
      : state.isFocused
        ? 'var(--color-bg-option-focused, #374151)'
        : 'transparent',
    color: state.isSelected ? 'white' : 'var(--color-text-default, #d1d5db)',
    fontSize: '0.875rem',
    padding: '8px 12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '&:hover': {
      backgroundColor: 'var(--color-bg-option-hover, #374151)',
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--color-text-placeholder, #9ca3af)',
    fontSize: '0.875rem',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--color-text-input, #e5e7eb)',
    fontSize: '0.875rem',
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: '8px',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '4px',
    color: 'var(--color-text-placeholder, #9ca3af)',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
};

function getTechnicianDisplayName(tech) {
  if (!tech) return 'Unknown';
  if (tech.user?.first_name && tech.user?.last_name) {
    return `${tech.user.first_name} ${tech.user.last_name}`;
  }
  if (tech.first_name || tech.last_name) {
    return `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
  }
  if (tech.name) return tech.name;
  if (tech.employee_id) return `Technician (${tech.employee_id})`;
  return `Technician #${tech.id}`;
}

function buildDefaultSlotTimes() {
  const now = new Date();
  let defaultDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const workDayEnd = new Date(defaultDay);
  workDayEnd.setHours(17, 0, 0, 0);
  if (now >= workDayEnd) {
    defaultDay = addDays(defaultDay, 1);
  }

  const startTime = new Date(defaultDay);
  if (defaultDay.toDateString() === now.toDateString()) {
    startTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
  } else {
    startTime.setHours(9, 0, 0, 0);
  }

  const endTime = addMinutes(startTime, DEFAULT_MIN_SLOT_MINUTES);
  return {
    scheduled_start: formatDateTimeForInput(startTime),
    scheduled_end: formatDateTimeForInput(endTime),
  };
}

export default function ForceSchedulePanel({
  workOrderId,
  technicians = [],
  techniciansLoading = false,
  defaultTechnicianId = '',
  allServices = [],
  serviceCategories = [],
  servicesLoading = false,
  onFetchServices,
  editingAppointment = null,
  onEditingClear,
  onSuccess,
  onError,
  onCancel,
  canCreate = true,
  isAdmin = false,
  active = true,
  embedded = false,
  isMobile = false,
}) {
  const { shopHours } = useShopHours();

  const [formData, setFormData] = useState({
    scheduled_start: '',
    scheduled_end: '',
    assigned_technician_id: '',
    notes: '',
    service_ids: [],
    status: 'scheduled',
  });
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [technicianDailySchedule, setTechnicianDailySchedule] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [defaultsInitialized, setDefaultsInitialized] = useState(false);

  const technicianOptions = useMemo(
    () =>
      technicians.map((tech) => ({
        value: String(tech.id),
        label: getTechnicianDisplayName(tech),
      })),
    [technicians]
  );

  const servicesForSelectedCategory = useMemo(() => {
    if (!selectedServiceCategory) return [];
    return allServices.filter((s) => s.service_type === selectedServiceCategory);
  }, [allServices, selectedServiceCategory]);

  const estimatedDurationMinutes = useMemo(() => {
    const ids = formData.service_ids || [];
    if (!ids.length || !allServices.length) return DEFAULT_MIN_SLOT_MINUTES;
    let total = 0;
    for (const id of ids) {
      const svc = allServices.find((s) => serviceIdsMatch(s.id, id));
      if (svc?.duration_minutes) total += svc.duration_minutes;
    }
    return total > 0 ? total : DEFAULT_MIN_SLOT_MINUTES;
  }, [formData.service_ids, allServices]);

  const scheduleConflicts = useMemo(() => {
    if (!formData.assigned_technician_id || !formData.scheduled_start || !formData.scheduled_end) {
      return [];
    }
    const items = filterSchedulingConflicts(technicianDailySchedule);
    return findScheduleConflictsForInterval(
      items,
      formData.assigned_technician_id,
      formData.scheduled_start,
      formData.scheduled_end,
      { excludeAppointmentId: editingAppointment?.id ?? null }
    );
  }, [
    formData.assigned_technician_id,
    formData.scheduled_start,
    formData.scheduled_end,
    technicianDailySchedule,
    editingAppointment?.id,
  ]);

  const resetForm = () => {
    setFormData({
      scheduled_start: '',
      scheduled_end: '',
      assigned_technician_id: '',
      notes: '',
      service_ids: [],
      status: 'scheduled',
    });
    setSelectedServiceCategory('');
    setFormErrors({});
    setDefaultsInitialized(false);
    onEditingClear?.();
  };

  const populateFromAppointment = (appointment) => {
    const serviceIds = resolveAppointmentServiceIds(appointment);
    setFormData({
      scheduled_start: formatDateTimeForInput(appointment.scheduled_start),
      scheduled_end: formatDateTimeForInput(appointment.scheduled_end),
      assigned_technician_id: appointment.assigned_technician_id
        ? String(appointment.assigned_technician_id)
        : '',
      notes: appointment.notes || '',
      service_ids: serviceIds,
      status: appointment.status || 'scheduled',
    });
    setDefaultsInitialized(true);
    if (serviceIds.length > 0 && allServices.length > 0) {
      const first = allServices.find((s) => serviceIdsMatch(s.id, serviceIds[0]));
      if (first?.service_type) setSelectedServiceCategory(first.service_type);
    }
  };

  useEffect(() => {
    if (editingAppointment) {
      onFetchServices?.();
      populateFromAppointment(editingAppointment);
    }
  }, [editingAppointment?.id]);

  useEffect(() => {
    if (!editingAppointment || !allServices.length) return;
    const serviceIds = resolveAppointmentServiceIds(editingAppointment);
    if (serviceIds.length && !selectedServiceCategory) {
      const first = allServices.find((s) => serviceIdsMatch(s.id, serviceIds[0]));
      if (first?.service_type) setSelectedServiceCategory(first.service_type);
    }
  }, [editingAppointment, allServices, selectedServiceCategory]);

  useEffect(() => {
    if (!active || editingAppointment || defaultsInitialized) return;
    onFetchServices?.();
    const slot = buildDefaultSlotTimes();
    setFormData((prev) => ({
      ...prev,
      ...slot,
      assigned_technician_id: prev.assigned_technician_id || defaultTechnicianId || '',
    }));
    setDefaultsInitialized(true);
  }, [active, editingAppointment, defaultsInitialized, defaultTechnicianId, onFetchServices]);

  useEffect(() => {
    if (!defaultTechnicianId || formData.assigned_technician_id || editingAppointment) return;
    setFormData((prev) => ({ ...prev, assigned_technician_id: String(defaultTechnicianId) }));
  }, [defaultTechnicianId, formData.assigned_technician_id, editingAppointment]);

  useEffect(() => {
    if (!active) return;
    const fetchSchedule = async () => {
      if (!formData.scheduled_start || !formData.assigned_technician_id) {
        setTechnicianDailySchedule([]);
        return;
      }
      setIsLoadingSchedule(true);
      try {
        const dateStr = formData.scheduled_start.split('T')[0];
        const schedule = await getTechnicianSchedule(formData.assigned_technician_id, dateStr);
        setTechnicianDailySchedule(schedule || []);
      } catch {
        setTechnicianDailySchedule([]);
      } finally {
        setIsLoadingSchedule(false);
      }
    };
    fetchSchedule();
  }, [active, formData.scheduled_start, formData.assigned_technician_id]);

  const validate = () => {
    const errors = {};
    if (!formData.assigned_technician_id) errors.assigned_technician_id = 'Technician is required';
    if (!formData.scheduled_start) errors.scheduled_start = 'Start time is required';
    if (!formData.scheduled_end) errors.scheduled_end = 'End time is required';
    if (!formData.service_ids?.length) errors.service_ids = 'Select at least one service / SKU';
    if (formData.scheduled_start && formData.scheduled_end) {
      const start = parseISO(formData.scheduled_start);
      const end = parseISO(formData.scheduled_end);
      if (end <= start) errors.scheduled_end = 'End must be after start';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartChange = (e) => {
    const newStart = e.target.value;
    const datePart = newStart.split('T')[0];
    if (shopHours && datePart && !isDayOpen(shopHours, datePart)) {
      setFormErrors((prev) => ({ ...prev, scheduled_start: SHOP_CLOSED_DATE_MESSAGE }));
      setFormData((prev) => ({
        ...prev,
        scheduled_start: newStart,
        scheduled_end: formatDateTimeForInput(addMinutes(parseISO(newStart), estimatedDurationMinutes)),
      }));
      return;
    }
    const end = formatDateTimeForInput(
      addMinutes(parseISO(newStart), estimatedDurationMinutes)
    );
    setFormData((prev) => ({ ...prev, scheduled_start: newStart, scheduled_end: end }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.scheduled_start;
      return next;
    });
  };

  const handleServiceChange = (selected) => {
    const ids = (selected || []).map((o) => o.value);
    setFormData((prev) => {
      let scheduled_end = prev.scheduled_end;
      if (prev.scheduled_start) {
        scheduled_end = formatDateTimeForInput(
          addMinutes(parseISO(prev.scheduled_start), sumPlannedDurationMinutes(ids, allServices))
        );
      }
      return { ...prev, service_ids: ids, scheduled_end };
    });
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.service_ids;
      return next;
    });
  };

  const removeSku = (id) => {
    setFormData((prev) => ({
      ...prev,
      service_ids: (prev.service_ids || []).filter((sid) => !serviceIdsMatch(sid, id)),
    }));
  };

  const handleClearForceSchedule = async () => {
    if (!editingAppointment?.id || scheduleConflicts.length > 0) return;
    setIsSubmitting(true);
    try {
      await updateAppointment(editingAppointment.id, { is_forced_schedule: false });
      onSuccess?.('Force schedule cleared. This visit now follows normal scheduling rules.');
      resetForm();
    } catch (err) {
      onError?.(err?.message || 'Failed to clear force schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate && !editingAppointment) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const legacyAppointmentType = deriveLegacyAppointmentType(formData.service_ids, allServices);
      const payload = {
        ...formData,
        appointment_type: legacyAppointmentType,
        work_order_id: workOrderId,
        service_ids: formData.service_ids || [],
        is_forced_schedule: true,
        time_window: null,
        travel_time_before: null,
        travel_time_after: null,
        travel_distance_before: null,
        travel_distance_after: null,
      };

      if (editingAppointment) {
        await updateAppointment(editingAppointment.id, payload);
        onSuccess?.('Force-scheduled visit updated.');
      } else {
        await createWorkOrderAppointment(workOrderId, payload);
        onSuccess?.('Visit force-scheduled successfully.');
      }
      resetForm();
    } catch (err) {
      onError?.(err?.message || 'Failed to save force-scheduled visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateLabel = formData.scheduled_start
    ? format(parseISO(formData.scheduled_start), 'EEE, MMM d')
    : null;

  if (!active) return null;

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-4">
        <p className={`text-sm text-gray-600 dark:text-gray-300 ${forceOrange.textDark}`}>
          Book a <strong>specific time</strong> or override conflicts. Visits here are flagged as{' '}
          <strong>forced</strong> on the schedule board — not next-available scheduling.
        </p>

        {editingAppointment && (
          <p className={`text-sm font-medium ${forceOrange.text} ${forceOrange.textDark}`}>
            Editing force-scheduled visit
          </p>
        )}

        <div>
          <label
            htmlFor="force_assigned_technician_id"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Technician <span className="text-red-500">*</span>
          </label>
          <select
            id="force_assigned_technician_id"
            name="assigned_technician_id"
            value={formData.assigned_technician_id}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, assigned_technician_id: e.target.value }))
            }
            disabled={techniciansLoading}
            className="mt-1 block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-60"
            required
          >
            <option value="">
              {techniciansLoading ? 'Loading technicians…' : 'Select a technician'}
            </option>
            {technicianOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {formErrors.assigned_technician_id && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {formErrors.assigned_technician_id}
            </p>
          )}
          {!techniciansLoading && technicianOptions.length === 0 && (
            <p className={`mt-1 text-sm ${forceOrange.text} ${forceOrange.textDark}`}>
              No technicians available. Check technician settings or try refreshing the page.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput
            id="force_scheduled_start"
            name="scheduled_start"
            label="Start (exact)"
            type="datetime-local"
            value={formData.scheduled_start}
            onChange={handleStartChange}
            error={formErrors.scheduled_start}
            required
          />
          <TextInput
            id="force_scheduled_end"
            name="scheduled_end"
            label="End (exact)"
            type="datetime-local"
            value={formData.scheduled_end}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, scheduled_end: e.target.value }))
            }
            error={formErrors.scheduled_end}
            required
          />
        </div>

        {formData.assigned_technician_id && formData.scheduled_start && (
          <WoForceScheduleDayView
            scheduleItems={technicianDailySchedule}
            proposedStart={formData.scheduled_start}
            proposedEnd={formData.scheduled_end}
            workOrderId={workOrderId}
            dateLabel={dateLabel}
            shopHours={shopHours}
            scheduleDate={formData.scheduled_start?.split('T')[0]}
            isLoading={isLoadingSchedule}
          />
        )}

        {scheduleConflicts.length > 0 && (
          <ul className={`text-sm list-disc list-inside space-y-0.5 rounded-md px-3 py-2 ${forceOrange.border} ${forceOrange.bg} ${forceOrange.text} ${forceOrange.textDark}`}>
            {scheduleConflicts.map((c) => (
              <li key={`${c.item?.id}-${c.label}`}>{c.label}</li>
            ))}
            <li className="list-none mt-1 opacity-80">
              Overlaps are allowed — this visit will still be saved as forced.
            </li>
          </ul>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Service category
          </label>
          <select
            value={selectedServiceCategory}
            onChange={(e) => setSelectedServiceCategory(e.target.value)}
            className="block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2"
          >
            <option value="">Select category</option>
            {serviceCategories.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Services / SKUs *
          </label>
          {servicesLoading && !selectedServiceCategory ? (
            <LoadingSpinner size="small" />
          ) : !selectedServiceCategory ? (
            <p className="text-sm text-gray-500 py-2">Select a service category first.</p>
          ) : (
            <div className="w-full min-w-0">
              <Select
                isMulti
                controlShouldRenderValue={false}
                options={servicesForSelectedCategory.map(formatSkuPickerOption)}
                value={servicesForSelectedCategory
                  .filter((s) => formIncludesServiceId(formData.service_ids, s.id))
                  .map(formatSkuPickerOption)}
                onChange={handleServiceChange}
                placeholder="Add services..."
                isDisabled={servicesForSelectedCategory.length === 0}
                className="basic-multi-select w-full"
                classNamePrefix="select"
                styles={SKU_MULTI_SELECT_STYLES}
                menuPlacement="auto"
              />
            </div>
          )}
          {formData.service_ids?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {formData.service_ids.map((id) => {
                const service = allServices.find((s) => serviceIdsMatch(s.id, id));
                if (!service) return null;
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${forceOrange.border} ${forceOrange.bgMedium} ${forceOrange.text} dark:text-[#F5A623]`}
                  >
                    {formatVisitSkuChipLabel(service)}
                    <button
                      type="button"
                      onClick={() => removeSku(id)}
                      className="opacity-70 hover:opacity-100"
                      aria-label={`Remove ${service.name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {formErrors.service_ids && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.service_ids}</p>
          )}
        </div>

        <TextareaInput
          id="force_notes"
          name="notes"
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={2}
          placeholder="Why this time was forced (client request, conflict, etc.)"
        />

        {isAdmin && editingAppointment?.is_forced_schedule && (
          <button
            type="button"
            onClick={handleClearForceSchedule}
            disabled={isSubmitting || scheduleConflicts.length > 0}
            className={`text-sm underline disabled:opacity-50 disabled:no-underline ${forceOrange.text} ${forceOrange.textDark} hover:opacity-90`}
            title={
              scheduleConflicts.length > 0
                ? 'Move to a non-conflicting time first'
                : 'Clear forced flag after slot no longer overlaps'
            }
          >
            Restore normal scheduling (admin)
          </button>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {!embedded && onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetForm();
                onCancel();
              }}
            >
              Back to schedule
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving…'
              : editingAppointment
                ? 'Update forced visit'
                : 'Force schedule visit'}
          </Button>
        </div>
      </form>
  );

  if (embedded) return formBody;

  return (
    <div
      className={
        isMobile
          ? `rounded-xl border ${forceOrange.border} ${forceOrange.bg} p-3`
          : `rounded-lg border ${forceOrange.border} ${forceOrange.bg} p-4`
      }
    >
      {formBody}
    </div>
  );
}
