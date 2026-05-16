import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaUserClock, FaSave, FaTimes, FaCheckCircle, FaExclamationCircle, FaClock, FaCar } from 'react-icons/fa';
import { format, addMinutes, subMinutes, parseISO, differenceInMinutes } from 'date-fns';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorAlert from '../ui/ErrorAlert';
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
import AutoScheduler from './AutoScheduler';
import TravelTimeInfo from './TravelTimeInfo';
import TimeWindowSelector from './TimeWindowSelector';
import { findNextAvailableSlot, getTimeWindowBoundaries } from '../../utils/appointment-scheduling';
import WindowScheduler from './WindowScheduler';
import { DEFAULT_SHOP_ADDRESS } from '../../utils/google-maps-service';
import Select from 'react-select';

export default function AppointmentScheduler({ workOrderId, workOrderAddress, onAppointmentChange, variant = 'desktop' }) {
  const isMobile = variant === 'mobile';
  console.log("AppointmentScheduler received workOrderId:", workOrderId);
  
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const [technicians, setTechnicians] = useState([]);
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
    time_window: null
  };
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [viewMode, setViewMode] = useState('list'); // 'list', 'calendar', 'auto', or 'window'
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [displayEtaWindow, setDisplayEtaWindow] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null); // Track which appointment is being updated

  // Fetch appointments when component mounts
  useEffect(() => {
    if (workOrderId) {
      console.log(`Initializing AppointmentScheduler for workOrderId: ${workOrderId}`);
      fetchAppointments();
      fetchTechnicians();
    }
  }, [workOrderId]);

  useEffect(() => {
    if (allServices.length > 0) {
      const categories = [...new Set(allServices.map(service => service.service_type).filter(type => type))]; // Changed service.type to service.service_type
      setServiceCategories(categories.sort());
    } else {
      setServiceCategories([]);
    }
  }, [allServices]);

  useEffect(() => {
    console.log('[useEffect for ServicesList] Triggered. Deps:', {
      selectedServiceCategory,
      allServicesLength: allServices.length,
      // currentAppointment: currentAppointment ? 'Set' : 'Null' // Removed currentAppointment
    });
    if (selectedServiceCategory && allServices.length > 0) {
      const filteredServices = allServices.filter(service => service.service_type === selectedServiceCategory);
      setServicesForSelectedCategory(filteredServices);
      console.log('[useEffect for ServicesList] setServicesForSelectedCategory with:', filteredServices);
    } else {
      setServicesForSelectedCategory([]);
      console.log('[useEffect for ServicesList] setServicesForSelectedCategory to EMPTY.');
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
        const serviceDetails = allServices.find(s => s.id === firstServiceId);
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

  // Re-fetch appointments when returning to the tab
  useEffect(() => {
    // Check if we already have the component mounted and workOrderId
    if (workOrderId && !isLoading) {
      console.log("Component is already mounted, refreshing appointments data");
      fetchAppointments();
    }
  }, []); // Empty dependency array means this runs once when component mounts

  // Effect to recalculate time when dependencies change (date, window, technician)
  useEffect(() => {
    const recalculate = async () => {
      // Skip recalculation when editing — preserve the existing appointment time
      if (currentAppointment) return;
      if (formData.time_window && formData.scheduled_start && formData.assigned_technician_id && workOrderAddress) {
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
  }, [formData.time_window, formData.assigned_technician_id, workOrderAddress, technicianDailySchedule]); // Removed formData.scheduled_start from here

  // Effect to update ETA window when scheduled_start or travel_time_before changes
  useEffect(() => {
    if (formData.scheduled_start && formData.time_window) {
      try {
        const scheduledStartTime = parseISO(formData.scheduled_start);
        const rawEtaStart = subMinutes(scheduledStartTime, 90);
        const rawEtaEnd = addMinutes(scheduledStartTime, 90);

        const roundedEtaStart = roundToNearestQuarterHour(rawEtaStart, 'down');
        const roundedEtaEnd = roundToNearestQuarterHour(rawEtaEnd, 'up');

        setDisplayEtaWindow(`${format(roundedEtaStart, 'h:mm a')} - ${format(roundedEtaEnd, 'h:mm a')}`);
        console.log(`[AppointmentScheduler ETA Effect] Raw ETA: ${format(rawEtaStart, 'h:mm a')} - ${format(rawEtaEnd, 'h:mm a')}`);
        console.log(`[AppointmentScheduler ETA Effect] Rounded ETA: ${format(roundedEtaStart, 'h:mm a')} - ${format(roundedEtaEnd, 'h:mm a')}`);
      } catch (e) {
        console.error("[AppointmentScheduler ETA Effect] Error formatting ETA window:", e);
        setDisplayEtaWindow("Error calculating ETA");
      }
    } else {
      setDisplayEtaWindow(null); // Clear if no start time or not in window mode
    }
  }, [formData.scheduled_start, formData.time_window]); // Depends on scheduled_start and time_window

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
  const fetchAppointments = async () => {
    setIsLoading(true);
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
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Default technician name to auto-select
  const DEFAULT_TECHNICIAN_NAME = 'Chee Clocksin';

  // Fetch technicians for assignment
  const fetchTechnicians = async () => {
    try {
      console.log("Fetching technicians...");
      const response = await apiClient('api/technicians');
      console.log("Technicians API response:", response);
      
      if (response && response.items && Array.isArray(response.items)) {
        console.log(`Found ${response.items.length} technicians`);
        setTechnicians(response.items);

        // Auto-select default technician if none is selected
        setFormData(prev => {
          if (prev.assigned_technician_id) return prev; // already set, don't override
          const defaultTech = response.items.find(t => {
            const name = t.user
              ? `${t.user.first_name || ''} ${t.user.last_name || ''}`.trim()
              : `${t.first_name || ''} ${t.last_name || ''}`.trim();
            return name === DEFAULT_TECHNICIAN_NAME;
          });
          if (defaultTech) {
            console.log('Auto-selecting default technician:', defaultTech.id);
            return { ...prev, assigned_technician_id: defaultTech.id };
          }
          return prev;
        });
      } else {
        console.error("Invalid technicians data format:", response);
        setTechnicians([]);
      }
    } catch (err) {
      console.error('Error fetching technicians:', err);
      setTechnicians([]);
    }
  };

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
        service_ids: appointment.services ? appointment.services.map(s => s.id) : [],
        time_window: appointment.time_window || null,
      });
      // If appointment has services, try to pre-select category
      if (appointment.services && appointment.services.length > 0 && allServices.length > 0) {
        const firstServiceId = appointment.services[0].id;
        const service = allServices.find(s => s.id === firstServiceId);
        if (service && service.type) {
          setSelectedServiceCategory(service.type);
        } else {
          setSelectedServiceCategory('');
        }
      } else {
        setSelectedServiceCategory('');
      }
    } else {
      setCurrentAppointment(null);
      const now = new Date();
      // Default to next day at 9 AM if current time is past 9 AM today
      const defaultStartHour = 9;
      let defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), defaultStartHour, 0, 0);
      if (now.getHours() >= defaultStartHour) {
          defaultStart.setDate(defaultStart.getDate() + 1);
      }
      const defaultEnd = addMinutes(defaultStart, 60); // Default 1 hour duration

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
      console.log('[handleServiceCategoryChange] Category cleared by user, clearing service_ids.');
      setFormData(prev => ({ ...prev, service_ids: [] }));
    } else {
      // Auto-set appointment_type from service category, but don't clear service_ids here
      const validTypes = ['diagnostic', 'repair', 'follow-up', 'inspection', 'maintenance'];
      const mappedType = validTypes.includes(newCategory.toLowerCase()) ? newCategory.toLowerCase() : formData.appointment_type;
      setFormData(prev => ({ ...prev, appointment_type: mappedType }));
    }
  };

  const handleServiceChange = (selectedOptions) => {
    console.log('[handleServiceChange] selectedOptions:', selectedOptions);
    setFormData(prev => ({
      ...prev,
      service_ids: selectedOptions ? selectedOptions.map(opt => opt.value) : []
    }));
    // Potentially auto-update scheduled_end based on selected services duration
    if (selectedOptions && selectedOptions.length > 0 && formData.scheduled_start) {
        const totalDuration = selectedOptions.reduce((sum, opt) => {
            const service = servicesForSelectedCategory.find(s => s.id === opt.value);
            return sum + (service?.duration_minutes || 0);
        }, 0);
        console.log('[handleServiceChange] totalDuration calculated:', totalDuration, 'from servicesForSelectedCategory:', servicesForSelectedCategory);

        if (totalDuration > 0) {
            try {
                const startDate = parseISO(formData.scheduled_start);
                const endDate = addMinutes(startDate, totalDuration);
                console.log('[handleServiceChange] Calculated endDate:', endDate, 'from startDate:', startDate);
                setFormData(prev => ({
                    ...prev,
                    scheduled_end: formatDateTimeForInput(endDate)
                }));
            } catch (error) {
                console.error("[handleServiceChange] Error calculating end date from service duration:", error);
            }
        }
    } else if ((!selectedOptions || selectedOptions.length === 0) && formData.scheduled_start) {
        console.log('[handleServiceChange] No services selected or no start date. Calculating default end time.');
        // If no services selected, or start time changes, reset end time or set to default 1 hr
        try {
            const startDate = parseISO(formData.scheduled_start);
            const endDate = addMinutes(startDate, 60); // Default to 1 hour if no services
            console.log('[handleServiceChange] Calculated default endDate:', endDate, 'from startDate:', startDate);
             setFormData(prev => ({
                ...prev,
                scheduled_end: formatDateTimeForInput(endDate)
            }));
        } catch (error) {
            console.error("[handleServiceChange] Error calculating default end date:", error);
        }
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const errors = {};
    
    if (!formData.appointment_type) errors.appointment_type = 'Appointment type is required';
    if (!formData.status) errors.status = 'Status is required';
    if (!formData.scheduled_start) errors.scheduled_start = 'Scheduled start time is required';
    if (formData.scheduled_start && formData.scheduled_end) {
      if (new Date(formData.scheduled_end) <= new Date(formData.scheduled_start)) {
        errors.scheduled_end = 'End time must be after start time.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Helper function to round date to nearest quarter hour
  const roundToNearestQuarterHour = (date, direction) => {
    const minutes = date.getMinutes();
    let roundedMinutes;

    if (direction === 'down') {
      roundedMinutes = minutes - (minutes % 15);
    } else if (direction === 'up') {
      const remainder = minutes % 15;
      if (remainder === 0) {
        roundedMinutes = minutes;
      } else {
        roundedMinutes = minutes + (15 - remainder);
      }
    } else {
      // Should not happen, but as a fallback, don't change minutes
      roundedMinutes = minutes; 
    }

    const newDate = new Date(date.getTime());
    newDate.setMinutes(roundedMinutes, 0, 0); // Set minutes, reset seconds and ms
    
    // Handle hour overflow if roundedMinutes >= 60 (for 'up' direction)
    if (roundedMinutes >= 60) {
        newDate.setHours(newDate.getHours() + Math.floor(roundedMinutes / 60));
        newDate.setMinutes(roundedMinutes % 60);
    } else if (roundedMinutes < 0) { // Handle hour underflow for 'down' direction
        newDate.setHours(newDate.getHours() + Math.floor(roundedMinutes / 60)); // e.g. -15/60 floor is -1
        newDate.setMinutes((roundedMinutes % 60 + 60) % 60); // Ensure positive minutes
    }


    return newDate;
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
    });
    setFormErrors({});
    setShowForm(false);
    setCurrentAppointment(null);
    setSelectedServiceCategory(''); // Reset category
  };

  // Add openForm function
  const openForm = () => {
    fetchServices(); // Fetch services
    // Set default start and end time to business hours, defaulting to 9 AM
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Strip time part
    
    // Default start time at 9 AM
    const startTime = new Date(today);
    startTime.setHours(9, 0, 0, 0); // Always set to 9 AM
    
    // Make sure we're not setting a time in the past
    if (startTime < now) {
      startTime.setDate(startTime.getDate() + 1); // Move to tomorrow if 9 AM today is in the past
    }
        
    // Create end time 1 hour after start time (will be auto-adjusted by services later)
    const endTime = addMinutes(startTime, 60);

    // Find default technician from already-loaded list
    const defaultTech = technicians.find(t => {
      const name = t.user
        ? `${t.user.first_name || ''} ${t.user.last_name || ''}`.trim()
        : `${t.first_name || ''} ${t.last_name || ''}`.trim();
      return name === DEFAULT_TECHNICIAN_NAME;
    });
    
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
    console.log('[EditAppointment] Appointment received:', JSON.parse(JSON.stringify(appointment)));
    fetchServices(); // Ensures services are fetched or being fetched
    setCurrentAppointment(appointment);
    const servicesFromAppointment = appointment.service_ids || []; 
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

    // The useEffect depending on [currentAppointment, allServices, formData.service_ids]
    // will handle setting the selectedServiceCategory once all data is ready.

    setFormErrors({});
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
    
    // === Add detailed logging here ===
    console.log(`[AppointmentScheduler] Checking availability for ${windowName}. Received windowInfo:`, JSON.stringify(windowInfo, null, 2));
    console.log(`[AppointmentScheduler] Type of windowInfo: ${typeof windowInfo}`);
    if (windowInfo) {
      console.log(`[AppointmentScheduler] windowInfo.available = ${windowInfo.available}`);
      console.log(`[AppointmentScheduler] Type of windowInfo.available = ${typeof windowInfo.available}`);
    } else {
      console.log(`[AppointmentScheduler] windowInfo is null or undefined.`);
    }
    // === End of added logging ===
    
    if (windowInfo && windowInfo.available) { 
      setFormData(prev => ({ ...prev, time_window: windowName }));
      
      if (formData.scheduled_start && !isLoadingSchedule) { // Also check isLoadingSchedule
        // When editing, exclude the current appointment from the schedule so it doesn't block its own slot
        const scheduleForCalc = currentAppointment
          ? technicianDailySchedule.filter(a => a.id !== currentAppointment.id)
          : technicianDailySchedule;
        await calculateAppointmentTime(scheduleForCalc, windowName); 
      } else if (isLoadingSchedule) {
        setError("Technician schedule is loading, please wait...");
      } else {
        setError("Please select a date first.");
      }
    } else {
      // Log the reason if available, otherwise provide a default message
      const reason = windowInfo ? windowInfo.reason : 'Reason not provided';
      console.error(`[AppointmentScheduler] Time window ${windowName} is considered unavailable. Reason: ${reason}`, windowInfo);
      setError(`Time window ${windowName} is not available. Reason: ${reason || 'Availability check failed'}`);
      
      // Optionally clear the calculated time if the window is unavailable
      setFormData(prev => ({
        ...prev,
        time_window: null, // Clear selection if unavailable
        scheduled_start: null, // Maybe reset date/time if selection invalid?
        scheduled_end: null,
        travel_time_before: null,
        travel_distance_before: null
      }));
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
      const toAddress = workOrderAddress;
      
      // Get the previous appointment location or shop address
      // Pass dailySchedule to getPreviousAppointment
      const previousAppointment = getPreviousAppointment(selectedDate, windowName, formData.assigned_technician_id, dailySchedule);
      
      // Get address to travel from (previous appointment or shop)
      const fromAddress = previousAppointment?.address || DEFAULT_SHOP_ADDRESS || '641 Barclay Drive, Toledo, OH 43609, USA'; // Use imported constant
      
      console.log(`Calculating travel from ${fromAddress} to ${toAddress}`);
      
      // Set the appointment duration based on appointment type
      let duration = 60; // Default duration 60 minutes
      if (formData.appointment_type === 'diagnostic') {
        duration = 60;
      } else if (formData.appointment_type === 'repair') {
        duration = 120;
      } else if (formData.appointment_type === 'follow-up') {
        duration = 30;
      }
      
      console.log(`Appointment type: ${formData.appointment_type}, duration: ${duration} minutes`);
      
      // Find the next available slot in the selected time window using the passed list and windowName
      const slot = await findNextAvailableSlot(
        selectedDate,
        windowName, 
        dailySchedule, // Pass the full daily schedule here
        formData.assigned_technician_id,
        fromAddress,
        toAddress,
        duration
      );
      
      console.log(`[AppointmentScheduler] findNextAvailableSlot result:`, slot);
      
      if (!slot) {
        // Use passed windowName in error message
        setError(`No available slots found in the ${windowName} time window. Please select a different time window or date.`);
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
      
      // Verify the slot is within the correct time window
      if (slot.startTime < startTime || slot.startTime >= endTime) {
        console.error('Error: Calculated slot is outside the selected time window!');
        console.log(`Slot start: ${slot.startTime.toLocaleString()}, Window: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
        setError(`No available slot fits within the ${windowName} time window on this date. All slots are taken — please try a different date or window.`);
        setIsCalculating(false);
        return false;
      }
      
      // Update form data with calculated times
      setFormData(prev => ({
        ...prev,
        scheduled_start: formatDateTimeForInput(slot.startTime),
        scheduled_end: formatDateTimeForInput(slot.endTime),
        travel_time_before: slot.travelTimeBefore ?? slot.travelTime ?? null,
        travel_distance_before: slot.travelDistanceBefore ?? slot.travelDistance ?? null
      }));
      
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
    const previousAddress = previousApt?.location || previousApt?.service_location?.address;
    
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
      const appointmentTypeEl = document.getElementById('appointment_type');
      const currentAppointmentType = appointmentTypeEl ? appointmentTypeEl.value : formData.appointment_type;
      console.log("[AppointmentScheduler] appointment_type from DOM:", currentAppointmentType);
      console.log("[AppointmentScheduler] appointment_type at submit time:", formData.appointment_type);
      console.log("[AppointmentScheduler] Submitting final appointment form data (check scheduled_start/end):", formData);
      
      // Prepare appointment data
      const appointmentData = {
        ...formData,
        appointment_type: currentAppointmentType,
        work_order_id: workOrderId,
        travel_time_before: formData.travel_time_before ? parseInt(formData.travel_time_before) : null,
        travel_time_after: formData.travel_time_after ? parseInt(formData.travel_time_after) : null,
        travel_distance_before: formData.travel_distance_before ? parseInt(formData.travel_distance_before) : null,
        travel_distance_after: formData.travel_distance_after ? parseInt(formData.travel_distance_after) : null,
        service_ids: formData.service_ids || [],
      };
      
      let response;
      
      if (currentAppointment) {
        // Update existing appointment
        response = await updateAppointment(currentAppointment.id, appointmentData);
        console.log("Appointment updated:", response);
        setSuccessMessage("Appointment updated successfully!");
      } else {
        // Create new appointment
        response = await createWorkOrderAppointment(workOrderId, appointmentData);
        console.log("Appointment created:", response);
        setSuccessMessage("Appointment created successfully!");
      }
      
      // Refresh appointments
      await fetchAppointments();
      resetForm();
      setShowForm(false);
      
      // Notify parent component
      if (onAppointmentChange) {
        onAppointmentChange();
      }
    } catch (err) {
      console.error("Error saving appointment:", err);
      setError(`Failed to save appointment: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete appointment
  const handleDelete = async (appointmentId) => {
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
    setUpdatingStatus(appointmentId);
    setError(null);
    
    try {
      await apiClient(`/api/work-orders/appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
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
      case 'canceled': return 'border-l-red-500/80';
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
      case 'canceled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
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

  const renderMobileAppointmentCards = () => (
    <div className="space-y-3">
      {appointments.map((appointment) => {
        const duration = getDurationLabel(appointment.scheduled_start, appointment.scheduled_end);
        return (
          <article
            key={appointment.id}
            className={`rounded-xl border border-white/10 bg-white/[0.03] border-l-[3px] px-3 py-3 ${getAccentBorder(appointment.status)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {getAppointmentTypeLabel(appointment.appointment_type)}
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
                onChange={(e) => handleStatusUpdate(appointment.id, e.target.value)}
                disabled={updatingStatus === appointment.id}
                className={`shrink-0 max-w-[7.5rem] px-2 py-1 rounded text-[10px] font-semibold border-0 cursor-pointer ${getStatusColor(appointment.status)} ${
                  updatingStatus === appointment.id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="scheduled">Scheduled</option>
                <option value="en_route">En Route</option>
                <option value="in_progress">In Progress</option>
                <option value="completed_pending_payment">Pending Pay</option>
                <option value="completed">Completed</option>
                <option value="reschedule">Reschedule</option>
                <option value="refund">Refund</option>
                <option value="phone_payment">Phone Pay</option>
                <option value="unreachable">Unreachable</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5 min-w-0">
              <FaUserClock className="shrink-0 text-gray-500" />
              <span className="truncate">{getTechnicianName(appointment.assigned_technician_id)}</span>
            </p>
            {workOrderAddress && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{workOrderAddress}</p>
            )}
            {appointment.services?.length > 0 && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {appointment.services.map((s) => s.name).join(', ')}
              </p>
            )}
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
            <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => editAppointment(appointment)}
                className="flex-1 h-9 rounded-lg border border-cyan-500/35 text-xs font-semibold uppercase tracking-wide text-cyan-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(appointment.id)}
                className="h-9 px-3 rounded-lg border border-red-500/30 text-xs font-semibold uppercase tracking-wide text-red-300"
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );

  if (isLoading && appointments.length === 0) {
    return <LoadingSpinner />;
  }

  if (error && appointments.length === 0) {
    return <ErrorAlert message={error} onRetry={fetchAppointments} />;
  }

  return (
    <div
      className={
        isMobile
          ? 'min-w-0 overflow-x-hidden'
          : 'bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden'
      }
    >
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
          {isMobile ? 'Schedule' : 'Appointments'}
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
          {isMobile ? (
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-300"
            >
              <FaPlus className="h-3 w-3" />
              Add
            </button>
          ) : (
            <Button 
              onClick={openForm} 
              variant="primary" 
              size="sm" 
              Icon={FaPlus}
            >
              Add Appointment
            </Button>
          )}
        </div>
      </div>
      
      {/* Window Scheduler View */}
      {viewMode === 'window' && (
        <div className="px-6 py-4">
          <WindowScheduler
            workOrderId={workOrderId}
            workOrderAddress={workOrderAddress}
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
            workOrderAddress={workOrderAddress}
            existingAppointments={appointments}
            onScheduleCreated={handleAutoSchedule}
            technicians={technicians}
          />
        </div>
      )}
      
      {/* List View or Calendar View - continue with existing code */}
      {viewMode !== 'auto' && viewMode !== 'window' && (
        <div className={isMobile ? 'min-w-0' : 'px-6 py-5'}>
          {/* Success message */}
          {successMessage && (
            <div className="mb-4 rounded-md bg-green-50 p-4 dark:bg-green-900/30">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaCheckCircle className="h-5 w-5 text-green-400 dark:text-green-300" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">{successMessage}</p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => setSuccessMessage(null)}
                      className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50 dark:bg-transparent dark:text-green-300 dark:hover:bg-green-900/50"
                    >
                      <span className="sr-only">Dismiss</span>
                      <FaTimes className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 dark:bg-red-900/30">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaExclamationCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/50"
                    >
                      <span className="sr-only">Dismiss</span>
                      <FaTimes className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
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
                  {currentAppointment ? `Edit Appointment (${getAppointmentTypeLabel(currentAppointment.appointment_type)})` : 'New Appointment'}
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
                {/* Appointment Type - auto-set from service category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Appointment Type
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 capitalize">
                    {formData.appointment_type || 'Select a service category above'}
                  </div>
                  <input type="hidden" name="appointment_type" value={formData.appointment_type} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div>
                  <label htmlFor="service_category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Service Category *
                  </label>
                  <select
                    id="service_category"
                    name="service_category"
                    value={selectedServiceCategory}
                    onFocus={() => console.log('[ServiceCategory Select] Value onFocus:', selectedServiceCategory)}
                    onChange={handleServiceCategoryChange}
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${
                      formErrors.service_category ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''
                    }`}
                    required
                  >
                    <option value="">Select service category...</option>
                    {serviceCategories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  {formErrors.service_category && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.service_category}</p>}
                  </div>
                
                  <div>
                  <label htmlFor="service_ids" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Services/SKUs {formData.service_ids.length > 0 ? `(${formData.service_ids.length} selected)` : ''}
                  </label>
                  {servicesLoading && !selectedServiceCategory ? (
                    <LoadingSpinner size="small" />
                  ) : !selectedServiceCategory ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">Please select a service category first.</p>
                  ) : servicesForSelectedCategory.length === 0 && selectedServiceCategory ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2 px-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">No services found for this category.</p>
                  ) : (
                    <Select
                      id="service_ids"
                      isMulti
                      options={servicesForSelectedCategory.map(service => ({ 
                        value: service.id, 
                        label: `${service.name}${service.sku_code ? ` (${service.sku_code})` : ''} - 
                        ${service.duration_minutes || 0} min - $${(service.base_price || 0).toFixed(2)}`
                      }))}
                      value={servicesForSelectedCategory
                        .filter(service => formData.service_ids.includes(service.id))
                        .map(s => ({ value: s.id, label: `${s.name} (${s.sku_code || 'N/A'}) - ${s.duration_minutes || 0} min` }))
                      }
                      onFocus={() => console.log('[Services/SKUs Select] formData.service_ids onFocus:', JSON.parse(JSON.stringify(formData.service_ids)))}
                      onChange={handleServiceChange}
                      className="basic-multi-select"
                      classNamePrefix="select"
                      placeholder="Select services..."
                      isDisabled={!selectedServiceCategory || servicesLoading || servicesForSelectedCategory.length === 0}
                      // Basic styling for react-select to somewhat match Tailwind forms
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: 'var(--color-bg-input, #1f2937)', // dark:bg-gray-800
                          borderColor: state.isFocused ? 'var(--color-ring-focus, #3b82f6)' : 'var(--color-border-input, #4b5563)', // dark:border-gray-700
                          boxShadow: state.isFocused ? '0 0 0 1px var(--color-ring-focus, #3b82f6)' : 'none',
                          '&:hover': {
                            borderColor: 'var(--color-border-input-hover, #6b7280)', // dark:border-gray-600
                          },
                          borderRadius: '0.375rem', // rounded-md
                          minHeight: '38px',
                        }),
                        valueContainer: (base) => ({
                          ...base,
                          padding: '2px 8px',
                        }),
                        multiValue: (base) => ({
                          ...base,
                          backgroundColor: 'var(--color-bg-multivalue, #374151)', // dark:bg-gray-700
                        }),
                        multiValueLabel: (base) => ({
                          ...base,
                          color: 'var(--color-text-multivalue, #e5e7eb)', // dark:text-gray-200
                        }),
                        menu: (base) => ({
                            ...base,
                            backgroundColor: 'var(--color-bg-menu, #1f2937)', // dark:bg-gray-800
                            zIndex: 50, // Ensure dropdown is on top
                        }),
                        option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected ? 'var(--color-bg-option-selected, #3b82f6)' : state.isFocused ? 'var(--color-bg-option-focused, #374151)' : 'transparent', // dark:bg-gray-700 for focused
                            color: state.isSelected ? 'white' : 'var(--color-text-default, #d1d5db)', // dark:text-gray-300
                             '&:hover': {
                                backgroundColor: 'var(--color-bg-option-hover, #374151)', // dark:bg-gray-600
                            },
                        }),
                        placeholder: (base) => ({
                            ...base,
                            color: 'var(--color-text-placeholder, #9ca3af)', // dark:text-gray-400
                        }),
                        input: (base) => ({
                            ...base,
                            color: 'var(--color-text-input, #e5e7eb)', // dark:text-gray-200
                        }),
                        indicatorSeparator: () => ({
                            display: 'none',
                        }),
                        // Add more styles as needed
                      }}
                    />
                  )}
                  {formErrors.service_ids && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.service_ids}</p>}
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
                      existingAppointments={appointments}
                      technicianId={formData.assigned_technician_id}
                      initialValue={formData.time_window}
                      address={workOrderAddress}
                    />
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
                          console.log(`Setting new start time: ${newStartDateTime}`);
                          setFormData({
                            ...formData,
                            scheduled_start: newStartDateTime
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
                          console.log(`Setting new end time: ${newEndDateTime}`);
                          setFormData({
                            ...formData,
                            scheduled_end: newEndDateTime
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
                    className="mt-1 block w-full rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
                {currentAppointment && (formData.status === 'reschedule' || formData.status === 'completed') && (
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
                    
                    {formData.status === 'completed' && (
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
                  {appointments.map(appointment => (
                    <tr key={appointment.id} className="dark:hover:bg-gray-750">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaCalendarAlt className="text-gray-500 dark:text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{getAppointmentTypeLabel(appointment.appointment_type)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatDateTime(appointment.scheduled_start)} - {formatTime(appointment.scheduled_end)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {appointment.services?.length > 0 && (
                            <span className="text-cyan-500 dark:text-cyan-400">{appointment.services.map(s => s.name).join(', ')}</span>
                          )}
                          {appointment.notes && <span className="ml-1">• {appointment.notes}</span>}
                        </div>
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
                          onChange={(e) => handleStatusUpdate(appointment.id, e.target.value)}
                          disabled={updatingStatus === appointment.id}
                          className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${getStatusColor(appointment.status)} ${
                            updatingStatus === appointment.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="en_route">En Route</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed_pending_payment">Completed — Pending Payment</option>  
                          <option value="completed">Completed</option>                                                                
                          <option value="reschedule">Reschedule</option>
                          <option value="refund">Refund</option> 
                          <option value="phone_payment">Phone Payment</option>
                          <option value="unreachable">Unreachable</option>                        
                          <option value="canceled">Canceled</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center">
                          <FaUserClock className="text-gray-500 dark:text-gray-400 mr-2" />
                          {getTechnicianName(appointment.assigned_technician_id)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => editAppointment(appointment)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(appointment.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  {appointments
                    .filter(appt => new Date(appt.scheduled_start) > new Date() && appt.status !== 'canceled')
                    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
                    .slice(0, 3)
                    .map(appointment => (
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
                              {getAppointmentTypeLabel(appointment.appointment_type)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {formatDateTime(appointment.scheduled_start)} - {formatTime(appointment.scheduled_end)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Technician: {getTechnicianName(appointment.assigned_technician_id)}
                            </div>
                          </div>
                          <div className="flex">
                            <button
                              onClick={() => editAppointment(appointment)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1"
                            >
                              <FaEdit />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {appointments.filter(appt => new Date(appt.scheduled_start) > new Date() && appt.status !== 'canceled').length === 0 && (
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
        title={currentAppointment ? `Edit Appointment (${getAppointmentTypeLabel(currentAppointment.appointment_type)})` : "Create New Appointment"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Appointment Type */}
          <SelectInput
            id="appointment_type"
            name="appointment_type"
            label="Appointment Type"
            value={formData.appointment_type}
            onChange={handleInputChange}
            error={formErrors.appointment_type}
            required
          >
            <option value="">Select type...</option>
            <option value="diagnostic">Diagnostic</option>
            <option value="repair">Repair</option>
            <option value="maintenance">Maintenance</option>
            <option value="installation">Installation</option>
            <option value="quote">Quote</option>
            <option value="follow-up">Follow-up</option>
            <option value="inspection">Inspection</option>
            {/* Add other types as necessary */}
          </SelectInput>
          
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
          {currentAppointment && (formData.status === 'reschedule' || formData.status === 'completed') && (
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
              
              {formData.status === 'completed' && (
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
    </div>
  );
} 