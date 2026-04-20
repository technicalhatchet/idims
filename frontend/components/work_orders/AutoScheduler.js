import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaClock, FaMapMarkedAlt, FaSpinner } from 'react-icons/fa';
import Button from '../ui/Button';
import { TextInput, SelectInput } from '../ui/FormElements';
import { calculateTravelTime, calculateOptimalSchedule } from '../../utils/google-maps-service';
import ErrorAlert from '../ui/ErrorAlert';
import { format } from 'date-fns';

/**
 * AutoScheduler component for scheduling appointments with travel time calculation
 */
export default function AutoScheduler({ 
  workOrderId, 
  workOrderAddress, 
  existingAppointments = [], 
  onScheduleCreated,
  technicians = []
}) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [proposedSchedule, setProposedSchedule] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [startDate, setStartDate] = useState(formatDateForInput(new Date()));
  const [shopAddress, setShopAddress] = useState(process.env.NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS || '');
  
  // Format date for input fields
  function formatDateForInput(date) {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  }
  
  // Format date for display
  function formatDateTime(dateString) {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  }
  
  // Convert minutes to hours and minutes display
  function formatDuration(minutes) {
    if (!minutes) return 'N/A';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  }
  
  // Convert meters to miles
  function formatDistance(meters) {
    if (!meters) return 'N/A';
    const miles = (meters / 1609.34).toFixed(1);
    return `${miles} mi`;
  }
  
  // Convert seconds to minutes
  function secondsToMinutes(seconds) {
    if (!seconds) return 0;
    return Math.round(seconds / 60);
  }

  // Calculate optimal schedule based on travel times
  async function calculateSchedule() {
    if (!workOrderAddress) {
      setError('Work order address is required for scheduling');
      return;
    }
    
    setIsCalculating(true);
    setError(null);
    
    try {
      // Create appointment object with necessary data
      const appointmentToSchedule = {
        id: workOrderId,
        address: workOrderAddress,
        duration: 60, // Default to 1 hour, could be made configurable
      };
      
      const startDateTime = new Date(startDate);
      
      // Calculate the optimal schedule
      const schedule = await calculateOptimalSchedule(
        shopAddress,
        [appointmentToSchedule],
        startDateTime
      );
      
      if (schedule && schedule.length > 0) {
        setProposedSchedule(schedule[0]);
      } else {
        setError('Could not generate a schedule. Please try different parameters.');
      }
    } catch (err) {
      console.error('Error calculating schedule:', err);
      setError(`Failed to calculate schedule: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  }
  
  // Accept the proposed schedule and create the appointment
  async function acceptSchedule() {
    if (!proposedSchedule) return;
    
    const appointmentData = {
      work_order_id: workOrderId,
      appointment_type: 'diagnostic', // Default, could be made configurable
      status: 'scheduled',
      scheduled_start: proposedSchedule.startTime,
      scheduled_end: proposedSchedule.endTime,
      assigned_technician_id: selectedTechnician || null,
      travel_time_before: proposedSchedule.travelTimeBefore,
      travel_time_after: proposedSchedule.travelTimeAfter,
      travel_distance_before: proposedSchedule.travelDistanceBefore,
      travel_distance_after: proposedSchedule.travelDistanceAfter
    };
    
    // Call the parent component's callback with the new appointment data
    if (onScheduleCreated) {
      onScheduleCreated(appointmentData);
    }
    
    // Reset the form
    setProposedSchedule(null);
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
        <FaMapMarkedAlt className="mr-2" /> Automated Scheduling
      </h3>
      
      {error && <ErrorAlert message={error} className="mb-4" />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <SelectInput
            label="Technician"
            name="technician"
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            options={[
              { value: '', label: 'Select Technician' },
              ...technicians.map(tech => ({ 
                value: tech.id, 
                label: `${tech.user.first_name} ${tech.user.last_name}` 
              }))
            ]}
          />
        </div>
        
        <div>
          <TextInput
            label="Start From"
            name="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        
        <div className="md:col-span-2">
          <TextInput
            label="Shop Address"
            name="shopAddress"
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
            placeholder="Enter shop address for travel calculations"
          />
        </div>
      </div>
      
      <div className="flex justify-end mb-6">
        <Button 
          onClick={calculateSchedule} 
          variant="primary" 
          disabled={isCalculating}
          Icon={isCalculating ? FaSpinner : FaCalendarAlt}
          iconClassName={isCalculating ? "animate-spin" : ""}
        >
          {isCalculating ? 'Calculating...' : 'Calculate Optimal Schedule'}
        </Button>
      </div>
      
      {proposedSchedule && (
        <div className="border dark:border-gray-700 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Proposed Schedule</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Appointment Time</p>
              <p className="text-gray-900 dark:text-white">
                {formatDateTime(proposedSchedule.startTime)} - {format(new Date(proposedSchedule.endTime), 'h:mm a')}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
              <p className="text-gray-900 dark:text-white">
                {formatDuration(secondsToMinutes(
                  (new Date(proposedSchedule.endTime) - new Date(proposedSchedule.startTime)) / 1000
                ))}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Travel Time (To Location)</p>
              <p className="text-gray-900 dark:text-white">
                {formatDuration(secondsToMinutes(proposedSchedule.travelTimeBefore))}
                {' '}
                <span className="text-sm text-gray-500">({formatDistance(proposedSchedule.travelDistanceBefore)})</span>
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Travel Time (From Location)</p>
              <p className="text-gray-900 dark:text-white">
                {formatDuration(secondsToMinutes(proposedSchedule.travelTimeAfter))}
                {' '}
                <span className="text-sm text-gray-500">({formatDistance(proposedSchedule.travelDistanceAfter)})</span>
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button 
              onClick={() => setProposedSchedule(null)} 
              variant="secondary"
              className="mr-2"
            >
              Recalculate
            </Button>
            <Button 
              onClick={acceptSchedule} 
              variant="success"
              Icon={FaCalendarAlt}
            >
              Accept & Schedule
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 