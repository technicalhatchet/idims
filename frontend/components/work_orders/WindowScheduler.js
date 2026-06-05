import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaClock, FaUser, FaSave, FaTimes } from 'react-icons/fa';
import Button from '../ui/Button';
import FloatingBanner from '../ui/FloatingBanner';
import TimeWindowSelector from './TimeWindowSelector';
import TravelTimeInfo from './TravelTimeInfo';
import { findNextAvailableSlot } from '../../utils/appointment-scheduling';
import { format } from 'date-fns';
import { getWorkOrderAppointments, createWorkOrderAppointment } from '../../services/api/appointmentsApi';
import { apiClient } from '../../utils/api-client';

/**
 * WindowScheduler component for scheduling appointments using time windows
 */
export default function WindowScheduler({ 
  workOrderId, 
  workOrderAddress,
  onAppointmentCreated 
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [appointmentType, setAppointmentType] = useState('diagnostic');
  const [notes, setNotes] = useState('');
  const [calculatedSlot, setCalculatedSlot] = useState(null);
  const [existingAppointments, setExistingAppointments] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Fetch existing appointments when component mounts
  useEffect(() => {
    if (workOrderId) {
      fetchAppointments();
      fetchTechnicians();
    }
  }, [workOrderId]);
  
  // Fetch appointments from API
  const fetchAppointments = async () => {
    try {
      const response = await getWorkOrderAppointments(workOrderId);
      
      if (response && response.items && Array.isArray(response.items)) {
        setExistingAppointments(response.items);
      } else if (Array.isArray(response)) {
        setExistingAppointments(response);
      } else {
        setExistingAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError('Failed to load existing appointments');
    }
  };
  
  // Fetch technicians for assignment
  const fetchTechnicians = async () => {
    try {
      const response = await apiClient('api/technicians');
      
      if (response && response.items && Array.isArray(response.items)) {
        setTechnicians(response.items);
      } else {
        setTechnicians([]);
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };
  
  // Handle time window selection
  const handleWindowSelect = (window) => {
    setSelectedWindow(window);
    setCalculatedSlot(null);
    if (!window) {
      setError(null);
    }
  };
  
  // Calculate the appointment time based on selected window
  const calculateAppointmentSlot = async () => {
    if (!selectedDate || !selectedWindow) {
      setError('Please select both a date and time window');
      return;
    }
    
    setIsCalculating(true);
    setError(null);
    
    try {
      // Create date object from selected date
      const dateObj = new Date(selectedDate);
      
      // Use shop address if no previous appointments
      const shopAddress = process.env.NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS || '';
      
      // Find available slot in the selected window
      const slot = await findNextAvailableSlot(
        dateObj,
        selectedWindow,
        existingAppointments,
        selectedTechnician,
        shopAddress,
        workOrderAddress,
        60 // Default duration in minutes
      );
      
      if (!slot) {
        setError(`No available slots in the ${selectedWindow} time window`);
        setCalculatedSlot(null);
      } else {
        setCalculatedSlot(slot);
      }
    } catch (error) {
      console.error('Error calculating slot:', error);
      setError(`Failed to calculate available slot: ${error.message}`);
      setCalculatedSlot(null);
    } finally {
      setIsCalculating(false);
    }
  };
  
  // Create the appointment with the calculated slot
  const createAppointment = async () => {
    if (!calculatedSlot) {
      setError('Please calculate an available slot first');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const appointmentData = {
        work_order_id: workOrderId,
        appointment_type: appointmentType,
        status: 'scheduled',
        scheduled_start: calculatedSlot.startTime,
        scheduled_end: calculatedSlot.endTime,
        assigned_technician_id: selectedTechnician || null,
        notes: notes || '',
        time_window: selectedWindow,
        travel_time_before: calculatedSlot.travelTimeBefore,
        travel_time_after: 0, // Can be calculated if needed
        travel_distance_before: calculatedSlot.travelDistanceBefore,
        travel_distance_after: 0 // Can be calculated if needed
      };
      
      const response = await createWorkOrderAppointment(workOrderId, appointmentData);
      
      setSuccessMessage('Appointment created successfully!');
      
      // Reset form
      setSelectedDate('');
      setSelectedWindow(null);
      setCalculatedSlot(null);
      setNotes('');
      
      // Refresh appointments
      await fetchAppointments();
      
      // Notify parent
      if (onAppointmentCreated) {
        onAppointmentCreated(response);
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      setError(`Failed to create appointment: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format date for display
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM d, yyyy h:mm a');
  };
  
  // Format time for display
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid time' : format(date, 'h:mm a');
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
        <FaCalendarAlt className="mr-2" /> Schedule by Time Window
      </h2>
      
      <div className="space-y-6">
        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Appointment Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedWindow(null);
              setCalculatedSlot(null);
            }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
        
        {/* Appointment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Appointment Type
          </label>
          <select
            value={appointmentType}
            onChange={(e) => setAppointmentType(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="diagnostic">Diagnostic</option>
            <option value="repair">Repair</option>
            <option value="follow-up">Follow-up</option>
            <option value="inspection">Inspection</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        
        {/* Technician Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FaUser className="inline mr-1" /> Assign Technician
          </label>
          <select
            value={selectedTechnician}
            onChange={(e) => {
              setSelectedTechnician(e.target.value);
              setCalculatedSlot(null); // Reset calculation when technician changes
            }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="">Select Technician (Optional)</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>
                {tech.user && `${tech.user.first_name || ''} ${tech.user.last_name || ''}`.trim() || tech.id}
              </option>
            ))}
          </select>
        </div>
        
        {/* Time Window Selection */}
        {selectedDate && (
          <TimeWindowSelector
            selectedDate={new Date(selectedDate)}
            onSelectTimeWindow={handleWindowSelect}
            existingAppointments={existingAppointments}
            technicianId={selectedTechnician}
            initialValue={selectedWindow}
          />
        )}
        
        {/* Notes Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            placeholder="Add any additional notes..."
          />
        </div>
        
        {/* Calculate Button */}
        <div className="flex justify-end">
          <Button
            onClick={calculateAppointmentSlot}
            variant="primary"
            disabled={isCalculating || !selectedDate || !selectedWindow}
            Icon={FaClock}
            iconClassName={isCalculating ? "animate-spin" : ""}
          >
            {isCalculating ? 'Calculating...' : 'Calculate Available Time'}
          </Button>
        </div>
        
        {/* Calculated Slot Information */}
        {calculatedSlot && (
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Available Appointment Slot</h3>
            
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(calculatedSlot.startTime), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Time:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatTime(calculatedSlot.startTime)} - {formatTime(calculatedSlot.endTime)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Window:</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {selectedWindow}
                </span>
              </div>
            </div>
            
            <TravelTimeInfo
              travelTimeBefore={calculatedSlot.travelTimeBefore}
              travelTimeAfter={0}  // Not calculated in this example
              travelDistanceBefore={calculatedSlot.travelDistanceBefore}
              travelDistanceAfter={0}  // Not calculated in this example
            />
            
            <div className="flex justify-end mt-4">
              <Button
                onClick={createAppointment}
                variant="success"
                disabled={isSubmitting}
                Icon={FaSave}
              >
                {isSubmitting ? 'Creating...' : 'Confirm & Schedule'}
              </Button>
            </div>
          </div>
        )}
      </div>

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