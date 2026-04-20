import { useState, useEffect } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import Head from 'next/head';
import { parseISO, format, addDays } from 'date-fns';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorAlert from '../../components/ui/ErrorAlert';
import StatusBadge from '../../components/ui/StatusBadge';
import TimelineView from '../../components/schedule/TimelineView';
import EventDetailModal from '../../components/schedule/EventDetailModal';
import { useSchedule } from '../../hooks/useSchedule';
import { useTechnicians } from '../../hooks/useTechnicians';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUser, FaClipboardList } from 'react-icons/fa';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';

// Helper function to format Date object to YYYY-MM-DD for input value
function formatDateForInput(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // Return today's date as a fallback or empty string
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    // console.warn("Invalid date passed to formatDateForInput, returning today");
    return `${year}-${month}-${day}`; 
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth is 0-indexed
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SchedulePage() {
  const [viewType, setViewType] = useState('day');
  const [displayMode, setDisplayMode] = useState('list'); // 'list' or 'timeline'
  
  // Initialize dates to the start and end of the current day
  const getInitialDates = () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return { initialStartDate: todayStart, initialEndDate: todayEnd };
  };
  
  const { initialStartDate, initialEndDate } = getInitialDates();
  
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const router = useRouter();
  
  useAuthRedirect();
  
  // Fetch schedule data
  const {
    data: scheduleData,
    isLoading: isLoadingSchedule,
    error: scheduleError,
    refetch: refetchSchedule
  } = useSchedule({
    startDate,
    endDate,
    technicianId: selectedTechnicianId || undefined,
    viewType
  });
  
  // Fetch technicians for filter dropdown
  const {
    data: techniciansData,
    isLoading: isLoadingTechnicians
  } = useTechnicians();
  
  // Handle auth errors by redirecting to token refresh
  useEffect(() => {
    if (scheduleError?.status === 401) {
      console.log("Authentication error detected, refreshing token...");
      // Redirect to token refresh endpoint
      fetch('/api/auth/token?refresh=true', { method: 'POST' })
        .then(response => {
          if (response.ok) {
            console.log("Token refreshed, retrying...");
            setTimeout(() => {
              refetchSchedule();
            }, 1000);
          } else {
            console.error("Failed to refresh token");
          }
        })
        .catch(err => {
          console.error("Error refreshing token:", err);
        });
    }
  }, [scheduleError, refetchSchedule]);
  
  // Centralized function to handle date changes and recalculate period
  const handleDateRangeChange = (changedDate, isStartDateChanged) => {
    let newStart, newEnd;

    if (viewType === 'day') {
      newStart = new Date(changedDate); 
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(newStart);
      newEnd.setHours(23, 59, 59, 999);
    } else if (viewType === 'week') {
      // Recalculate the full week based on the changed date
      const referenceDate = new Date(changedDate);
      const dayOfWeek = referenceDate.getDay(); // 0 = Sunday
      newStart = new Date(referenceDate);
      newStart.setDate(referenceDate.getDate() - dayOfWeek); // Go back to Sunday
      newStart.setHours(0, 0, 0, 0);
      
      newEnd = new Date(newStart);
      newEnd.setDate(newStart.getDate() + 6); // Go forward 6 days to Saturday
      newEnd.setHours(23, 59, 59, 999);
    } else if (viewType === 'month') {
        // Recalculate the full month based on the changed date
        const referenceDate = new Date(changedDate);
        newStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        newEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
        newEnd.setHours(23, 59, 59, 999);
    }

    setStartDate(newStart);
    setEndDate(newEnd);

    // Refetch data with new date range
    setTimeout(() => refetchSchedule(), 100);
  };
  
  const handleTechnicianChange = (e) => {
    setSelectedTechnicianId(e.target.value);
    // Refetch data with new technician filter
    setTimeout(() => refetchSchedule(), 100);
  };
  
  const handleViewTypeChange = (type) => {
    setViewType(type);
    
    // Update date range based on view type
    const today = new Date();
    let newStart, newEnd;
    
    if (type === 'day') {
      newStart = new Date(today);
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(newStart); // Set end based on newStart
      newEnd.setHours(23, 59, 59, 999);
    } else if (type === 'week') {
      // Week view - Sunday to Saturday
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      startOfWeek.setDate(today.getDate() - dayOfWeek); // Go back to Sunday
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Go to Saturday
      endOfWeek.setHours(23, 59, 59, 999);
      
      newStart = startOfWeek;
      newEnd = endOfWeek;
    } else if (type === 'month') {
      // Month view
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      newStart = startOfMonth;
      newEnd = endOfMonth;
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    
    // Refetch data with new view type and date range
    setTimeout(() => refetchSchedule(), 100);
  };
  
  const handleRetry = () => {
    // First try to refresh the auth token
    fetch('/api/auth/token?refresh=true', { method: 'POST' })
      .then(() => {
        // Then refetch the data
        setTimeout(() => {
          refetchSchedule();
        }, 500);
      })
      .catch(err => {
        console.error("Error refreshing token:", err);
        refetchSchedule();
      });
  };
  
  // Add navigation functions
  const navigatePrevious = () => {
    let newStart = new Date(startDate);
    let newEnd = new Date(endDate);

    if (viewType === 'day') {
      // Move back one day
      newStart.setDate(newStart.getDate() - 1);
      // Recalculate end date based on the new start date
      newEnd = new Date(newStart);
      newEnd.setHours(23, 59, 59, 999);
    } else if (viewType === 'week') {
      // Move back one week (Sunday to Saturday)
      newStart.setDate(newStart.getDate() - 7);
      newEnd.setDate(newEnd.getDate() - 7);
    } else if (viewType === 'month') {
      // Move back one month
      newStart.setMonth(newStart.getMonth() - 1);
      newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      newEnd.setHours(23, 59, 59, 999);
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setTimeout(() => refetchSchedule(), 100);
  };
  
  const navigateNext = () => {
    let newStart = new Date(startDate);
    let newEnd = new Date(endDate);

    if (viewType === 'day') {
      // Move forward one day
      newStart.setDate(newStart.getDate() + 1);
      // Recalculate end date based on the new start date
      newEnd = new Date(newStart);
      newEnd.setHours(23, 59, 59, 999);
    } else if (viewType === 'week') {
      // Move forward one week
      newStart.setDate(newStart.getDate() + 7);
      newEnd.setDate(newEnd.getDate() + 7);
    } else if (viewType === 'month') {
      // Move forward one month
      newStart.setMonth(newStart.getMonth() + 1);
      newStart.setDate(1);
      newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      newEnd.setHours(23, 59, 59, 999);
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setTimeout(() => refetchSchedule(), 100);
  };
  
  const navigateToday = () => {
    handleViewTypeChange(viewType);
  };
  
  // Handle event click in list view
  const handleEventClick = (event) => {
    // Ensure work_order_id is set if it's present in any form
    const enhancedEvent = {
      ...event,
      // If this is an appointment, work_order_id is already set
      // If this is a work order, the id is the work_order_id
      work_order_id: event.work_order_id || (event.source === 'work_order' ? event.id : null)
    };
    
    console.log("Event clicked:", enhancedEvent);
    setSelectedEvent(enhancedEvent);
  };

  // Close event detail modal
  const handleCloseEventDetail = () => {
    setSelectedEvent(null);
  };
  
  const renderAppointments = () => {
    if (!scheduleData?.appointments) return <LoadingSpinner />;
    
    // Filter appointments specifically for the selected start date when in day view
    const appointmentsToRender = viewType === 'day'
      ? scheduleData.appointments.filter(apt => {
          if (!apt.start) return false;
          // Use parseISO to handle the ISO string format reliably
          const aptStartDate = parseISO(apt.start); 
          // Compare year, month, and day components
          return aptStartDate.getFullYear() === startDate.getFullYear() &&
                 aptStartDate.getMonth() === startDate.getMonth() &&
                 aptStartDate.getDate() === startDate.getDate();
        })
      : scheduleData.appointments; // Show all fetched for week/month view

    console.log("[renderAppointments] Rendering data after filtering:", appointmentsToRender);

    if (appointmentsToRender.length === 0) return <p>No appointments found for the selected date range.</p>;

    return (
      <div className="space-y-4">
        {appointmentsToRender.map((appointment, index) => {
          const techColor = getTechnicianColor(appointment.technician_id);
          const isWorkOrderSource = appointment.source === 'work_order';
          const isAppointmentSource = appointment.source === 'appointment';
          
          return (
            <div
              key={index}
              className={`p-4 rounded-lg shadow-md border-l-4 ${techColor} bg-white dark:bg-gray-800 cursor-pointer hover:shadow-lg transition-shadow`}
              onClick={() => handleEventClick(appointment)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {appointment.title || (isWorkOrderSource ? 'Work Order' : 'Appointment')}
                    {getSourceBadge(appointment)}
                  </h3>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {format(parseISO(appointment.start), 'h:mm a')} - 
                    {appointment.end ? format(parseISO(appointment.end), ' h:mm a') : ' TBD'}
                  </div>
                </div>
                <StatusBadge status={appointment.status} />
              </div>
              
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <FaMapMarkerAlt className="mr-1 text-gray-400" />
                  <span>{appointment.location || 'No location'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <FaUser className="mr-1 text-gray-400" />
                  <span>{appointment.technician_name || 'Unassigned'}</span>
                </div>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-2">
                {appointment.order_number && (
                  <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    Order #{appointment.order_number}
                  </div>
                )}
                {appointment.priority && (
                  <div className={`text-xs px-2 py-1 rounded ${
                    appointment.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    appointment.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {appointment.priority.charAt(0).toUpperCase() + appointment.priority.slice(1)} Priority
                  </div>
                )}
                {appointment.client_name && (
                  <div className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                    {appointment.client_name}
                  </div>
                )}
              </div>
              
              {/* Additional info for appointments */}
              {isAppointmentSource && appointment.appointment_type && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Type:</span> {appointment.appointment_type.charAt(0).toUpperCase() + appointment.appointment_type.slice(1)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Function to get a badge for appointment source
  const getSourceBadge = (appointment) => {
    if (appointment.source === 'appointment') {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          {appointment.appointment_type ? 
            appointment.appointment_type.charAt(0).toUpperCase() + appointment.appointment_type.slice(1) : 
            'Appointment'
          }
        </span>
      );
    } else if (appointment.source === 'work_order') {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          Work Order
        </span>
      );
    }
    return null;
  };
  
  // Get color for technician
  const getTechnicianColor = (technicianId) => {
    if (!technicianId) return 'border-gray-300';
    
    if (!techColors[technicianId]) {
      techColors[technicianId] = colorClasses[Object.keys(techColors).length % colorClasses.length];
    }
    
    return techColors[technicianId];
  };
  
  // Color classes for technician assignments
  const colorClasses = [
    'border-blue-500',
    'border-green-500',
    'border-yellow-500',
    'border-purple-500',
    'border-red-500',
    'border-pink-500',
    'border-indigo-500',
    'border-orange-500',
    'border-teal-500'
  ];
  
  // Track unique technicians and their colors
  const techColors = {};
  
  if (isLoadingSchedule && isLoadingTechnicians) {
    return (
      <div className="px-4 py-6">
        <LoadingSpinner />
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>Schedule | Service Business Management</title>
      </Head>

      <div className="px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 dark:text-white">Schedule</h1>
            <p className="text-gray-600 dark:text-gray-300">
              View and manage all scheduled appointments
            </p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 md:mb-0">Filters</h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => handleViewTypeChange('day')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                    viewType === 'day' 
                      ? 'bg-blue-600 text-white dark:bg-blue-700' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => handleViewTypeChange('week')}
                  className={`px-4 py-2 text-sm font-medium ${
                    viewType === 'week' 
                      ? 'bg-blue-600 text-white dark:bg-blue-700' 
                      : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => handleViewTypeChange('month')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                    viewType === 'month' 
                      ? 'bg-blue-600 text-white dark:bg-blue-700' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  Month
                </button>
              </div>
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setDisplayMode('list')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                    displayMode === 'list' 
                      ? 'bg-blue-600 text-white dark:bg-blue-700' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('timeline')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                    displayMode === 'timeline' 
                      ? 'bg-blue-600 text-white dark:bg-blue-700' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  Timeline
                </button>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={navigatePrevious}
                  className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Previous"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={navigateToday}
                  className="px-3 py-1 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Today
                </button>
                <button
                  onClick={navigateNext}
                  className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Next"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {viewType === 'day' && format(startDate, 'MMMM d, yyyy')}
              {viewType === 'week' && `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`}
              {viewType === 'month' && format(startDate, 'MMMM yyyy')}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
              <input
                type="date"
                value={formatDateForInput(startDate)}
                // Pass the changed date to the handler
                onChange={(e) => handleDateRangeChange(new Date(e.target.value + 'T00:00:00'), true)}
                className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input
                type="date"
                value={formatDateForInput(endDate)}
                // Pass the changed date to the handler
                onChange={(e) => handleDateRangeChange(new Date(e.target.value + 'T12:00:00'), false)} // Use noon to avoid timezone issues near midnight
                min={formatDateForInput(startDate)} 
                disabled={viewType === 'day'} 
                className={`mt-1 block w-full shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${viewType === 'day' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Technician</label>
              <div className="relative mt-1">
                <style jsx>{`
                  select {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                  }
                  select::-ms-expand {
                    display: none;
                  }
                `}</style>
                <select
                  value={selectedTechnicianId}
                  onChange={handleTechnicianChange}
                  className="form-select w-full rounded-md shadow-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">All Technicians</option>
                  {techniciansData?.items?.map(technician => (
                    <option key={technician.id} value={technician.id} className="dark:bg-gray-700 dark:text-white">
                      {technician.user?.first_name} {technician.user?.last_name}
                    </option>
                  ))}
                </select>
                </div>
            </div>
          </div>
        </div>
        
        {scheduleError && (
          <ErrorAlert
            message={scheduleError.status === 404 
              ? "The schedule API endpoint could not be found. Please check API configuration."
              : scheduleError.status === 401
                ? "Your session may have expired. Please try refreshing the page."
                : scheduleError.status === 422
                  ? `Validation Error: ${scheduleError.message}`
                  : "Failed to load schedule data. Please try again."
            }
            onRetry={handleRetry}
          />
        )}
        
        {/* Debug Section */}
        {scheduleError && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 dark:bg-yellow-900/20 dark:border-yellow-700">
            <h3 className="text-lg font-medium text-yellow-900 mb-2 dark:text-yellow-400">Debug Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-yellow-800 dark:text-yellow-300"><b>Error Status:</b> {scheduleError.status}</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300"><b>Error Message:</b> {scheduleError.message}</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300"><b>Start Date:</b> {startDate.toISOString()}</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300"><b>End Date:</b> {endDate.toISOString()}</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300"><b>View Type:</b> {viewType}</p>
              </div>
              <div>
                <button 
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md mb-2 dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                  Retry Request
                </button>
                <button 
                  onClick={() => {
                    // Set dates to just the date part (no time)
                    const dateOnly = new Date(startDate);
                    dateOnly.setHours(0, 0, 0, 0);
                    setStartDate(dateOnly);
                    
                    const endDateOnly = new Date(endDate);
                    endDateOnly.setHours(0, 0, 0, 0);
                    setEndDate(endDateOnly);
                    
                    setTimeout(refetchSchedule, 500);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md dark:bg-green-700 dark:hover:bg-green-800"
                >
                  Reset Dates & Retry
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Schedule Results */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          {isLoadingSchedule ? (
            <LoadingSpinner />
          ) : scheduleError ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg dark:text-gray-300">Unable to load schedule data</p>
              <p className="mt-2">There was an error loading the schedule. Please try again later.</p>
              <button
                onClick={handleRetry}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                Retry
              </button>
            </div>
          ) : scheduleData?.appointments?.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg dark:text-gray-300">No appointments scheduled</p>
              <p className="mt-2">No appointments are scheduled for the selected filters.</p>
            </div>
          ) : displayMode === 'timeline' ? (
            <TimelineView 
              appointments={scheduleData?.appointments} 
              date={startDate}
              onEventClick={handleEventClick}
              viewType={viewType}
              isLoading={isLoadingSchedule}
            />
          ) : (
            renderAppointments()
          )}
        </div>
      
        {/* Event Detail Modal */}
        {selectedEvent && (
          <EventDetailModal 
            event={selectedEvent} 
            onClose={handleCloseEventDetail} 
          />
        )}
      </div>
    </>
  );
}

// Add server-side props with auth
export async function getServerSideProps(context) {
  // Check authentication
  const session = await getSession(context.req, context.res);
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  // Return empty props as data fetching happens on the client
  return {
    props: {},
  };
}

// Export the component with layout
export default function ScheduleWithLayout(props) {
  return (
    <DashboardLayout>
      <SchedulePage {...props} />
    </DashboardLayout>
  );
} 