import { useState, useEffect, useMemo, useRef } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaUserClock, FaSave, FaTimes, FaClock, FaCar } from 'react-icons/fa';
import { format, addMinutes, addDays, parseISO, differenceInMinutes } from 'date-fns';
import LoadingSpinner from '../ui/LoadingSpinner';
import FloatingBanner from '../ui/FloatingBanner';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { TextInput, SelectInput, TextareaInput } from '../ui/FormElements';
import { 
  getWorkOrderAppointments, 
  createWorkOrderAppointment, 
  updateAppointment, 
  deleteAppointment,
  getTechnicianSchedule
} from '../../services/api/appointmentsApi';
import { apiClient } from '../../utils/api-client';
import { updateAppointmentStatus } from '../../lib/offlineWrites';
import AutoScheduler from './AutoScheduler';
import TravelTimeInfo from './TravelTimeInfo';
import TimeWindowSelector from './TimeWindowSelector';
import {
  findNextAvailableSlot,
  getTimeWindowBoundaries,
  resolveWorkOrderServiceAddress,
  resolveAppointmentLocation,
  filterSchedulingConflicts,
  isProposedSlotAvailable,
  findScheduleConflictsForInterval,
  computeClientEtaWindow,
  DEFAULT_MIN_SLOT_MINUTES,
} from '../../utils/appointment-scheduling';
import {
  deriveVisitDisplayLabel,
  deriveLegacyAppointmentType,
  formatVisitSkuChipLabel,
  sumPlannedDurationMinutes,
  calendarBlockMinutes,
  resolveAppointmentServiceIds,
} from '../../utils/visitSku';
import VisitSkuAccordion from './VisitSkuAccordion';
import WindowScheduler from './WindowScheduler';
import { DEFAULT_SHOP_ADDRESS } from '../../utils/google-maps-service';
import Select from 'react-select';
import { useUserRole } from '../../utils/auth0-helpers';
import useCurrentTechnicianId from '../../hooks/useCurrentTechnicianId';
import { useTechnicians } from '../../hooks/useTechnicians';
import {
  canCreateAppointments,
  canDeleteAppointments,
  canEditAppointment,
  canUpdateAppointmentStatus,
  isWorkOrderClosed,
} from '../../utils/workOrderPermissions';

const OPEN_APPOINTMENT_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'en_route', label: 'En Route' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed_pending_payment', label: 'Done — Pending Payment' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'refund', label: 'Refund' },
  { value: 'phone_payment', label: 'Phone Pay' },
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'failed', label: 'APR — Additional Parts Required' },
  { value: 'canceled', label: 'Canceled' },
];

const CLOSED_APPOINTMENT_STATUS_OPTIONS = [
  { value: 'redo', label: 'Redo' },
  { value: 'refund', label: 'Refund' },
  { value: 'completed', label: 'Completed' },
];
import { formatAppointmentStatus } from '../../utils/appointmentStatusLabels';

function getWorkOrderAppointmentsSeed(workOrder) {
  return Array.isArray(workOrder?.appointments) ? workOrder.appointments : [];
}

function serviceIdsMatch(a, b) {
  return String(a) === String(b);
}

function formIncludesServiceId(serviceIds, candidateId) {
  return (serviceIds || []).some((id) => serviceIdsMatch(id, candidateId));
}

function parseTravelInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function isVisitCompleteStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'completed_pending_payment';
}

