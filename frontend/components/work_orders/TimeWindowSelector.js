import React, { useState, useEffect } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';
import { TIME_WINDOWS, isTimeWindowAvailable } from '../../utils/appointment-scheduling';

/**
 * Creates a normalized date object for display to avoid timezone issues
 */
function formatDateForDisplay(date) {
  if (!date) return 'No date selected';
  
  let normalizedDate;
  
  if (typeof date === 'string') {
    // Parse date string in format YYYY-MM-DDThh:mm
    const [datePart] = date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    normalizedDate = new Date(year, month-1, day, 12, 0, 0, 0); // noon to avoid timezone issues
  } else {
    // Clone the date and set to noon
    normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }
  
  return normalizedDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

export default function TimeWindowSelector({
  selectedDate,
  onSelectTimeWindow,
  existingAppointments = [],
  technicianId,
  initialValue = null,
  address = null
}) {
  const [selectedTimeWindow, setSelectedTimeWindow] = useState(initialValue);
  const [availabilities, setAvailabilities] = useState({});
  
  // Check availability when selectedDate, appointments, or technician changes
  useEffect(() => {
    if (!selectedDate) return;
    
    // Make sure we're working with a clean date to avoid timezone issues
    let workingDate;
    if (typeof selectedDate === 'string') {
      // Parse date string in format YYYY-MM-DDThh:mm
      const [datePart] = selectedDate.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      workingDate = new Date(year, month-1, day, 12, 0, 0, 0); // noon to avoid timezone issues
    } else {
      // Clone the date and set to noon
      workingDate = new Date(selectedDate);
      workingDate.setHours(12, 0, 0, 0);
    }
    
    console.log(`Checking availabilities for date: ${workingDate.toDateString()} with technician: ${technicianId || 'none'}`);
    
    // Calculate availability for each time window
    const newAvailabilities = {};
    
    // Check morning availability
    newAvailabilities[TIME_WINDOWS.MORNING.name] = isTimeWindowAvailable(
      workingDate,
      TIME_WINDOWS.MORNING.name,
      existingAppointments,
      technicianId
    );
    
    // Check afternoon availability
    newAvailabilities[TIME_WINDOWS.AFTERNOON.name] = isTimeWindowAvailable(
      workingDate,
      TIME_WINDOWS.AFTERNOON.name,
      existingAppointments,
      technicianId
    );
    
    setAvailabilities(newAvailabilities);
    
    // If the previously selected window is now unavailable, reset selection
    if (selectedTimeWindow && newAvailabilities[selectedTimeWindow]?.available === false) {
      setSelectedTimeWindow(null);
      if (onSelectTimeWindow) {
        onSelectTimeWindow(null);
      }
    }
  }, [selectedDate, existingAppointments, technicianId, selectedTimeWindow, onSelectTimeWindow]);
  
  // Handle window selection
  const handleTimeWindowSelect = (windowName) => {
    // Only allow selection of available time windows
    const availabilityInfo = availabilities[windowName]; // Get the full availability info
    
    if (availabilityInfo?.available) {
      const newValue = selectedTimeWindow === windowName ? null : windowName;
      setSelectedTimeWindow(newValue);
      if (onSelectTimeWindow) {
        // Pass the availability object directly as the second argument
        onSelectTimeWindow(newValue, availabilityInfo);
      }
    } else {
      // Optionally handle clicking an unavailable window (e.g., show an alert)
      console.warn(`Attempted to select unavailable window: ${windowName}`);
    }
  };
  
  const renderCapacityIndicator = (windowName) => {
    const availability = availabilities[windowName];
    if (!availability) return null;

    if (availability.available) {
      // Window is available - show simple indicator or nothing
      // Option 1: Show nothing
      return null; 
      // Option 2: Show generic text (uncomment if preferred)
      /*
      return (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          Available
        </p>
      );
      */
    } else {
      // Window is unavailable - show the reason why
      return (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
          {availability.reason || 'Unavailable'}
        </p>
      );
    }
  };
  
  // Define the time windows for the UI
  const timeWindowsUI = [
    {
      id: TIME_WINDOWS.MORNING.name,
      label: 'Morning',
      description: `${TIME_WINDOWS.MORNING.startHour}:${TIME_WINDOWS.MORNING.startMinute === 0 ? '00' : TIME_WINDOWS.MORNING.startMinute} AM - ${TIME_WINDOWS.MORNING.endHour}:${TIME_WINDOWS.MORNING.endMinute === 0 ? '00' : TIME_WINDOWS.MORNING.endMinute} PM`,
      icon: <FaSun />
    },
    {
      id: TIME_WINDOWS.AFTERNOON.name,
      label: 'Afternoon',
      description: `${TIME_WINDOWS.AFTERNOON.startHour > 12 ? TIME_WINDOWS.AFTERNOON.startHour - 12 : TIME_WINDOWS.AFTERNOON.startHour}:${TIME_WINDOWS.AFTERNOON.startMinute === 0 ? '00' : TIME_WINDOWS.AFTERNOON.startMinute} PM - ${TIME_WINDOWS.AFTERNOON.endHour - 12}:${TIME_WINDOWS.AFTERNOON.endMinute === 0 ? '00' : TIME_WINDOWS.AFTERNOON.endMinute} PM`,
      icon: <FaMoon />
    }
  ];
  
  return (
    // Replace Box with div and apply Tailwind classes
    <div className="mt-2">
      {/* Replace Typography with h6/p and apply Tailwind classes */}
      <h6 className="text-lg font-semibold mb-1 dark:text-white">
        {selectedDate ? formatDateForDisplay(selectedDate) : 'Select a date'}
      </h6>
      
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        Select a time window:
      </p>
      
      {/* Replace Grid container with div and apply Tailwind grid classes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {timeWindowsUI.map((window) => {
          const isAvailable = availabilities[window.id]?.available === true;
          const isSelected = selectedTimeWindow === window.id;
          
          // Combine classes conditionally (could use clsx library for more complex cases)
          const buttonClasses = `
            border rounded-lg p-3 w-full flex items-start transition-colors duration-150 
            ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
            ${isSelected
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-700' 
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}
            ${isAvailable && !isSelected 
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700' 
              : ''}
          `;

          const iconContainerClasses = `
            mr-3 p-2 rounded-full 
            ${isSelected 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}
          `;
          
          return (
            // Replace Grid item with div
            <div key={window.id}>
              {/* Replace Paper/Tooltip with div, apply classes and title */}
              <div
                className={buttonClasses}
                title={!isAvailable ? (availabilities[window.id]?.reason || 'Unavailable') : ''}
                onClick={() => isAvailable && handleTimeWindowSelect(window.id)}
              >
                {/* Icon container */}
                <div className={iconContainerClasses}>
                  {window.icon}
                </div>
                {/* Text content */}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{window.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{window.description}</p>
                  {renderCapacityIndicator(window.id)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Replace Box with div and apply Tailwind classes */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {/* Replace Typography with p and apply Tailwind classes */}
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Your appointment will be scheduled within the selected time window. The exact time will be determined based on technician availability and travel time.
        </p>
      </div>
    </div>
  );
} 