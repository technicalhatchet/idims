import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';
import { TIME_WINDOWS, isTimeWindowAvailable } from '../../utils/appointment-scheduling';
import { getShopHoursForDate, getAvailableWindowsForDate, isDayOpen } from '../../hooks/useShopHours';

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
  address = null,
  excludeAppointmentId = null,
  minSlotMinutes = undefined,
  allowUnavailableSelection = false,
  shopHours = null, // NEW: Shop hours configuration
}) {
  const [selectedTimeWindow, setSelectedTimeWindow] = useState(initialValue);
  const [availabilities, setAvailabilities] = useState({});
  const onSelectRef = useRef(onSelectTimeWindow);

  useEffect(() => {
    onSelectRef.current = onSelectTimeWindow;
  }, [onSelectTimeWindow]);

  useEffect(() => {
    setSelectedTimeWindow(initialValue);
  }, [initialValue]);
  
  // Determine which windows are enabled for this date based on shop hours
  const enabledWindows = useMemo(() => {
    if (!selectedDate) return ['morning', 'afternoon']; // Default if no date
    if (!shopHours) return ['morning', 'afternoon']; // Default if no shop hours configured
    return getAvailableWindowsForDate(shopHours, selectedDate);
  }, [selectedDate, shopHours]);
  
  // Get the day's shop hours for evening time customization
  const dayShopHours = useMemo(() => {
    if (!selectedDate || !shopHours) return null;
    return getShopHoursForDate(shopHours, selectedDate);
  }, [selectedDate, shopHours]);
  
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
    
    const windowOptions = {
      excludeAppointmentId,
      minSlotMinutes,
      shopHours: dayShopHours,
    };

    // Check availability for each enabled window
    if (enabledWindows.includes('morning')) {
      newAvailabilities[TIME_WINDOWS.MORNING.name] = isTimeWindowAvailable(
        workingDate,
        TIME_WINDOWS.MORNING.name,
        existingAppointments,
        technicianId,
        windowOptions
      );
    }

    if (enabledWindows.includes('afternoon')) {
      newAvailabilities[TIME_WINDOWS.AFTERNOON.name] = isTimeWindowAvailable(
        workingDate,
        TIME_WINDOWS.AFTERNOON.name,
        existingAppointments,
        technicianId,
        windowOptions
      );
    }
    
    if (enabledWindows.includes('evening')) {
      newAvailabilities[TIME_WINDOWS.EVENING.name] = isTimeWindowAvailable(
        workingDate,
        TIME_WINDOWS.EVENING.name,
        existingAppointments,
        technicianId,
        windowOptions
      );
    }
    
    setAvailabilities(newAvailabilities);
    
    // If the previously selected window is now unavailable, reset selection
    if (
      !allowUnavailableSelection &&
      selectedTimeWindow &&
      newAvailabilities[selectedTimeWindow]?.available === false
    ) {
      setSelectedTimeWindow(null);
      onSelectRef.current?.(null, null);
    }
  }, [
    selectedDate,
    existingAppointments,
    technicianId,
    selectedTimeWindow,
    excludeAppointmentId,
    minSlotMinutes,
    allowUnavailableSelection,
    enabledWindows,
    dayShopHours,
  ]);
  
  // Handle window selection
  const handleTimeWindowSelect = (windowName) => {
    const availabilityInfo = availabilities[windowName];
    const canSelect =
      allowUnavailableSelection || availabilityInfo?.available === true;

    if (!canSelect) {
      console.warn(`Attempted to select unavailable window: ${windowName}`);
      return;
    }

    const newValue = selectedTimeWindow === windowName ? null : windowName;
    setSelectedTimeWindow(newValue);
    onSelectRef.current?.(newValue, availabilityInfo);
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
  
  // Helper to format time for display
  const formatWindowTime = (hour, minute) => {
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const m = minute === 0 ? '00' : minute.toString().padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${period}`;
  };
  
  // Get evening times from shop hours or defaults
  const eveningStart = dayShopHours?.evening?.start || '17:00';
  const eveningEnd = dayShopHours?.evening?.end || '21:00';
  const [eveningStartH, eveningStartM] = eveningStart.split(':').map(Number);
  const [eveningEndH, eveningEndM] = eveningEnd.split(':').map(Number);
  
  // Define the time windows for the UI - only include enabled ones
  const allTimeWindows = [
    {
      id: TIME_WINDOWS.MORNING.name,
      label: 'Morning',
      description: `${formatWindowTime(TIME_WINDOWS.MORNING.startHour, TIME_WINDOWS.MORNING.startMinute)} - ${formatWindowTime(TIME_WINDOWS.MORNING.endHour, TIME_WINDOWS.MORNING.endMinute)}`,
      icon: <FaSun className="text-yellow-500" />
    },
    {
      id: TIME_WINDOWS.AFTERNOON.name,
      label: 'Afternoon',
      description: `${formatWindowTime(TIME_WINDOWS.AFTERNOON.startHour, TIME_WINDOWS.AFTERNOON.startMinute)} - ${formatWindowTime(TIME_WINDOWS.AFTERNOON.endHour, TIME_WINDOWS.AFTERNOON.endMinute)}`,
      icon: <FaSun className="text-orange-500" />
    },
    {
      id: TIME_WINDOWS.EVENING.name,
      label: 'Evening',
      description: `${formatWindowTime(eveningStartH, eveningStartM)} - ${formatWindowTime(eveningEndH, eveningEndM)}`,
      icon: <FaMoon className="text-indigo-400" />
    }
  ];
  
  // Filter to only show enabled windows
  const timeWindowsUI = allTimeWindows.filter(w => enabledWindows.includes(w.id));
  const isDayClosed = Boolean(shopHours && selectedDate && !isDayOpen(shopHours, selectedDate));
  
  return (
    // Replace Box with div and apply Tailwind classes
    <div className="mt-2">
      {/* Replace Typography with h6/p and apply Tailwind classes */}
      <h6 className="text-lg font-semibold mb-1 dark:text-white">
        {selectedDate ? formatDateForDisplay(selectedDate) : 'Select a date'}
      </h6>
      
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {isDayClosed ? 'No time windows available:' : 'Select a time window:'}
      </p>

      {isDayClosed ? (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-900/20 p-4 mb-3">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Shop closed this day
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
            This day has no service hours. Select another date or update shop hours in Settings.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {timeWindowsUI.map((window) => {
          const availability = availabilities[window.id];
          const isKnownUnavailable = availability?.available === false;
          const isSelectable = allowUnavailableSelection || availability?.available === true;
          const isSelected = selectedTimeWindow === window.id;
          
          const buttonClasses = `
            border rounded-lg p-3 w-full flex items-start transition-colors duration-150 text-left
            ${isSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
            ${isSelected
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-700' 
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}
            ${isSelectable && !isSelected 
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700' 
              : ''}
            ${isKnownUnavailable && allowUnavailableSelection && !isSelected
              ? 'border-amber-300 dark:border-amber-700'
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
              <button
                type="button"
                className={buttonClasses}
                title={!isSelectable ? (availability?.reason || 'Unavailable') : ''}
                disabled={!isSelectable}
                onClick={() => handleTimeWindowSelect(window.id)}
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
              </button>
            </div>
          );
        })}
      </div>
      )}
      
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