export default function AppointmentScheduler({
  workOrderId,
  workOrder,
  workOrderAddress,
  serviceLocation,
  workOrderProperty,
  propertyId,
  clientProperties,
  editWorkOrderHref,
  onAppointmentChange,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile';
  console.log("AppointmentScheduler received workOrderId:", workOrderId);

  const seedAppointments = getWorkOrderAppointmentsSeed(workOrder);
  const [appointments, setAppointments] = useState(seedAppointments);
  const [isLoading, setIsLoading] = useState(seedAppointments.length === 0);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const { data: techniciansData } = useTechnicians();
  const technicians = useMemo(
    () => (Array.isArray(techniciansData?.items) ? techniciansData.items : []),
    [techniciansData],
  );
  const [technicianDailySchedule, setTechnicianDailySchedule] = useState([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  const [allServices, setAllServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('');
  const [servicesForSelectedCategory, setServicesForSelectedCategory] = useState([]);

  const initialFormData = {
    work_order_id: workOrderId,
    appointment_type: 'diagnostic',
    status: 'scheduled',
    scheduled_start: '',
    scheduled_end: '',
    assigned_technician_id: '',
    notes: '',
    travel_time_before: null,
    travel_time_after: null,
    travel_distance_before: null,
    travel_distance_after: null,
    service_ids: [],
    time_window: null,
    is_forced_schedule: false,
  };
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [viewMode, setViewMode] = useState('list'); // 'list', 'calendar', 'auto', or 'window'
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [displayEtaWindow, setDisplayEtaWindow] = useState(null);
  const [windowOverflowPrompt, setWindowOverflowPrompt] = useState(null);
  const [skuBlockWarning, setSkuBlockWarning] = useState(null);
  const [expandedVisitIds, setExpandedVisitIds] = useState({});
  const pendingMoveSkuRef = useRef(null);
  const [updatingStatus, setUpdatingStatus] = useState(null); // Track which appointment is being updated
  const schedulingAnchorRef = useRef(null);
  const windowOverflowAcceptedRef = useRef(false);
  const travelRecalculatedRef = useRef(false);

  const { role, isManager, isAdmin } = useUserRole();
  const currentTechnicianId = useCurrentTechnicianId();
  const woClosed = isWorkOrderClosed(workOrder);
  const canCreateAppts = canCreateAppointments({ role, workOrder });
  const canDeleteAppts = canDeleteAppointments({ role, workOrder });
  const appointmentPermCtx = { role, currentTechnicianId, workOrder };
  const canEditAppt = (appointment) =>
    canEditAppointment({ appointment, ...appointmentPermCtx });
  const canStatusAppt = (appointment) =>
    canUpdateAppointmentStatus({ appointment, ...appointmentPermCtx });
  const canForceSchedule = isManager;

  const resolvedWorkOrderAddress = useMemo(
    () => resolveWorkOrderServiceAddress({
      service_location: serviceLocation || (workOrderAddress ? { address: workOrderAddress } : null),
      property: workOrderProperty,
      property_id: propertyId,
      client_properties: clientProperties,
    }),
    [serviceLocation, workOrderAddress, workOrderProperty, propertyId, clientProperties]
  );

  const schedulingConflictAppointments = useMemo(
    () => filterSchedulingConflicts(
      technicianDailySchedule.length > 0 ? technicianDailySchedule : appointments
    ),
    [technicianDailySchedule, appointments]
  );

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort(
        (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      ),
    [appointments]
  );

  const visitSkuOptions = useMemo(
    () => ({
      catalogServices: allServices,
      workOrderServices: workOrder?.services || [],
    }),
    [allServices, workOrder?.services]
  );

  const toggleVisitSkuPanel = (appointmentId) => {
    setExpandedVisitIds((prev) => ({
      ...prev,
      [appointmentId]: !prev[appointmentId],
    }));
  };

  const getVisitLabel = (appointment, visitIndex) =>
    deriveVisitDisplayLabel(appointment, visitIndex, visitSkuOptions);

  const currentVisitIndex = currentAppointment
    ? Math.max(0, sortedAppointments.findIndex((a) => a.id === currentAppointment.id))
    : sortedAppointments.length;

  const currentVisitLabel = currentAppointment
    ? getVisitLabel(currentAppointment, currentVisitIndex)
    : null;

  const estimatedServiceDurationMinutes = useMemo(() => {
    const ids = formData.service_ids || [];
    if (!ids.length || !allServices.length) return DEFAULT_MIN_SLOT_MINUTES;
    let total = 0;
    for (const id of ids) {
      const svc = allServices.find(
        (s) => serviceIdsMatch(s.id, id)
      );
      if (svc?.duration_minutes) total += svc.duration_minutes;
    }
    return total > 0 ? total : DEFAULT_MIN_SLOT_MINUTES;
  }, [formData.service_ids, allServices]);

  const getScheduleItemsForConflictCheck = () => schedulingConflictAppointments;

  const checkProposedScheduleConflict = (start, end) => {
    if (!formData.assigned_technician_id || !start || !end) return null;
    const result = isProposedSlotAvailable(
      getScheduleItemsForConflictCheck(),
      formData.assigned_technician_id,
      start,
      end,
      { excludeAppointmentId: currentAppointment?.id ?? null }
    );
    return result.available ? null : result.reason;
  };

  const proposedScheduleConflicts = useMemo(() => {
    if (!formData.assigned_technician_id || !formData.scheduled_start || !formData.scheduled_end) {
      return [];
    }
    return findScheduleConflictsForInterval(
      getScheduleItemsForConflictCheck(),
      formData.assigned_technician_id,
      formData.scheduled_start,
      formData.scheduled_end,
      { excludeAppointmentId: currentAppointment?.id ?? null }
    );
  }, [
    formData.assigned_technician_id,
    formData.scheduled_start,
    formData.scheduled_end,
    schedulingConflictAppointments,
    currentAppointment?.id,
  ]);

  const handleClearForceSchedule = async () => {
    if (!currentAppointment?.id || !isAdmin) return;

    const conflictReason = checkProposedScheduleConflict(
      formData.scheduled_start,
      formData.scheduled_end
    );
    if (conflictReason) {
      setError(
        `Cannot clear force schedule while this time still conflicts: ${conflictReason} Change the start/end to an open slot, save, then restore normal scheduling.`
      );
      return;
    }

    if (!window.confirm(
      'Restore normal scheduling rules for this appointment? The current time must not overlap other jobs or time blocks (already verified for the times shown).'
    )) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await updateAppointment(currentAppointment.id, { is_forced_schedule: false });
      setSuccessMessage('Force schedule cleared. Normal conflict rules apply.');
      await fetchAppointments();
      setFormData((prev) => ({ ...prev, is_forced_schedule: false }));
      setCurrentAppointment((prev) => (prev ? { ...prev, is_forced_schedule: false } : prev));
      if (onAppointmentChange) onAppointmentChange();
    } catch (err) {
      setError(err?.message || 'Failed to clear force schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForceScheduleControls = () => {
    if (!canForceSchedule && !currentAppointment?.is_forced_schedule) return null;

    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
        {currentAppointment?.is_forced_schedule && (
          <p className="text-sm text-amber-200">
            This appointment is <strong>force scheduled</strong> — it may overlap other jobs or calendar blocks.
            To restore normal rules, first move it to a time that does not conflict, save, then use{' '}
            <em>Restore normal scheduling</em> (or save with force schedule unchecked).
          </p>
        )}
        {proposedScheduleConflicts.length > 0 && !formData.is_forced_schedule && (
          <ul className="text-sm text-amber-100/90 list-disc list-inside space-y-0.5">
            {proposedScheduleConflicts.map((c) => (
              <li key={`${c.item?.id}-${c.label}`}>{c.label}</li>
            ))}
          </ul>
        )}
        {canForceSchedule && !currentAppointment?.is_forced_schedule && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(formData.is_forced_schedule)}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData((prev) => ({ ...prev, is_forced_schedule: checked }));
                if (checked) {
                  setFormErrors((prev) => {
                    const next = { ...prev };
                    delete next.scheduled_start;
                    return next;
                  });
                }
              }}
            />
            <span className="text-sm text-amber-50">
              Force schedule — allow this time even if it overlaps other appointments or time blocks
            </span>
          </label>
        )}
        {isAdmin && currentAppointment?.is_forced_schedule && (
          <button
            type="button"
            onClick={handleClearForceSchedule}
            disabled={isSubmitting || proposedScheduleConflicts.length > 0}
            title={
              proposedScheduleConflicts.length > 0
                ? 'Change date/time so this slot no longer overlaps a block or appointment, then clear force.'
                : 'Clear the force-schedule flag'
            }
            className="text-sm font-medium text-amber-200 underline hover:text-amber-100 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
          >
            Restore normal scheduling (admin)
          </button>
        )}
      </div>
    );
  };

  // Fetch appointments when component mounts (background refresh if WO already has data)
  useEffect(() => {
    if (workOrderId) {
      console.log(`Initializing AppointmentScheduler for workOrderId: ${workOrderId}`);
      const hasSeed = getWorkOrderAppointmentsSeed(workOrder).length > 0;
      fetchAppointments({ silent: hasSeed });
    }
  }, [workOrderId]);

  // Keep list in sync when parent WO refetches (skip while editing)
  useEffect(() => {
    if (showForm) return;
    const seeded = getWorkOrderAppointmentsSeed(workOrder);
    if (seeded.length > 0) {
      setAppointments(seeded);
      setIsLoading(false);
    }
  }, [workOrder?.appointments, showForm]);

  useEffect(() => {
    if (allServices.length > 0) {
      const categories = [
        ...new Set(
          allServices.map((service) => service.service_type || 'other').filter(Boolean)
        ),
      ];
      setServiceCategories(categories.sort());
    } else {
      setServiceCategories([]);
    }
  }, [allServices]);

  useEffect(() => {
    if (selectedServiceCategory && allServices.length > 0) {
      const filteredServices = allServices.filter((service) => {
        const type = service.service_type || 'other';
        return type === selectedServiceCategory;
      });
      setServicesForSelectedCategory(filteredServices);
    } else {
      setServicesForSelectedCategory([]);
    }
    // The logic to clear formData.service_ids has been moved to handleServiceCategoryChange
    // and to form initialization/reset logic.
    // console.log('[useEffect for ServicesList] Checking condition to clear service_ids: !currentAppointment:', !currentAppointment, '!selectedServiceCategory:', !selectedServiceCategory);
    // if (!currentAppointment || !selectedServiceCategory) {
    //     setFormData(prev => {
    //       console.log('[useEffect for ServicesList] Clearing service_ids. Previous formData.service_ids:', JSON.parse(JSON.stringify(prev.service_ids)));
    //       return { ...prev, service_ids: [] };
    //     });
    // } else {
    //   console.log('[useEffect for ServicesList] Did NOT clear service_ids.');
    // }
  }, [selectedServiceCategory, allServices]); // Removed currentAppointment from dependency array

  // useEffect to pre-select service category when editing an appointment
  useEffect(() => {
    console.log('[useEffect for Category PRE-SELECT] Triggered. Deps:', {
      currentAppointment: currentAppointment ? 'Set' : 'Null',
      allServicesLength: allServices.length,
      formDataServiceIds: JSON.parse(JSON.stringify(formData.service_ids))
    });

    // This effect should primarily handle setting the category when an appointment is loaded for editing.
    if (currentAppointment) {
      if (formData.service_ids && formData.service_ids.length > 0 && allServices.length > 0) {
        const firstServiceId = formData.service_ids[0];
        const serviceDetails = allServices.find((s) => serviceIdsMatch(s.id, firstServiceId));
        console.log('[useEffect for Category PRE-SELECT] In Edit Mode - firstServiceId:', firstServiceId, 'serviceDetails:', serviceDetails);
        if (serviceDetails && serviceDetails.service_type) {
          setSelectedServiceCategory(serviceDetails.service_type);
        } else {
          console.log('[useEffect for Category PRE-SELECT] In Edit Mode - Service details or type not found, clearing category.');
          setSelectedServiceCategory('');
        }
      } else if ((!formData.service_ids || formData.service_ids.length === 0) && allServices.length > 0) {
        // If in edit mode, all services are loaded, but no service_ids are selected in formData, clear category
        console.log('[useEffect for Category PRE-SELECT] In Edit Mode - No service_ids in formData, clearing category.');
        setSelectedServiceCategory('');
      } else {
        console.log('[useEffect for Category PRE-SELECT] In Edit Mode - Conditions not met (e.g. allServices not loaded yet, or service_ids populated but no match found). Current category:', selectedServiceCategory);
      }
    }
    // When not in edit mode (currentAppointment is null), this effect should do nothing,
    // allowing manual selection to persist.
  }, [currentAppointment, allServices, formData.service_ids]);

  // Re-fetch appointments when returning to the tab (visibility only — initial load is workOrderId effect above)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && workOrderId) {
        fetchAppointments();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [workOrderId]);

  // Effect to recalculate time when dependencies change (date, window, technician)
  useEffect(() => {
    const recalculate = async () => {
      // Skip recalculation when editing — preserve the existing appointment time
      if (currentAppointment) return;
      if (formData.time_window && formData.scheduled_start && formData.assigned_technician_id && resolvedWorkOrderAddress) {
        console.log(`[AppointmentScheduler useEffect] Dependencies changed. Recalculating time for window: ${formData.time_window}, date: ${formData.scheduled_start.split('T')[0]}, tech: ${formData.assigned_technician_id}`);
        try {
          const success = await calculateAppointmentTime(technicianDailySchedule, formData.time_window);
          if (success && formData.scheduled_start) {
            // formData.scheduled_start should be updated by calculateAppointmentTime via setFormData
            // We need to ensure we use the updated value for ETA calculation.
            // The calculateAppointmentTime already calls setFormData, so we rely on its completion.
            // This effect will re-run if formData.scheduled_start changes from that call.
            console.log('[AppointmentScheduler useEffect] Recalculation successful, formData.scheduled_start:', formData.scheduled_start);
            // The actual update of displayEtaWindow will happen in the next effect that listens to formData.scheduled_start
          } else if (!success) {
            setDisplayEtaWindow(null); // Clear ETA if calculation failed
          }
        } catch (err) {
          console.error("[AppointmentScheduler useEffect] Error recalculating appointment times:", err);
          setDisplayEtaWindow(null); // Clear ETA on error
        }
      } else {
        // If not all conditions met for recalculation, clear ETA
        // setDisplayEtaWindow(null); // Potential: This might clear ETA too aggressively
      }
    };
    recalculate();
  }, [formData.time_window, formData.assigned_technician_id, resolvedWorkOrderAddress, technicianDailySchedule, estimatedServiceDurationMinutes]); // Recalc when SKU duration changes

  // Effect to update client ETA window when scheduled_start or time_window changes
  useEffect(() => {
    if (formData.scheduled_start && formData.time_window) {
      try {
        const eta = computeClientEtaWindow(formData.scheduled_start, formData.time_window);
        setDisplayEtaWindow(eta?.display ?? null);
        if (eta) {
          console.log(`[AppointmentScheduler ETA Effect] Client ETA: ${eta.display}`);
        }
      } catch (e) {
        console.error('[AppointmentScheduler ETA Effect] Error formatting ETA window:', e);
        setDisplayEtaWindow('Error calculating ETA');
      }
    } else {
      setDisplayEtaWindow(null);
    }
  }, [formData.scheduled_start, formData.time_window]);

  // useEffect hook to fetch the technician's full daily schedule when date or technician changes
  useEffect(() => {
    const fetchTechnicianSchedule = async () => {
      // Check if both date and technician are selected
      if (formData.scheduled_start && formData.assigned_technician_id) {
        setIsLoadingSchedule(true);
        setError(null); // Clear previous errors
        try {
          // Extract date part (YYYY-MM-DD) from scheduled_start
          const dateStr = formData.scheduled_start.split('T')[0];
          console.log(`[AppointmentScheduler] Fetching schedule for tech ${formData.assigned_technician_id} on date ${dateStr}`);
          
          // Call the new API function
          const schedule = await getTechnicianSchedule(formData.assigned_technician_id, dateStr);
          setTechnicianDailySchedule(schedule || []); // Update state, default to empty array on null/error
          console.log('[AppointmentScheduler] Fetched technician schedule:', schedule);
          
        } catch (err) {
          console.error("Error fetching technician schedule:", err);
          setError(`Failed to load technician schedule: ${err.message || 'Unknown error'}`);
          setTechnicianDailySchedule([]); // Clear schedule on error
        } finally {
          setIsLoadingSchedule(false);
        }
      } else {
        // If no date or technician, clear the schedule
        setTechnicianDailySchedule([]);
      }
    };

    fetchTechnicianSchedule();
    
  }, [formData.scheduled_start, formData.assigned_technician_id]); // Dependencies: date and technician ID

  const fetchServices = async () => {
    if (allServices.length > 0 && !servicesLoading) return; // Don't refetch if already loaded
    setServicesLoading(true);
    try {
      console.log("Fetching services...");
      const response = await apiClient('/api/services?limit=500&is_active=true');
      setAllServices(response.items || []);
      console.log("Services API response:", response);
    } catch (err) {
      console.error('Error fetching services:', err);
      // setError('Failed to load services. Please try again.'); // Optionally set an error for services
    } finally {
      setServicesLoading(false);
    }
  };

  // Fetch appointments from API
  const fetchAppointments = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      console.log(`Fetching appointments for workOrderId: ${workOrderId}`);
      const response = await getWorkOrderAppointments(workOrderId);
      console.log("Appointments API response:", response);
      
      let appointmentsData = [];
      
      if (response.items && Array.isArray(response.items)) {
        console.log(`Found ${response.items.length} appointments in response.items`);
        appointmentsData = response.items;
      } else if (Array.isArray(response)) {
        console.log("Response is an array, using directly");
        appointmentsData = response;
      } else if (response && typeof response === 'object') {
        // If response is a single appointment object, wrap it in an array
        if (response.id && response.work_order_id) {
          console.log("Response is a single appointment object, adding to array");
          appointmentsData = [response];
        } else {
          console.log("Looking for appointments array in response object");
          // Try to find any array property that might contain appointments
          const possibleArrays = Object.entries(response)
            .filter(([_, value]) => Array.isArray(value))
            .map(([key, value]) => ({ key, value }));
            
          if (possibleArrays.length > 0) {
            console.log(`Found possible appointment arrays: ${possibleArrays.map(a => a.key).join(', ')}`);
            // Use the first array found
            appointmentsData = possibleArrays[0].value;
          }
        }
      }
      
      console.log("Final appointments data:", appointmentsData);
      console.log("First appointment services:", appointmentsData[0]?.services);
      setAppointments(appointmentsData);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(`Failed to load appointments: ${err.message || 'Unknown error'}`);
      if (!silent) {
        setAppointments([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Default technician name to auto-select
  const DEFAULT_TECHNICIAN_NAME = 'Chee Clocksin';

  const getTechnicianDisplayName = (tech) => {
    if (!tech) return '';
    if (tech.user) {
      return `${tech.user.first_name || ''} ${tech.user.last_name || ''}`.trim();
    }
    if (tech.name) return tech.name;
    return `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
  };

  const pickDefaultTechnician = (techList) => {
    if (!Array.isArray(techList) || techList.length === 0) return null;
    if (role === 'technician' && currentTechnicianId) {
      const self = techList.find((t) => String(t.id) === String(currentTechnicianId));
      if (self) return self;
    }
    const byName = techList.find((t) => getTechnicianDisplayName(t) === DEFAULT_TECHNICIAN_NAME);
    if (byName) return byName;
    return techList.find((t) => t.status === 'active' || !t.status) || techList[0];
  };

  // Auto-select default technician once the shared technicians cache loads
  useEffect(() => {
    if (!technicians.length) return;
    setFormData((prev) => {
      if (prev.assigned_technician_id) return prev;
      const defaultTech = pickDefaultTechnician(technicians);
      if (!defaultTech) return prev;
      return { ...prev, assigned_technician_id: defaultTech.id };
    });
  }, [technicians]);

  // Open modal for creating or editing appointment
  const openAppointmentModal = (appointment = null) => {
    console.log("Opening appointment modal, current appointment:", appointment);
    setShowForm(true); // This seems to be the flag to show the modal form
    fetchServices(); // Fetch services when modal is opened

    if (appointment) {
      setCurrentAppointment(appointment);
      setFormData({
        ...initialFormData,
        work_order_id: workOrderId,
        appointment_type: appointment.appointment_type || 'diagnostic',
        status: appointment.status || 'scheduled',
        scheduled_start: appointment.scheduled_start ? formatDateTimeForInput(appointment.scheduled_start) : '',
        scheduled_end: appointment.scheduled_end ? formatDateTimeForInput(appointment.scheduled_end) : '',
        assigned_technician_id: appointment.assigned_technician_id || '',
        notes: appointment.notes || '',
        travel_time_before: appointment.travel_time_before,
        travel_time_after: appointment.travel_time_after,
        travel_distance_before: appointment.travel_distance_before,
        travel_distance_after: appointment.travel_distance_after,
        service_ids: resolveAppointmentServiceIds(appointment),
        time_window: appointment.time_window || null,
      });
      const resolvedIds = resolveAppointmentServiceIds(appointment);
      if (resolvedIds.length > 0 && allServices.length > 0) {
        const firstServiceId = resolvedIds[0];
        const service = allServices.find((s) => serviceIdsMatch(s.id, firstServiceId));
        if (service?.service_type) {
          setSelectedServiceCategory(service.service_type);
        } else {
          setSelectedServiceCategory('');
        }
      } else {
        setSelectedServiceCategory('');
      }
    } else {
      setCurrentAppointment(null);
      schedulingAnchorRef.current = new Date();
      windowOverflowAcceptedRef.current = false;
      const now = schedulingAnchorRef.current;
      let defaultDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const workDayEnd = new Date(defaultDay);
      workDayEnd.setHours(17, 0, 0, 0);
      if (now >= workDayEnd) {
        defaultDay = addDays(defaultDay, 1);
      }

      const defaultStart = new Date(defaultDay);
      if (defaultDay.toDateString() === now.toDateString()) {
        defaultStart.setHours(now.getHours(), now.getMinutes(), 0, 0);
      } else {
        defaultStart.setHours(9, 0, 0, 0);
      }
      const defaultEnd = addMinutes(defaultStart, DEFAULT_MIN_SLOT_MINUTES);

      setFormData({
        ...initialFormData,
        work_order_id: workOrderId,
        scheduled_start: formatDateTimeForInput(defaultStart),
        scheduled_end: formatDateTimeForInput(defaultEnd),
        service_ids: [],
      });
      setSelectedServiceCategory('');
    }
    setFormErrors({});
    setIsModalOpen(true); // This likely controls the <Modal> component visibility
    // setViewMode('list'); // Or whichever mode is appropriate for the form
  };

  // Format date for input fields
  const formatDateTimeForInput = (dateString) => {
    if (!dateString) return '';
    try {
      // Assuming dateString is either a Date object or a valid ISO string
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
      return format(date, "yyyy-MM-dd'T'HH:mm");
    } catch (error) {
      console.error("Error formatting date for input:", dateString, error);
      return ''; // Fallback to empty string
    }
  };

  // Format date for display
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MM/dd/yyyy h:mm a');
    } catch (error) {
      console.error("Error formatting date time:", dateString, error);
      return 'Invalid Date';
    }
  };

  // Format time only
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'h:mm a');
    } catch (error) {
      console.error("Error formatting time:", dateString, error);
      return 'Invalid Time';
    }
  };

  // Helper function to format travel time (seconds to minutes)
  const formatTravelTime = (seconds) => {
    if (seconds === null || typeof seconds === 'undefined' || seconds === '') return 'N/A';
    const minutes = Math.round(Number(seconds) / 60);
    return `${minutes} min`;
  };

  // Helper function to format travel distance (meters to miles)
  const formatTravelDistance = (meters) => {
    if (meters === null || typeof meters === 'undefined' || meters === '') return 'N/A';
    const miles = (Number(meters) / 1609.34).toFixed(1);
    return `${miles} mi`;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleServiceCategoryChange = (e) => {
    const newCategory = e.target.value;
    setSelectedServiceCategory(newCategory);
    if (!newCategory) {
      setFormData((prev) => ({ ...prev, service_ids: [] }));
    }
  };

  const formatSkuPickerOption = (service) => ({
    value: service.id,
    label: `${service.name}${service.sku_code ? ` (${service.sku_code})` : ''} — ${service.duration_minutes || 0} min — $${Number(service.base_price || 0).toFixed(2)}`,
  });

  const reconcileVisitEndForSkus = (prev, serviceIds) => {
    const next = { ...prev, service_ids: serviceIds };
    let skuWarning = null;

    if (!prev.scheduled_start) {
      return { next, skuWarning };
    }

    const plannedMinutes = sumPlannedDurationMinutes(serviceIds, allServices);
    const blockMinutes = calendarBlockMinutes(prev.scheduled_start, prev.scheduled_end);

    const shouldSyncEnd =
      !currentAppointment || plannedMinutes !== blockMinutes;

    if (shouldSyncEnd) {
      try {
        const startDate = parseISO(prev.scheduled_start);
        if (!currentAppointment || plannedMinutes <= blockMinutes) {
          next.scheduled_end = formatDateTimeForInput(addMinutes(startDate, plannedMinutes));
          skuWarning = null;
        } else {
          skuWarning = { planned: plannedMinutes, block: blockMinutes };
        }
      } catch (error) {
        console.error('[reconcileVisitEndForSkus] Error updating end time:', error);
      }
    } else if (plannedMinutes > blockMinutes) {
      skuWarning = { planned: plannedMinutes, block: blockMinutes };
    }

    return { next, skuWarning };
  };

  const removeSkuFromVisit = (serviceId) => {
    setFormData((prev) => {
      const newServiceIds = (prev.service_ids || []).filter((id) => !serviceIdsMatch(id, serviceId));
      const { next, skuWarning } = reconcileVisitEndForSkus(prev, newServiceIds);
      setSkuBlockWarning(skuWarning);
      return next;
    });
  };

  const handleServiceChange = (selectedOptions) => {
    const selectedInCategory = selectedOptions ? selectedOptions.map((opt) => String(opt.value)) : [];
    const categoryIds = new Set(servicesForSelectedCategory.map((s) => String(s.id)));

    setFormData((prev) => {
      const keptFromOtherCategories = (prev.service_ids || []).filter(
        (id) => !categoryIds.has(String(id))
      );
      const newServiceIds = [...keptFromOtherCategories, ...selectedInCategory];
      const { next, skuWarning } = reconcileVisitEndForSkus(prev, newServiceIds);
      setSkuBlockWarning(skuWarning);
      return next;
    });
  };

  const handleMoveSkuToNewVisit = (sourceAppointment, serviceId) => {
    if (!canEditAppt(sourceAppointment)) return;
    pendingMoveSkuRef.current = {
      fromAppointmentId: sourceAppointment.id,
      serviceId: String(serviceId),
    };
    travelRecalculatedRef.current = false;
    fetchServices();
    setCurrentAppointment(null);
    setFormData({
      ...initialFormData,
      work_order_id: workOrderId,
      appointment_type: deriveLegacyAppointmentType([serviceId], allServices),
      service_ids: [String(serviceId)],
      assigned_technician_id: sourceAppointment.assigned_technician_id || '',
      time_window: sourceAppointment.time_window || null,
    });
    setSkuBlockWarning(null);
    setFormErrors({});
    setShowForm(true);
    setSuccessMessage(null);
    setError(null);
  };

  const finalizeSkuMoveFromSource = async (fromAppointmentId, serviceId) => {
    const source = appointments.find((a) => a.id === fromAppointmentId);
    if (!source) return;
    const remaining = resolveAppointmentServiceIds(source).filter(
      (id) => !serviceIdsMatch(id, serviceId)
    );
    await updateAppointment(fromAppointmentId, {
      service_ids: remaining,
      appointment_type: deriveLegacyAppointmentType(remaining, allServices),
    });
  };

  const handleExtendCalendarBlock = () => {
    setFormData((prev) => {
      if (!prev.scheduled_start) return prev;
      const plannedMinutes = sumPlannedDurationMinutes(prev.service_ids, allServices);
      try {
        const startDate = parseISO(prev.scheduled_start);
        return {
          ...prev,
          scheduled_end: formatDateTimeForInput(addMinutes(startDate, plannedMinutes)),
        };
      } catch (error) {
        console.error('[handleExtendCalendarBlock] Error extending block:', error);
        return prev;
      }
    });
    setSkuBlockWarning(null);
  };

  // Validate form before submission
  const validateForm = () => {
    const errors = {};
    
    if (!selectedServiceCategory && !formData.service_ids?.length) {
      errors.service_category = 'Select a service category.';
    }
    if (!formData.service_ids?.length) {
      errors.service_ids = 'Select at least one SKU for this visit.';
    }
    if (!formData.status) errors.status = 'Status is required';
    if (!formData.scheduled_start) errors.scheduled_start = 'Scheduled start time is required';
    if (formData.scheduled_start && formData.scheduled_end) {
      if (new Date(formData.scheduled_end) <= new Date(formData.scheduled_start)) {
        errors.scheduled_end = 'End time must be after start time.';
      } else if (formData.assigned_technician_id) {
        const conflictReason = checkProposedScheduleConflict(
          formData.scheduled_start,
          formData.scheduled_end
        );
        if (conflictReason && !(canForceSchedule && formData.is_forced_schedule)) {
          errors.scheduled_start = conflictReason;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyCalculatedSlot = (slot) => {
    travelRecalculatedRef.current = true;
    setFormData((prev) => ({
      ...prev,
      scheduled_start: formatDateTimeForInput(slot.startTime),
      scheduled_end: formatDateTimeForInput(slot.endTime),
      travel_time_before: slot.travelTimeBefore ?? slot.travelTime ?? null,
      travel_distance_before: slot.travelDistanceBefore ?? slot.travelDistance ?? null,
    }));
  };

  const buildSlotFinderOptions = (overrides = {}) => ({
    schedulingAnchorTime: schedulingAnchorRef.current || new Date(),
    ...overrides,
  });

  const promptWindowOverflow = (slot, windowName, dailySchedule) =>
    new Promise((resolve) => {
      setWindowOverflowPrompt({
        slot,
        windowName,
        dailySchedule,
        resolve,
      });
    });

  const handleWindowOverflowAccept = () => {
    if (!windowOverflowPrompt?.slot) return;
    windowOverflowAcceptedRef.current = true;
    applyCalculatedSlot(windowOverflowPrompt.slot);
    windowOverflowPrompt.resolve?.(true);
    setWindowOverflowPrompt(null);
  };

  const handleWindowOverflowCancel = () => {
    windowOverflowPrompt?.resolve?.(false);
    setWindowOverflowPrompt(null);
  };

  const handleWindowOverflowNextDay = async () => {
    const prompt = windowOverflowPrompt;
    if (!prompt) return;

    const {
      windowName,
      dailySchedule,
      resolve: resolvePrompt,
    } = prompt;
    setWindowOverflowPrompt(null);
    resolvePrompt?.(false);

    const selectedDateStr = formData.scheduled_start.split('T')[0];
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    let tryDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    const toAddress = resolvedWorkOrderAddress;
    const duration = estimatedServiceDurationMinutes;
    const previousAppointment = getPreviousAppointment(
      tryDate,
      windowName,
      formData.assigned_technician_id,
      dailySchedule
    );
    const fromAddress =
      previousAppointment?.address ||
      DEFAULT_SHOP_ADDRESS ||
      '641 Barclay Drive, Toledo, OH 43609, USA';

    setIsCalculating(true);
    setError(null);

    try {
      for (let offset = 1; offset <= 14; offset += 1) {
        const candidateDate = addDays(tryDate, offset);
        const slot = await findNextAvailableSlot(
          candidateDate,
          windowName,
          dailySchedule,
          formData.assigned_technician_id,
          fromAddress,
          toAddress,
          duration,
          buildSlotFinderOptions({ schedulingMode: 'first-slot' })
        );

        if (slot && !slot.exceedsCustomerWindow) {
          windowOverflowAcceptedRef.current = false;
          applyCalculatedSlot(slot);
          setSuccessMessage(
            `Moved to ${format(candidateDate, 'MM/dd/yyyy')} — first open slot in the ${windowName} window.`
          );
          return;
        }
      }
      setError(
        'No slot found in the next two weeks that fits within the customer time window. Try another window or date.'
      );
    } catch (err) {
      console.error('[AppointmentScheduler] Error finding next-day slot:', err);
      setError(err.message || 'Could not find a slot on a later date.');
    } finally {
      setIsCalculating(false);
    }
  };

  const slotExceedsCustomerWindow = (start, end, windowName) => {
    if (!start || !end || !windowName) return false;
    const startDate = parseISO(String(start));
    const endDate = parseISO(String(end));
    const { endTime: windowEnd } = getTimeWindowBoundaries(startDate, windowName);
    return endDate > windowEnd;
  };

  // Add resetForm function
  const resetForm = () => {
    setFormData({
      ...initialFormData, // Use initialFormData to ensure all fields are reset
      work_order_id: workOrderId, // Keep workOrderId
      // Reset dynamic parts like start/end times if necessary, or rely on initialFormData
      scheduled_start: '', 
      scheduled_end: '',
      service_ids: [],
      is_forced_schedule: false,
    });
    setFormErrors({});
    setShowForm(false);
    setCurrentAppointment(null);
    setSelectedServiceCategory('');
    setWindowOverflowPrompt(null);
    schedulingAnchorRef.current = null;
    windowOverflowAcceptedRef.current = false;
    travelRecalculatedRef.current = false;
    pendingMoveSkuRef.current = null;
    setSkuBlockWarning(null);
  };

  // Add openForm function
  const openForm = async () => {
    if (!canCreateAppts) return;
    fetchServices();

    schedulingAnchorRef.current = new Date();
    windowOverflowAcceptedRef.current = false;
    travelRecalculatedRef.current = false;

    const techList = technicians;
    const now = schedulingAnchorRef.current;
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

    const defaultTech = pickDefaultTechnician(techList);
    
    setFormData({
      ...initialFormData,
      work_order_id: workOrderId,
      appointment_type: 'diagnostic',
      status: 'scheduled',
      scheduled_start: formatDateTimeForInput(startTime),
      scheduled_end: formatDateTimeForInput(endTime),
      assigned_technician_id: defaultTech ? defaultTech.id : '',
      notes: '',
      service_ids: [],
      time_window: null
    });
    
    setSelectedServiceCategory('');
    setFormErrors({});
    setCurrentAppointment(null);
    setShowForm(true);
  };

  // Function to set up form for editing an existing appointment
  const editAppointment = (appointment) => {
    if (!canEditAppt(appointment)) return;
    travelRecalculatedRef.current = false;
    console.log('[EditAppointment] Appointment received:', JSON.parse(JSON.stringify(appointment)));
    fetchServices(); // Ensures services are fetched or being fetched
    setCurrentAppointment(appointment);
    const servicesFromAppointment = resolveAppointmentServiceIds(appointment);
    console.log('[EditAppointment] servicesFromAppointment (IDs):', servicesFromAppointment);
    
    const newFormData = {
      ...initialFormData, // Start with initial form data
      work_order_id: workOrderId, // ensure work_order_id is correct
      appointment_type: appointment.appointment_type || 'diagnostic',
      status: appointment.status || 'scheduled',
      scheduled_start: formatDateTimeForInput(appointment.scheduled_start),
      scheduled_end: formatDateTimeForInput(appointment.scheduled_end),
      assigned_technician_id: appointment.assigned_technician_id || '',
      notes: appointment.notes || '',
      travel_time_before: appointment.travel_time_before, 
      travel_time_after: appointment.travel_time_after,
      travel_distance_before: appointment.travel_distance_before,
      travel_distance_after: appointment.travel_distance_after,
      is_forced_schedule: appointment.is_forced_schedule || false,
      service_ids: servicesFromAppointment, // Ensure service_ids are set in formData
      time_window: appointment.time_window || null,
      // actual_start and actual_end are not part of the update form
    };
    console.log('[EditAppointment] formData set to:', JSON.parse(JSON.stringify(newFormData)));
    setFormData(newFormData);

    if (servicesFromAppointment.length > 0 && allServices.length > 0) {
      const serviceDetails = allServices.find((s) =>
        serviceIdsMatch(s.id, servicesFromAppointment[0])
      );
      if (serviceDetails?.service_type) {
        setSelectedServiceCategory(serviceDetails.service_type);
      }
    }

    // Category/SKU select also sync via useEffect when allServices loads after fetchServices().

    setFormErrors({});
    setSkuBlockWarning(null);
    setShowForm(true);
    console.log('[EditAppointment] Form shown.');
  };

  // Handle appointments created through the auto scheduler
  const handleAutoSchedule = async (appointmentData) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      console.log("Creating appointment with travel time data:", appointmentData);
      const response = await createWorkOrderAppointment(workOrderId, appointmentData);
      
      console.log("Auto-scheduled appointment created:", response);
      setSuccessMessage("Appointment scheduled successfully!");
      
      // Refresh the appointments list
      await fetchAppointments();
      
      // Notify parent component
      if (onAppointmentChange) {
        onAppointmentChange();
      }
      
      // Reset view mode to list
      setViewMode('list');
    } catch (err) {
      console.error("Error creating auto-scheduled appointment:", err);
      setError(`Failed to schedule appointment: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update handleTimeWindowSelect to pass technicianDailySchedule
  const handleTimeWindowSelect = async (windowName, windowInfo) => {
    console.log('[AppointmentScheduler] handleTimeWindowSelect', { windowName, windowInfo });

    if (!windowName) {
      setError(null);
      setFormData((prev) => ({ ...prev, time_window: null }));
      return;
    }

    if (!windowInfo?.available) {
      const reason = windowInfo?.reason || 'Availability check failed';
      console.error(`[AppointmentScheduler] Time window ${windowName} is unavailable. Reason: ${reason}`, windowInfo);
      setError(`Time window ${windowName} is not available. Reason: ${reason}`);
      setFormData((prev) => ({
        ...prev,
        time_window: null,
        travel_time_before: null,
        travel_distance_before: null,
      }));
      return;
    }

    if (!resolvedWorkOrderAddress) {
      setError('This work order needs a service address before you can schedule. Edit the work order and set a property or service location.');
      return;
    }
    if (!formData.assigned_technician_id) {
      setError('Please select a technician before choosing a time window.');
      return;
    }

    setFormData((prev) => ({ ...prev, time_window: windowName }));

    if (formData.scheduled_start && !isLoadingSchedule) {
      const scheduleForCalc = currentAppointment
        ? technicianDailySchedule.filter((a) => a.id !== currentAppointment.id)
        : technicianDailySchedule;
      await calculateAppointmentTime(scheduleForCalc, windowName);
    } else if (isLoadingSchedule) {
      setError('Technician schedule is loading, please wait...');
    } else {
      setError('Please select a date first.');
    }
  };

  // Update calculateAppointmentTime signature and internal logic
  // It now receives the technician's full daily schedule
  const calculateAppointmentTime = async (dailySchedule, windowName) => {
    // Rename currentAppointments parameter to dailySchedule for clarity
    console.log(`[AppointmentScheduler] calculateAppointmentTime called. Using windowName: ${windowName}`);
    console.log(`[AppointmentScheduler] Using dailySchedule with length: ${dailySchedule?.length || 0}`);

    if (!formData.scheduled_start) {
      console.error('[AppointmentScheduler] calculateAppointmentTime: No date selected.');
      setError("Please select a date first");
      return false;
    }
    
    // Use passed windowName for validation
    if (!windowName) { 
      console.error('[AppointmentScheduler] calculateAppointmentTime: No time window provided.');
      setError("Please select a time window"); 
      return false;
    }
    
    setIsCalculating(true);
    
    try {
      // Get the selected date part only (YYYY-MM-DD) and create a date object at noon
      // Ensure scheduled_start is a string before splitting
      const scheduledStartStr = String(formData.scheduled_start || '');
      const selectedDateStr = scheduledStartStr.split('T')[0];
      
      if (!selectedDateStr) {
        console.error('[AppointmentScheduler] calculateAppointmentTime: Cannot parse date from scheduled_start:', scheduledStartStr);
        setError("Invalid date selected.");
        return false;
      }
      
      const dateParts = selectedDateStr.split('-').map(Number);
      const selectedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0, 0);
      
      console.log(`Selected date: ${selectedDate.toISOString()}`);
      // Use passed windowName for logging and logic
      console.log(`Selected time window: ${windowName}`); 
      
      // Get the service address from props
      const toAddress = resolvedWorkOrderAddress;
      
      if (!toAddress) {
        setError('This work order needs a service address before you can schedule. Edit the work order and set a property or service location.');
        setIsCalculating(false);
        return false;
      }

      if (!formData.assigned_technician_id) {
        setError('Please select a technician before scheduling.');
        setIsCalculating(false);
        return false;
      }
      
      // Get the previous appointment location or shop address
      // Pass dailySchedule to getPreviousAppointment
      const previousAppointment = getPreviousAppointment(selectedDate, windowName, formData.assigned_technician_id, dailySchedule);
      
      // Get address to travel from (previous appointment or shop)
      const fromAddress = previousAppointment?.address || DEFAULT_SHOP_ADDRESS || '641 Barclay Drive, Toledo, OH 43609, USA'; // Use imported constant
      
      console.log(`Calculating travel from ${fromAddress} to ${toAddress}`);
      
      const duration = estimatedServiceDurationMinutes;

      console.log(`Selected services duration: ${duration} minutes`);

      const slot = await findNextAvailableSlot(
        selectedDate,
        windowName,
        dailySchedule,
        formData.assigned_technician_id,
        fromAddress,
        toAddress,
        duration,
        buildSlotFinderOptions()
      );
      
      console.log(`[AppointmentScheduler] findNextAvailableSlot result:`, slot);
      
      if (!slot) {
        setError(
          `No open slots in the ${windowName} window on this date — the technician's active schedule is full. Try another date or window, or check for overlapping appointments.`
        );
        setIsCalculating(false);
        return false;
      }
      
      // Debugging to help diagnose time window issues
      // Use passed windowName to get boundaries
      const { startTime, endTime } = getTimeWindowBoundaries(selectedDate, windowName);
      console.log('Time window boundaries:', {
        window: windowName, // Use passed windowName
        windowStart: startTime.toLocaleString(),
        windowEnd: endTime.toLocaleString()
      });
      
      console.log('Found available slot:', {
        startTime: slot.startTime.toLocaleString(),
        endTime: slot.endTime.toLocaleString(),
        travelTime: slot.travelTimeBefore,
        distance: slot.travelDistanceBefore
      });
      
      if (slot.startTime < startTime || slot.startTime >= endTime) {
        console.error('Error: Calculated slot is outside the selected time window!');
        console.log(`Slot start: ${slot.startTime.toLocaleString()}, Window: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
        setError(`No available slot fits within the ${windowName} time window on this date. All slots are taken — please try a different date or window.`);
        setIsCalculating(false);
        return false;
      }

      if (slot.exceedsCustomerWindow && !windowOverflowAcceptedRef.current) {
        setIsCalculating(false);
        return promptWindowOverflow(slot, windowName, dailySchedule);
      }

      windowOverflowAcceptedRef.current = false;
      applyCalculatedSlot(slot);

      setIsCalculating(false);
      return true;
    } catch (error) {
      console.error("Error calculating appointment time:", error);
      setError(`Error calculating appointment time: ${error.message}`);
      setIsCalculating(false);
      return false;
    }
  };

  // Update getPreviousAppointment signature
  const getPreviousAppointment = (date, windowName, technicianId, dailySchedule) => {
    // Rename currentAppointments to dailySchedule
    if (!technicianId) return null;

    const { startTime } = getTimeWindowBoundaries(date, windowName); 
    const targetDateStr = date.toISOString().split('T')[0];

    // Filter appointments from the passed dailySchedule
    const techAppointments = dailySchedule.filter(apt => {
      if (!apt.scheduled_end || !apt.assigned_technician_id || apt.assigned_technician_id !== technicianId) {
          return false;
      }

      const aptEndTime = new Date(apt.scheduled_end);
      const aptEndDateStr = aptEndTime.toISOString().split('T')[0];

      // Ensure startTime is valid
      if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
         console.error("[getPreviousAppointment] Invalid startTime calculated from time window boundaries.");
         return false;
      }

      // Check if it ends on the same day AND before the window starts
      return aptEndDateStr === targetDateStr && aptEndTime < startTime;
    });

    if (techAppointments.length === 0) return null;

    // Sort by end time (descending) and get the most recent one
    techAppointments.sort((a, b) => new Date(b.scheduled_end) - new Date(a.scheduled_end));

    const previousApt = techAppointments[0];
    const previousAddress = resolveAppointmentLocation(previousApt);
    
    console.log(`[getPreviousAppointment] Found previous appointment for tech ${technicianId}: ID=${previousApt?.id}, EndTime=${previousApt?.scheduled_end}, Address=${previousAddress}`);

    // Return the previous appointment object containing its address
    // The calling function (calculateAppointmentTime) will extract the address
    return {
      ...previousApt,
      address: previousAddress // Return the actual address of the previous appointment
    };
  };

  // Update the handleSubmit function to use calculateAppointmentTime
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log(`[AppointmentScheduler] handleSubmit triggered.`);
    
    if (!validateForm()) {
      console.warn('[AppointmentScheduler] Form validation failed.', formErrors);
      return;
    }

    if (currentAppointment) {
      if (!canEditAppt(currentAppointment)) {
        setError('You cannot edit this appointment.');
        return;
      }
    } else if (!canCreateAppts) {
      setError('You cannot create appointments on this work order.');
      return;
    }

    const conflictReason = checkProposedScheduleConflict(
      formData.scheduled_start,
      formData.scheduled_end
    );
    let forceOnSave = Boolean(canForceSchedule && formData.is_forced_schedule);

    if (conflictReason && !forceOnSave) {
      if (!canForceSchedule) {
        setError(conflictReason);
        return;
      }
      const confirmed = window.confirm(
        `This time overlaps the technician's schedule:\n\n${conflictReason}\n\nForce schedule anyway? The appointment will be flagged as a manager override.`
      );
      if (!confirmed) return;
      forceOnSave = true;
    }

    if (
      formData.time_window &&
      slotExceedsCustomerWindow(
        formData.scheduled_start,
        formData.scheduled_end,
        formData.time_window
      ) &&
      !windowOverflowAcceptedRef.current
    ) {
      const { endTime: windowEnd } = getTimeWindowBoundaries(
        parseISO(formData.scheduled_start),
        formData.time_window
      );
      const accepted = await promptWindowOverflow(
        {
          startTime: parseISO(formData.scheduled_start),
          endTime: parseISO(formData.scheduled_end),
          travelTimeBefore: formData.travel_time_before,
          travelDistanceBefore: formData.travel_distance_before,
          windowEndTime: windowEnd,
          exceedsCustomerWindow: true,
        },
        formData.time_window,
        technicianDailySchedule
      );
      if (!accepted) return;
    }

    // Ensure we're not already submitting
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // Ensure the data being submitted is up-to-date from state
      // (The state should have been updated when the window was selected)
      const legacyAppointmentType = deriveLegacyAppointmentType(formData.service_ids, allServices);
      const moveCtx = pendingMoveSkuRef.current;
      console.log("[AppointmentScheduler] Submitting appointment:", formData);
      
      // Prepare appointment data
      const appointmentData = {
        ...formData,
        appointment_type: legacyAppointmentType,
        work_order_id: workOrderId,
        travel_time_before: parseTravelInt(formData.travel_time_before),
        travel_time_after: parseTravelInt(formData.travel_time_after),
        travel_distance_before: parseTravelInt(formData.travel_distance_before),
        travel_distance_after: parseTravelInt(formData.travel_distance_after),
        service_ids: formData.service_ids || [],
        is_forced_schedule: forceOnSave,
      };

      if (currentAppointment && !travelRecalculatedRef.current) {
        delete appointmentData.travel_time_before;
        delete appointmentData.travel_time_after;
        delete appointmentData.travel_distance_before;
        delete appointmentData.travel_distance_after;
      }
      
      let response;
      
      if (currentAppointment) {
        // Update existing appointment
        response = await updateAppointment(currentAppointment.id, appointmentData);
        console.log("Appointment updated:", response);
        setSuccessMessage("Appointment updated successfully!");
      } else {
        response = await createWorkOrderAppointment(workOrderId, appointmentData);
        console.log("Appointment created:", response);
        if (moveCtx) {
          await finalizeSkuMoveFromSource(moveCtx.fromAppointmentId, moveCtx.serviceId);
          setSuccessMessage('SKU moved to new visit.');
        } else {
          setSuccessMessage('Appointment created successfully!');
        }
      }
      
      // Refresh appointments
      await fetchAppointments();
      resetForm();
      setShowForm(false);
      windowOverflowAcceptedRef.current = false;
      
      // Notify parent component
      if (onAppointmentChange) {
        onAppointmentChange();
      }
    } catch (err) {
      console.error("Error saving appointment:", err);
      const msg = err?.message || 'Unknown error';
      if (canForceSchedule && /conflict|overlap|time block/i.test(msg)) {
        setError(`${msg} — check "Force schedule" or confirm when prompted to override.`);
      } else {
        setError(`Failed to save appointment: ${msg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete appointment
  const handleDelete = async (appointmentId) => {
    if (!canDeleteAppts) return;
    if (!window.confirm('Are you sure you want to delete this appointment?')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Find the appointment to delete (to check if it's primary)
      const appointmentToDelete = appointments.find(a => a.id === appointmentId);
      console.log("Deleting appointment:", appointmentToDelete);
      
      // Delete the appointment - this will return null for a 204 No Content response
      await deleteAppointment(appointmentId);
      console.log("Appointment deleted successfully");
      
      // If we just deleted the primary appointment and there are other appointments,
      // update work order scheduled time with the next available appointment
      if (appointmentToDelete) {
        try {
          // Get remaining appointments excluding the one we just deleted
          const remainingAppointments = appointments.filter(a => a.id !== appointmentId);
          
          // If this was the only appointment or potentially the primary one,
          // we might need to update the work order schedule
          if (remainingAppointments.length === 0) {
            console.log("No appointments left after deletion. Clearing work order schedule.");
            
            // No appointments left - clear the work order scheduled times
            await apiClient(`api/work-orders/${workOrderId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                scheduled_start: null,
                scheduled_end: null
              })
            });
            
            console.log("Work order schedule cleared successfully");
          } else {
            // Find the earliest remaining scheduled appointment
            const sortedAppointments = [...remainingAppointments].sort(
              (a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start)
            );
            
            const earliestAppointment = sortedAppointments[0];
            console.log("Updating work order schedule with earliest remaining appointment:", earliestAppointment);
            
            // Update work order with earliest appointment's schedule
            await apiClient(`api/work-orders/${workOrderId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                scheduled_start: earliestAppointment.scheduled_start,
                scheduled_end: earliestAppointment.scheduled_end
              })
            });
            
            console.log("Work order schedule updated successfully");
          }
        } catch (scheduleErr) {
          console.error("Error updating work order schedule after appointment deletion:", scheduleErr);
          // Continue even if update fails - the appointment will still be deleted
        }
      }
      
      // Refresh appointments
      await fetchAppointments();
      
      // Notify parent component that appointments have changed
      if (onAppointmentChange && typeof onAppointmentChange === 'function') {
        onAppointmentChange();
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setError('Failed to delete appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (appointmentId, newStatus) => {
    const target = appointments.find((a) => a.id === appointmentId);
    if (!target || !canStatusAppt(target)) {
      setError('You cannot change status on this appointment.');
      return;
    }

    setUpdatingStatus(appointmentId);
    setError(null);
    
    try {
      const result = await updateAppointmentStatus({
        appointmentId,
        status: newStatus,
      });
      
      // Update the local state immediately for better UX
      setAppointments(prev => 
        prev.map(appointment => 
          appointment.id === appointmentId 
            ? { ...appointment, status: newStatus }
            : appointment
        )
      );
      
      // Notify parent component that appointments have changed
      if (onAppointmentChange && typeof onAppointmentChange === 'function') {
        onAppointmentChange();
      }

      if (result?.queued) {
        setError(null);
      }
      
    } catch (err) {
      console.error('Error updating appointment status:', err);
      console.error('Error response:', err.response?.data);
      
      let errorDetail = 'Failed to update appointment status. Please try again.';
      
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Handle validation errors array
          errorDetail = err.response.data.detail.map(error => error.msg || error).join(', ');
        } else {
          errorDetail = err.response.data.detail;
        }
      }
      
      setError(errorDetail);
      // Refresh appointments to revert any optimistic updates
      await fetchAppointments();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getDurationLabel = (start, end) => {
    if (!start || !end) return null;
    try {
      const mins = differenceInMinutes(new Date(end), new Date(start));
      if (mins <= 0) return null;
      if (mins < 60) return `${mins} min`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m ? `${h}h ${m}m` : `${h}h`;
    } catch {
      return null;
    }
  };

  const getAccentBorder = (status) => {
    switch (status) {
      case 'scheduled': return 'border-l-cyan-500';
      case 'en_route': return 'border-l-blue-400';
      case 'in_progress': return 'border-l-indigo-400';
      case 'completed_pending_payment': return 'border-l-amber-400';
      case 'completed': return 'border-l-emerald-500';
      case 'reschedule': return 'border-l-purple-400';
      case 'unreachable':
      case 'canceled': return 'border-l-red-500/80';
      case 'failed': return 'border-l-amber-500/80';
      case 'redo': return 'border-l-indigo-400';
      default: return 'border-l-gray-500';
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'en_route': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300';
      case 'completed_pending_payment': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';      
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'reschedule': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'refund': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'phone_payment': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'unreachable': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'failed': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'canceled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'redo': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Define appointment types for dropdown
  const appointmentTypes = [
    { value: 'diagnostic', label: 'Diagnostic' },
    { value: 'repair', label: 'Repair' },
    { value: 'follow-up', label: 'Follow-up' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'maintenance', label: 'Maintenance' }
  ];

  // Get appointment type display name
  const getAppointmentTypeLabel = (type) => {
    switch (type) {
      case 'diagnostic': return 'Diagnostic';
      case 'repair': return 'Repair';
      case 'follow-up': return 'Follow-up';
      case 'inspection': return 'Inspection';
      case 'maintenance': return 'Maintenance';
      default: return type;
    }
  };

  // Define status options for dropdown
  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'reschedule', label: 'Needs Reschedule' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled', label: 'Canceled' }
  ];

  // Find technician name by ID
  const getTechnicianName = (techId) => {
    if (!techId) return 'Unassigned';
    const technician = technicians.find(tech => tech.id === techId);
    console.log("Found technician for ID", techId, technician);
    
    if (!technician) return 'Unassigned';
    
    // Check if user field exists and contains name information
    if (technician.user && (technician.user.first_name || technician.user.last_name)) {
      return `${technician.user.first_name || ''} ${technician.user.last_name || ''}`.trim();
    }
    
    // Fallback to technician's own properties
    if (technician.first_name || technician.last_name) {
      return `${technician.first_name || ''} ${technician.last_name || ''}`.trim();
    }
    
    // Fallback to any name property that might exist
    if (technician.name) {
      return technician.name;
    }
    
    return `Technician #${techId}`;
  };

  const statusOptionsForAppointment = (appointment, statusEditable) => {
    const current = appointment?.status;
    const transitionOptions =
      woClosed && statusEditable
        ? CLOSED_APPOINTMENT_STATUS_OPTIONS
        : OPEN_APPOINTMENT_STATUS_OPTIONS;

    if (!current || transitionOptions.some((opt) => opt.value === current)) {
      return transitionOptions;
    }

    // Keep the stored status in the list so the <select> never coerces to the first option.
    return [
      {
        value: current,
        label: formatAppointmentStatus(current, { long: current === 'failed' }),
        disabled: true,
      },
      ...transitionOptions,
    ];
  };

  const handleStatusSelect = (appointmentId, currentStatus, newStatus) => {
    if (newStatus === currentStatus) return;
    handleStatusUpdate(appointmentId, newStatus);
  };

  const renderMobileAppointmentCards = () => (
    <div className="space-y-3">
      {sortedAppointments.map((appointment, visitIndex) => {
        const duration = getDurationLabel(appointment.scheduled_start, appointment.scheduled_end);
        const statusEditable = canStatusAppt(appointment);
        const appointmentEditable = canEditAppt(appointment);
        return (
          <article
            key={appointment.id}
            className={`rounded-xl border border-white/10 bg-white/[0.03] border-l-[3px] px-3 py-3 ${getAccentBorder(appointment.status)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white flex flex-wrap items-center gap-1.5">
                  {getVisitLabel(appointment, visitIndex)}
                  {appointment.is_forced_schedule && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-500/40">
                      Forced
                    </span>
                  )}
                </p>
                <p className="text-xs text-cyan-300/90 mt-0.5">
                  {formatDateTime(appointment.scheduled_start)} – {formatTime(appointment.scheduled_end)}
                </p>
                {duration && (
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{duration}</p>
                )}
              </div>
              <select
                value={appointment.status}
                onChange={(e) => handleStatusSelect(appointment.id, appointment.status, e.target.value)}
                disabled={!statusEditable || updatingStatus === appointment.id}
                title={!statusEditable ? 'You cannot change status on this appointment' : undefined}
                className={`shrink-0 max-w-[7.5rem] px-2 py-1 rounded text-[10px] font-semibold border-0 ${getStatusColor(appointment.status)} ${
                  !statusEditable || updatingStatus === appointment.id
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                {statusOptionsForAppointment(appointment, statusEditable).map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={Boolean(opt.disabled)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5 min-w-0">
              <FaUserClock className="shrink-0 text-gray-500" />
              <span className="truncate">{getTechnicianName(appointment.assigned_technician_id)}</span>
            </p>
            {resolvedWorkOrderAddress && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{resolvedWorkOrderAddress}</p>
            )}
            <VisitSkuAccordion
              appointment={appointment}
              catalogServices={allServices}
              workOrderServices={workOrder?.services || []}
              expanded={Boolean(expandedVisitIds[appointment.id])}
              onToggle={() => toggleVisitSkuPanel(appointment.id)}
              onMoveSku={handleMoveSkuToNewVisit}
              canEdit={appointmentEditable}
              compact
            />
            {appointment.notes && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{appointment.notes}</p>
            )}
            {(appointment.travel_time_before || appointment.travel_distance_before) && (
              <div className="mt-2">
                <TravelTimeInfo
                  travelTimeBefore={appointment.travel_time_before}
                  travelTimeAfter={appointment.travel_time_after}
                  travelDistanceBefore={appointment.travel_distance_before}
                  travelDistanceAfter={appointment.travel_distance_after}
                  compact={true}
                />
              </div>
            )}
            {(appointmentEditable || canDeleteAppts) && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
              {appointmentEditable && (
                <button
                  type="button"
                  onClick={() => editAppointment(appointment)}
                  className="flex-1 h-9 rounded-lg border border-cyan-500/35 text-xs font-semibold uppercase tracking-wide text-cyan-300"
                >
                  Edit
                </button>
              )}
              {canDeleteAppts && (
                <button
                  type="button"
                  onClick={() => handleDelete(appointment.id)}
                  className="h-9 px-3 rounded-lg border border-red-500/30 text-xs font-semibold uppercase tracking-wide text-red-300"
                >
                  Delete
                </button>
              )}
            </div>
            )}
          </article>
        );
      })}
    </div>
  );

  const renderAddAppointmentButton = (size = 'sm') => {
    if (!canCreateAppts) return null;
    if (isMobile) {
      return (
        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300"
        >
          <FaPlus className="h-3 w-3" />
          Add
        </button>
      );
    }
    return (
      <Button onClick={openForm} variant="primary" size={size} Icon={FaPlus}>
        Add Appointment
      </Button>
    );
  };

  return (
      <div
        className={
          isMobile
            ? 'min-w-0 overflow-x-hidden'
            : 'bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden'
        }
      >
      {/* {woClosed && (
        <WorkOrderReadOnlyBanner className={isMobile ? 'mb-3' : 'mx-6 mt-4'} />
      )} */}
      <div
        className={
          isMobile
            ? 'flex items-center justify-between gap-2 mb-3 px-0.5'
            : 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between'
        }
      >
        <h2
          className={
            isMobile
              ? 'text-xs font-semibold uppercase tracking-wider text-gray-500'
              : 'text-lg font-medium text-gray-900 dark:text-white'
          }
        >
          Appointments
        </h2>
        <div className={isMobile ? 'flex gap-1.5' : 'flex space-x-2'}>
          {!isMobile && (
          <Button 
            onClick={() => setViewMode('list')} 
            variant={viewMode === 'list' ? "primary" : "secondary"} 
            size="sm"
          >
            List View
          </Button>
          )}
          {/* Comment out Calendar button */}
          {/*
          <Button 
            onClick={() => setViewMode('calendar')} 
            variant={viewMode === 'calendar' ? "primary" : "secondary"} 
            size="sm" 
            Icon={FaCalendarAlt}
          >
            Calendar
          </Button>
          */}
          {/* Comment out Auto Schedule button */}
          {/*
          <Button 
            onClick={() => setViewMode('auto')} 
            variant={viewMode === 'auto' ? "primary" : "secondary"} 
            size="sm" 
            Icon={FaUserClock}
          >
            Auto Schedule
          </Button>
          */}
          {/* Comment out Time Windows button */}
          {/*
          <Button 
            onClick={() => setViewMode('window')} 
            variant={viewMode === 'window' ? "primary" : "secondary"} 
            size="sm" 
            Icon={FaClock}
          >
            Time Windows
          </Button>
          */}
          {renderAddAppointmentButton()}
        </div>
      </div>
      
      {/* Window Scheduler View */}
      {viewMode === 'window' && (
        <div className="px-6 py-4">
          <WindowScheduler
            workOrderId={workOrderId}
            workOrderAddress={resolvedWorkOrderAddress}
            onAppointmentCreated={() => {
              fetchAppointments();
              if (onAppointmentChange) {
                onAppointmentChange();
              }
            }}
          />
        </div>
      )}
      
      {/* Auto Scheduler View */}
      {viewMode === 'auto' && (
        <div className="px-6 py-4">
          <AutoScheduler
            workOrderId={workOrderId}
            workOrderAddress={resolvedWorkOrderAddress}
            existingAppointments={appointments}
            onScheduleCreated={handleAutoSchedule}
            technicians={technicians}
          />
        </div>
      )}
      
      {/* List View or Calendar View - continue with existing code */}
      {viewMode !== 'auto' && viewMode !== 'window' && (
        <div className={isMobile ? 'min-w-0' : 'px-6 py-5'}>
          {/* Add appointment form */}
          {showForm && (
            <div
              className={
                isMobile
                  ? 'mb-4 p-3 rounded-xl border border-white/10 bg-white/[0.03]'
                  : 'mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-md'
              }
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {currentAppointment ? `Edit Appointment (${currentVisitLabel})` : 'New Appointment'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {pendingMoveSkuRef.current && (
                  <p className="text-sm text-cyan-700 dark:text-cyan-300 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                    Scheduling a new visit for a moved SKU. The SKU will be removed from the previous visit when you save.
                  </p>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="service_category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Service Category *
                    </label>
                    <select
                      id="service_category"
                      name="service_category"
                      value={selectedServiceCategory}
                      onChange={handleServiceCategoryChange}
                      className={`block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${
                        formErrors.service_category ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''
                      }`}
                      required
                    >
                      <option value="">Select service category...</option>
                      {serviceCategories.map((category) => (
                        <option key={category} value={category}>
                          {category === 'other'
                            ? 'Other'
                            : `${category.charAt(0).toUpperCase()}${category.slice(1).toLowerCase()}`}
                        </option>
                      ))}
                    </select>
                    {formErrors.service_category && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.service_category}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Switch category to add SKUs from another type.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="service_ids" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Services / SKUs *
                    </label>
                    {servicesLoading && !selectedServiceCategory ? (
                      <LoadingSpinner size="small" />
                    ) : !selectedServiceCategory ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                        Select a service category first.
                      </p>
                    ) : servicesForSelectedCategory.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                        No services in this category.
                      </p>
                    ) : (
                      <Select
                        id="service_ids"
                        isMulti
                        controlShouldRenderValue={false}
                        options={servicesForSelectedCategory.map(formatSkuPickerOption)}
                        value={servicesForSelectedCategory
                          .filter((service) => formIncludesServiceId(formData.service_ids, service.id))
                          .map(formatSkuPickerOption)}
                        onChange={handleServiceChange}
                        className="basic-multi-select"
                        classNamePrefix="select"
                        placeholder="Add services from this category..."
                        isDisabled={!selectedServiceCategory || servicesLoading || servicesForSelectedCategory.length === 0}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: 'var(--color-bg-input, #1f2937)',
                            borderColor: state.isFocused ? 'var(--color-ring-focus, #3b82f6)' : 'var(--color-border-input, #4b5563)',
                            boxShadow: state.isFocused ? '0 0 0 1px var(--color-ring-focus, #3b82f6)' : 'none',
                            '&:hover': {
                              borderColor: 'var(--color-border-input-hover, #6b7280)',
                            },
                            borderRadius: '0.375rem',
                            minHeight: '38px',
                          }),
                          valueContainer: (base) => ({
                            ...base,
                            padding: '2px 8px',
                          }),
                          menu: (base) => ({
                            ...base,
                            backgroundColor: 'var(--color-bg-menu, #1f2937)',
                            zIndex: 50,
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? 'var(--color-bg-option-selected, #3b82f6)'
                              : state.isFocused
                                ? 'var(--color-bg-option-focused, #374151)'
                                : 'transparent',
                            color: state.isSelected ? 'white' : 'var(--color-text-default, #d1d5db)',
                            '&:hover': {
                              backgroundColor: 'var(--color-bg-option-hover, #374151)',
                            },
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: 'var(--color-text-placeholder, #9ca3af)',
                          }),
                          input: (base) => ({
                            ...base,
                            color: 'var(--color-text-input, #e5e7eb)',
                          }),
                          indicatorSeparator: () => ({
                            display: 'none',
                          }),
                        }}
                      />
                    )}

                    {formData.service_ids?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {formData.service_ids.map((id) => {
                          const service = allServices.find((s) => serviceIdsMatch(s.id, id));
                          if (!service) return null;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium border-blue-200 bg-blue-50 text-blue-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100"
                            >
                              <span className="max-w-[12rem] truncate">
                                {formatVisitSkuChipLabel(service)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSkuFromVisit(id)}
                                className="shrink-0 rounded-full p-0.5 text-blue-600 hover:bg-blue-100 dark:text-cyan-300/80 dark:hover:bg-cyan-500/20 dark:hover:text-white"
                                aria-label={`Remove ${service.name}`}
                              >
                                <FaTimes className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {formErrors.service_ids && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.service_ids}</p>
                    )}
                    {skuBlockWarning && (
                      <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                        <p>
                          Planned work ({skuBlockWarning.planned} min) exceeds the calendar block (
                          {skuBlockWarning.block} min). The slot will not grow automatically.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="mt-2"
                          onClick={handleExtendCalendarBlock}
                        >
                          Extend calendar block to {skuBlockWarning.planned} min
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Date Picker */}
                <div className="mb-4">
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Date</label>
                  <input
                    type="date"
                    name="appointment_date"
                    value={formData.scheduled_start ? formData.scheduled_start.split('T')[0] : ''}
                    min={new Date().toISOString().split('T')[0]}
                    onFocus={() => console.log('[Date Input] formData.scheduled_start onFocus:', formData.scheduled_start)}
                    onChange={(e) => {
                      const newDate = e.target.value; // Just the date YYYY-MM-DD
                      // Preserve the time part from the existing scheduled_start
                      const currentTime = formData.scheduled_start 
                        ? formData.scheduled_start.split('T')[1] 
                        : '09:00'; // Default to 9 AM if no time
                      
                      const newStartDateTime = `${newDate}T${currentTime}`;
                      console.log(`Date picker changed - New start: ${newStartDateTime}`);
                      
                      // Update both start and end with the new date, preserving times
                      const currentEndTime = formData.scheduled_end 
                        ? formData.scheduled_end.split('T')[1]
                        : '10:00'; // Default to 10 AM if no end time
                        
                      setFormData({
                        ...formData,
                        scheduled_start: newStartDateTime,
                        scheduled_end: `${newDate}T${currentEndTime}`,
                        time_window: null // Reset time window when manually selecting date
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    required
                  />
                  {formErrors.scheduled_start && <p className="text-red-500 text-sm mt-1">{formErrors.scheduled_start}</p>}
                </div>
                
                {/* Time Window Selector */}
                {formData.scheduled_start && (
                  <>
                    {/* Add debugging info to help track timezone issues */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="text-xs text-gray-500 mb-2">
                        Date string: {formData.scheduled_start} <br/>
                        Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                      </div>
                    )}
                    <TimeWindowSelector
                      selectedDate={formData.scheduled_start ? formData.scheduled_start : null}
                      onSelectTimeWindow={handleTimeWindowSelect}
                      existingAppointments={schedulingConflictAppointments}
                      technicianId={formData.assigned_technician_id}
                      initialValue={formData.time_window}
                      address={resolvedWorkOrderAddress}
                      excludeAppointmentId={currentAppointment?.id ?? null}
                      minSlotMinutes={estimatedServiceDurationMinutes}
                    />
                    {!resolvedWorkOrderAddress && (
                      <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 space-y-1">
                        <p>No service address on this work order. Edit the work order to pick a property or enter a service location.</p>
                        {editWorkOrderHref && (
                          <a href={editWorkOrderHref} className="inline-block text-cyan-600 dark:text-cyan-400 underline font-medium">
                            Edit work order
                          </a>
                        )}
                      </div>
                    )}
                    {!formData.assigned_technician_id && (
                      <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                        Select a technician before choosing a time window.
                      </p>
                    )}
                  </>
                )}
                
                {/* Hide the exact time fields if using time window */}
                {!formData.time_window && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                      <input
                        type="time"
                        name="scheduled_start_time"
                        value={formData.scheduled_start ? formData.scheduled_start.split('T')[1] : ''}
                        onFocus={() => console.log('[Start Time Input] formData.scheduled_start onFocus:', formData.scheduled_start)}
                        onChange={(e) => {
                          const date = formData.scheduled_start ? formData.scheduled_start.split('T')[0] : '';
                          const newStartDateTime = `${date}T${e.target.value}`;
                          const conflictReason = checkProposedScheduleConflict(
                            newStartDateTime,
                            formData.scheduled_end
                          );
                          setFormData({
                            ...formData,
                            scheduled_start: newStartDateTime,
                          });
                          setFormErrors((prev) => {
                            const next = { ...prev };
                            if (conflictReason) next.scheduled_start = conflictReason;
                            else delete next.scheduled_start;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 mb-2">End Time</label>
                      <input
                        type="time"
                        name="scheduled_end_time"
                        value={formData.scheduled_end ? formData.scheduled_end.split('T')[1] : ''}
                        onFocus={() => console.log('[End Time Input] formData.scheduled_end onFocus:', formData.scheduled_end)}
                        onChange={(e) => {
                          const date = formData.scheduled_end ? formData.scheduled_end.split('T')[0] : formData.scheduled_start ? formData.scheduled_start.split('T')[0] : '';
                          const newEndDateTime = `${date}T${e.target.value}`;
                          const conflictReason = checkProposedScheduleConflict(
                            formData.scheduled_start,
                            newEndDateTime
                          );
                          setFormData({
                            ...formData,
                            scheduled_end: newEndDateTime,
                          });
                          setFormErrors((prev) => {
                            const next = { ...prev };
                            if (conflictReason) next.scheduled_start = conflictReason;
                            else delete next.scheduled_start;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Notes - always visible */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="Add notes about this appointment..."
                  />
                </div>
                
                {/* Display calculated times and travel info if a time window is selected */}
                {formData.time_window && formData.scheduled_start && (
                  <div className="mt-4 p-3 bg-gray-700 rounded-md">
                    <h4 className="text-md font-semibold text-gray-100 mb-2">Calculated Slot:</h4>
                    <p className="text-sm text-gray-200">
                      <FaCalendarAlt className="inline mr-2 mb-1" />
                      Date: {format(parseISO(formData.scheduled_start), 'MM/dd/yyyy')}
                    </p>
                    <p className="text-sm text-gray-200">
                      <FaClock className="inline mr-2 mb-1" />
                      Scheduled: {formatTime(formData.scheduled_start)} - {formatTime(formData.scheduled_end)}
                    </p>
                    {formData.travel_time_before !== null && formData.travel_time_before !== '' && (
                      <p className="text-sm text-gray-200">
                        <FaCar className="inline mr-2 mb-1" /> {/* Assuming FaCar is imported or available */}
                        Travel to Appointment: {formatTravelTime(formData.travel_time_before)} ({formatTravelDistance(formData.travel_distance_before)})
                      </p>
                    )}
                    {displayEtaWindow && (
                      <p className="text-sm text-gray-200 mt-1">
                        <FaUserClock className="inline mr-2 mb-1" />
                        Client ETA: {displayEtaWindow}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Assigned Technician */}
                <div>
                  <label htmlFor="assigned_technician_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Assigned Technician
                  </label>
                  <select
                    id="assigned_technician_id"
                    name="assigned_technician_id"
                    value={formData.assigned_technician_id}
                    onChange={handleInputChange}
                    disabled={!isManager}
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${!isManager ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select a technician</option>
                    {technicians.map(tech => {
                      // Determine the technician's name based on data structure
                      let techName = 'Unknown';
                      
                      if (tech.user?.first_name && tech.user?.last_name) {
                        techName = `${tech.user.first_name} ${tech.user.last_name}`;
                      } else if (tech.first_name || tech.last_name) {
                        techName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim();
                      } else if (tech.name) {
                        techName = tech.name;
                      } else if (tech.employee_id) {
                        techName = `Technician (${tech.employee_id})`;
                      }
                      
                      return (
                        <option key={tech.id} value={tech.id}>
                          {techName}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {/* Actual Start/End (only for edit and if status is 'in_progress' or 'completed') */}
                {currentAppointment && (formData.status === 'reschedule' || isVisitCompleteStatus(formData.status)) && (
                  <>
                    <TextInput
                      id="actual_start"
                      name="actual_start"
                      label="Actual Start Time"
                      type="datetime-local"
                      value={formData.actual_start}
                      onChange={handleInputChange}
                      error={formErrors.actual_start}
                    />
                    
                    {isVisitCompleteStatus(formData.status) && (
                      <TextInput
                        id="actual_end"
                        name="actual_end"
                        label="Actual End Time"
                        type="datetime-local"
                        value={formData.actual_end}
                        onChange={handleInputChange}
                        error={formErrors.actual_end}
                      />
                    )}
                  </>
                )}

                {renderForceScheduleControls()}
                
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="mx-2 px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800"
                  >
                    {isSubmitting ? 'Saving...' : currentAppointment ? 'Update Appointment' : 'Create Appointment'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* Appointments data */}
          {isLoading && appointments.length === 0 ? (
            <LoadingSpinner />
          ) : appointments.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">No appointments scheduled yet.</p>
              {canCreateAppts && (
                <div className="mt-4 flex justify-center">{renderAddAppointmentButton('md')}</div>
              )}
            </div>
          ) : viewMode === 'list' ? (
            isMobile ? (
              renderMobileAppointmentCards()
            ) : (
            <div className="overflow-x-auto">
              <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Found {appointments.length} appointments. Work Order ID: {workOrderId}
              </div>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Technician</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedAppointments.map((appointment, visitIndex) => {
                    const statusEditable = canStatusAppt(appointment);
                    const appointmentEditable = canEditAppt(appointment);
                    return (
                    <tr key={appointment.id} className="dark:hover:bg-gray-750">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaCalendarAlt className="text-gray-500 dark:text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{getVisitLabel(appointment, visitIndex)}</span>
                          {appointment.is_forced_schedule && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                              Forced
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDateTime(appointment.scheduled_start)} - {formatTime(appointment.scheduled_end)}
                        </div>
                        <VisitSkuAccordion
                          appointment={appointment}
                          catalogServices={allServices}
                          workOrderServices={workOrder?.services || []}
                          expanded={Boolean(expandedVisitIds[appointment.id])}
                          onToggle={() => toggleVisitSkuPanel(appointment.id)}
                          onMoveSku={handleMoveSkuToNewVisit}
                          canEdit={appointmentEditable}
                          theme="light"
                        />
                        {appointment.notes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{appointment.notes}</div>
                        )}
                        {/* Add travel time info in compact mode */}
                        {(appointment.travel_time_before || appointment.travel_distance_before) && (
                          <TravelTimeInfo
                            travelTimeBefore={appointment.travel_time_before}
                            travelTimeAfter={appointment.travel_time_after}
                            travelDistanceBefore={appointment.travel_distance_before}
                            travelDistanceAfter={appointment.travel_distance_after}
                            compact={true}
                          />
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={appointment.status}
                          onChange={(e) => handleStatusSelect(appointment.id, appointment.status, e.target.value)}
                          disabled={!statusEditable || updatingStatus === appointment.id}
                          title={!statusEditable ? 'You cannot change status on this appointment' : undefined}
                          className={`px-2 py-1 rounded text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${getStatusColor(appointment.status)} ${
                            !statusEditable || updatingStatus === appointment.id
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer'
                          }`}
                        >
                          {statusOptionsForAppointment(appointment, statusEditable).map((opt) => (
                            <option key={opt.value} value={opt.value} disabled={Boolean(opt.disabled)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center">
                          <FaUserClock className="text-gray-500 dark:text-gray-400 mr-2" />
                          {getTechnicianName(appointment.assigned_technician_id)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {appointmentEditable && (
                          <button
                            onClick={() => editAppointment(appointment)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                            title="Edit appointment"
                          >
                            <FaEdit />
                          </button>
                        )}
                        {canDeleteAppts && (
                          <button
                            onClick={() => handleDelete(appointment.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Delete appointment"
                          >
                            <FaTrash />
                          </button>
                        )}
                        {!appointmentEditable && !canDeleteAppts && (
                          <span className="text-xs text-gray-400">View only</span>
                        )}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            )
          ) : (
            <div className="calendar-view">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center py-2 bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded mb-4 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Calendar view functionality coming soon. Please use list view for now.
                </p>
              </div>
              
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-3">Upcoming Appointments</h3>
                <div className="space-y-3">
                  {sortedAppointments
                    .filter(appt => new Date(appt.scheduled_start) > new Date() && appt.status !== 'canceled')
                    .slice(0, 3)
                    .map((appointment) => {
                      const visitIndex = sortedAppointments.findIndex((a) => a.id === appointment.id);
                      return (
                      <div 
                        key={appointment.id} 
                        className={`p-3 rounded-lg border-l-4 ${
                          appointment.status === 'scheduled' ? 'border-blue-500' :
                          appointment.status === 'reschedule' ? 'border-purple-500' : 'border-gray-500'
                        } bg-white dark:bg-gray-750 shadow-sm`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {getVisitLabel(appointment, visitIndex)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {formatDateTime(appointment.scheduled_start)} - {formatTime(appointment.scheduled_end)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Technician: {getTechnicianName(appointment.assigned_technician_id)}
                            </div>
                          </div>
                          <div className="flex">
                            {canEditAppt(appointment) && (
                              <button
                                onClick={() => editAppointment(appointment)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1"
                              >
                                <FaEdit />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  {sortedAppointments.filter(appt => new Date(appt.scheduled_start) > new Date() && appt.status !== 'canceled').length === 0 && (
                    <div className="text-center py-3">
                      <p className="text-gray-500 dark:text-gray-400">No upcoming appointments.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appointment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentAppointment ? `Edit Appointment (${currentVisitLabel})` : "Create New Appointment"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status */}
          <SelectInput
            id="status"
            name="status"
            label="Status"
            value={formData.status}
            onChange={handleInputChange}
            error={formErrors.status}
            required
          >
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
            <option value="reschedule">Needs Reschedule</option>
            <option value="on_hold">On Hold</option>
          </SelectInput>
          
          {/* Scheduled Start */}
          <TextInput
            id="scheduled_start"
            name="scheduled_start"
            label="Scheduled Start"
            type="datetime-local"
            value={formData.scheduled_start}
            onChange={handleInputChange}
            error={formErrors.scheduled_start}
            required
          />
          
          {/* Scheduled End */}
          <TextInput
            id="scheduled_end"
            name="scheduled_end"
            label="Scheduled End"
            type="datetime-local"
            value={formData.scheduled_end}
            onChange={handleInputChange}
            error={formErrors.scheduled_end}
            required
          />
          
          {/* Assigned Technician */}
          <SelectInput
            id="assigned_technician_id"
            name="assigned_technician_id"
            label="Assigned Technician"
            value={formData.assigned_technician_id}
            onChange={handleInputChange}
            error={formErrors.assigned_technician_id}
            disabled={!isManager}
          >
            <option value="">Select a technician</option>
            {technicians.map(tech => {
              // Determine the technician's name based on data structure
              let techName = 'Unknown';
              
              if (tech.user && tech.user.first_name && tech.user.last_name) {
                techName = `${tech.user.first_name} ${tech.user.last_name}`;
              } else if (tech.first_name && tech.last_name) {
                techName = `${tech.first_name} ${tech.last_name}`;
              } else if (tech.name) {
                techName = tech.name;
              } else {
                techName = `Technician #${tech.id}`;
              }
              
              return (
                <option key={tech.id} value={tech.id}>
                  {techName}
                </option>
              );
            })}
          </SelectInput>
          
          {/* Actual Start/End (only for edit and if status is 'in_progress' or 'completed') */}
          {currentAppointment && (formData.status === 'reschedule' || isVisitCompleteStatus(formData.status)) && (
            <>
              <TextInput
                id="actual_start"
                name="actual_start"
                label="Actual Start Time"
                type="datetime-local"
                value={formData.actual_start}
                onChange={handleInputChange}
                error={formErrors.actual_start}
              />
              
              {isVisitCompleteStatus(formData.status) && (
                <TextInput
                  id="actual_end"
                  name="actual_end"
                  label="Actual End Time"
                  type="datetime-local"
                  value={formData.actual_end}
                  onChange={handleInputChange}
                  error={formErrors.actual_end}
                />
              )}
            </>
          )}
          
          {/* Notes */}
          <TextareaInput
            id="notes"
            name="notes"
            label="Notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            placeholder="Add any relevant notes for the appointment or technician..."
          />

          {renderForceScheduleControls()}
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
            <Button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              variant="secondary"
              Icon={FaTimes}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              Icon={FaSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : currentAppointment ? 'Update Appointment' : 'Create Appointment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Travel Time Info */}
      {showForm && currentAppointment && (
        <TravelTimeInfo
          travelTimeBefore={currentAppointment.travel_time_before}
          travelTimeAfter={currentAppointment.travel_time_after}
          travelDistanceBefore={currentAppointment.travel_distance_before}
          travelDistanceAfter={currentAppointment.travel_distance_after}
        />
      )}

      <Modal
        isOpen={Boolean(windowOverflowPrompt)}
        onClose={handleWindowOverflowCancel}
        title="Appointment extends past customer window"
        size="sm"
        actions={
          <>
            <Button variant="secondary" onClick={handleWindowOverflowCancel}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleWindowOverflowNextDay}>
              Next available date
            </Button>
            <Button variant="primary" onClick={handleWindowOverflowAccept}>
              Schedule anyway
            </Button>
          </>
        }
      >
        {windowOverflowPrompt?.slot && (
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>
              This job is scheduled to run past the{' '}
              <strong>{windowOverflowPrompt.windowName}</strong> customer window
              {windowOverflowPrompt.slot.windowEndTime
                ? ` (ends ${format(windowOverflowPrompt.slot.windowEndTime, 'h:mm a')})`
                : ''}
              .
            </p>
            <p>
              Scheduled:{' '}
              <strong>
                {format(windowOverflowPrompt.slot.startTime, 'h:mm a')} –{' '}
                {format(windowOverflowPrompt.slot.endTime, 'h:mm a')}
              </strong>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              The client was told afternoon (not before 12 PM). Continuing may set expectations
              that you will work past their window unless you have confirmed on a phone call.
            </p>
          </div>
        )}
      </Modal>

      <FloatingBanner
        message={error}
        variant="error"
        onDismiss={() => setError(null)}
      />
      <FloatingBanner
        message={successMessage}
        variant="success"
        onDismiss={() => setSuccessMessage(null)}
        autoDismissMs={5000}
      />
    </div>
  );
} 