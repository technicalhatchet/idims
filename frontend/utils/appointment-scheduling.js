/**
 * Utility functions for appointment scheduling with time windows
 */
import { calculateTravelTime } from './google-maps-service';
import { DEFAULT_SHOP_ADDRESS } from './google-maps-service'; // Import shop address

/**
 * Legacy subset — prefer isSchedulingConflict (all statuses except canceled).
 * Kept for any code that still imports SCHEDULE_CONFLICT_STATUSES.
 */
export const SCHEDULE_CONFLICT_STATUSES = new Set([
  'scheduled',
  'en_route',
  'in_progress',
  'reschedule',
  'completed',
  'completed_pending_payment',
  'phone_payment',
  'failed',
  'unreachable',
  'refund',
]);

export function getAppointmentStatusValue(appointment) {
  if (!appointment) return '';
  const status = appointment.status?.value ?? appointment.status ?? '';
  return String(status).toLowerCase();
}

/** Calendar blocks always occupy the technician schedule. */
export function isCalendarBlockScheduleItem(item) {
  if (!item) return false;
  return (
    item.source === 'calendar_block' ||
    item.appointment_type === 'calendar_block' ||
    item.block_type != null
  );
}

/**
 * Occupies the schedule: any appointment except canceled, plus active calendar blocks.
 * Matches backend scheduling_constraints_service rules.
 */
export function isSchedulingConflict(appointment) {
  if (isCalendarBlockScheduleItem(appointment)) return true;
  const status = getAppointmentStatusValue(appointment);
  if (!status) return Boolean(appointment?.scheduled_start);
  return status !== 'canceled';
}

export function filterSchedulingConflicts(appointments) {
  if (!Array.isArray(appointments)) return [];
  return appointments.filter(isSchedulingConflict);
}

/** Build a geocodable address from work order service_location JSONB */
export function formatServiceLocationAddress(serviceLocation) {
  if (!serviceLocation) return null;
  if (typeof serviceLocation === 'string') {
    const trimmed = serviceLocation.trim();
    return trimmed || null;
  }
  const parts = [];
  if (serviceLocation.address) parts.push(serviceLocation.address);
  if (serviceLocation.city) parts.push(serviceLocation.city);
  if (serviceLocation.state) parts.push(serviceLocation.state);
  if (serviceLocation.zip) parts.push(serviceLocation.zip);
  return parts.length ? parts.join(', ') : null;
}

/** Build address string from a property record */
export function formatPropertyAddress(property) {
  if (!property) return null;
  const parts = [
    property.address,
    property.unit_number ? `Unit ${property.unit_number}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Best-effort address for an appointment record (schedule API, local list, etc.) */
export function resolveAppointmentLocation(appointment) {
  if (!appointment) return null;
  if (typeof appointment.location === 'string' && appointment.location.trim()) {
    return appointment.location.trim();
  }
  if (typeof appointment.service_address === 'string' && appointment.service_address.trim()) {
    return appointment.service_address.trim();
  }
  const fromServiceLocation = formatServiceLocationAddress(appointment.service_location);
  if (fromServiceLocation) return fromServiceLocation;

  const fromAppointmentProperty = formatPropertyAddress(appointment.property);
  if (fromAppointmentProperty) return fromAppointmentProperty;

  const workOrder = appointment.work_order;
  if (workOrder) {
    const fromWorkOrder = formatServiceLocationAddress(workOrder.service_location);
    if (fromWorkOrder) return fromWorkOrder;
    const fromProperty = formatPropertyAddress(workOrder.property);
    if (fromProperty) return fromProperty;
  }

  return null;
}

export function resolveWorkOrderServiceAddress(workOrder = {}) {
  const fromServiceLocation = formatServiceLocationAddress(workOrder.service_location);
  if (fromServiceLocation) return fromServiceLocation;

  const fromProperty = formatPropertyAddress(workOrder.property);
  if (fromProperty) return fromProperty;

  const propertyId = workOrder.property_id;
  if (propertyId && Array.isArray(workOrder.client_properties)) {
    const matched = workOrder.client_properties.find(
      (p) => p.id === propertyId || String(p.id) === String(propertyId)
    );
    const fromClientProperty = formatPropertyAddress(matched);
    if (fromClientProperty) return fromClientProperty;
  }

  return null;
}

// Define time window boundaries
export const TIME_WINDOWS = {
  MORNING: {
    name: 'morning',
    label: 'Morning (9:00 AM - 12:29 PM)',
    startHour: 9,
    startMinute: 0,
    endHour: 12,
    endMinute: 29
  },
  AFTERNOON: {
    name: 'afternoon',
    label: 'Afternoon (12:30 PM - 4:00 PM)',
    startHour: 12,
    startMinute: 30,
    endHour: 16,
    endMinute: 0
  }
};

// Constants for scheduling logic
const TECHNICIAN_WORK_START_HOUR = 8; // 8 AM
const TECHNICIAN_WORK_END_HOUR = 17; // 5 PM
const BUFFER_TIME_MINUTES = 10; // Buffer between appointments
const BUFFER_TIME_MS = BUFFER_TIME_MINUTES * 60 * 1000;

/**
 * Create a date object for a specific time
 * @param {Date} baseDate - Base date to use
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {Date} Date object with specified time
 */
export function createTimeForDate(baseDate, hours, minutes) {
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Get the time window start and end times for a specific date
 * @param {Date|string} date - The date to get time window for
 * @param {string} windowName - 'morning' or 'afternoon'
 * @returns {Object} { startTime, endTime } as Date objects
 */
export function getTimeWindowBoundaries(date, windowName) {
  const window = windowName === 'morning' ? TIME_WINDOWS.MORNING : TIME_WINDOWS.AFTERNOON;
  
  // Make sure we're working with a clean date to avoid timezone issues
  let cleanDate;
  if (typeof date === 'string') {
    // Parse date string in format YYYY-MM-DDThh:mm
    const [datePart] = date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    cleanDate = new Date(year, month-1, day); // Create date at midnight
  } else {
    // Use provided date, ensuring we only use the date part
    cleanDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  
  const year = cleanDate.getFullYear();
  const month = cleanDate.getMonth();
  const day = cleanDate.getDate();
  
  // Create new Date objects for the window boundaries using direct constructor
  // This approach avoids potential timezone issues
  const startTime = new Date(year, month, day, window.startHour, window.startMinute, 0, 0);
  const endTime = new Date(year, month, day, window.endHour, window.endMinute, 0, 0);
  
  console.log(`[getTimeWindowBoundaries] Time window for ${cleanDate.toDateString()} ${windowName}: 
    Start: ${startTime.toLocaleString()}, 
    End: ${endTime.toLocaleString()}`);
  
  return { startTime, endTime };
}

/**
 * Check if a time slot is available based on existing appointments and technician schedule
 * @param {Date|string} date - The date to check
 * @param {string} windowName - 'morning' or 'afternoon'
 * @param {Array} existingAppointments - Array of existing appointments
 * @param {string} technicianId - ID of the technician
 * @returns {Object} { available: boolean, reason: string }
 */
export function isTimeWindowAvailable(date, windowName, existingAppointments, technicianId) {
  const blockingAppointments = filterSchedulingConflicts(existingAppointments);
  console.log(`[isTimeWindowAvailable] Checking availability for date: ${date}, window: ${windowName}, technicianId: ${technicianId || 'none'}`);
  console.log(`[isTimeWindowAvailable] Blocking appointments received:`, blockingAppointments);
  
  // Define limits at the top level of the function
  const MAX_APPOINTMENTS_PER_TECHNICIAN = 6; 
  const MAX_APPOINTMENTS_PER_WINDOW = 18; // Kept the user's change to 18

  if (!date || !windowName) {
    console.warn('[isTimeWindowAvailable] Invalid date or time window');
    return { available: false, reason: 'Invalid date or time window' };
  }

  // Make sure we're working with a normalized date (noon to avoid any timezone issues)
  let normalizedDate;
  if (typeof date === 'string') {
    // Parse date string in format YYYY-MM-DDThh:mm
    const [datePart] = date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    normalizedDate = new Date(year, month-1, day, 12, 0, 0, 0); // noon to avoid timezone issues
  } else {
    normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }
  
  // If checking today's date, gray out windows that have already passed
  const now = new Date();
  const isToday = normalizedDate.getFullYear() === now.getFullYear() &&
                  normalizedDate.getMonth() === now.getMonth() &&
                  normalizedDate.getDate() === now.getDate();

  if (isToday) {
    const { endTime: windowEnd } = getTimeWindowBoundaries(normalizedDate, windowName);
    // Add buffer — need enough time to actually get there
    const bufferMs = 30 * 60 * 1000; // 30 min buffer
    if (now.getTime() + bufferMs >= windowEnd.getTime()) {
      return { available: false, reason: 'This time window has already passed' };
    }
  }
  
  const { startTime, endTime } = getTimeWindowBoundaries(normalizedDate, windowName);
  
  console.log(`[isTimeWindowAvailable] Calculated Boundaries: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
  
  // Get all appointments for this date, regardless of technician
  const appointmentsForDate = blockingAppointments.filter(apt => {
    // Skip appointments without scheduled times
    if (!apt.scheduled_start || !apt.scheduled_end) return false;
    
    const aptStart = new Date(apt.scheduled_start);
    
    // Normalize the appointment date to avoid timezone issues
    const aptDate = new Date(aptStart.getFullYear(), aptStart.getMonth(), aptStart.getDate(), 12, 0, 0);
    
    // Check if appointment date matches by comparing year, month, and day
    return aptDate.getFullYear() === normalizedDate.getFullYear() && 
           aptDate.getMonth() === normalizedDate.getMonth() && 
           aptDate.getDate() === normalizedDate.getDate();
  });
  
  console.log(`[isTimeWindowAvailable] Found ${appointmentsForDate.length} total appointments for this date:`, appointmentsForDate.map(a => ({id: a.id, start: a.scheduled_start, tech: a.assigned_technician_id })));
  
  // Filter appointments for this time window
  const appointmentsInWindow = appointmentsForDate.filter(apt => {
    const aptStart = new Date(apt.scheduled_start);
    const aptEnd = new Date(apt.scheduled_end);
    
    // Check if appointment overlaps with the window
    const overlapsWindow = (
      (aptStart >= startTime && aptStart <= endTime) || 
      (aptEnd >= startTime && aptEnd <= endTime) ||
      (aptStart <= startTime && aptEnd >= endTime)
    );
    
    if (overlapsWindow) {
      console.log(`[isTimeWindowAvailable] Appointment ${apt.id} overlaps window: ${apt.scheduled_start} - ${apt.scheduled_end}, technician: ${apt.assigned_technician_id || 'unassigned'}`);
    }
    
    return overlapsWindow;
  });
  
  console.log(`[isTimeWindowAvailable] Found ${appointmentsInWindow.length} appointments in this time window:`, appointmentsInWindow.map(a => ({id: a.id, start: a.scheduled_start, tech: a.assigned_technician_id })));
  
  // If a specific technician is selected, check if they are already booked in this window
  if (technicianId) {
    const technicianAppointmentsInWindow = appointmentsInWindow.filter(apt => 
      apt.assigned_technician_id === technicianId
    );
    
    console.log(`[isTimeWindowAvailable] Technician ${technicianId} has ${technicianAppointmentsInWindow.length} appointments in this window:`, technicianAppointmentsInWindow.map(a => ({id: a.id, start: a.scheduled_start })));
    
    // Technicians can have multiple appointments per time window if they fit
    if (technicianAppointmentsInWindow.length >= MAX_APPOINTMENTS_PER_TECHNICIAN) {
      const result = { 
        available: false, 
        reason: `Technician already has ${technicianAppointmentsInWindow.length} appointment(s) in this time window (Max ${MAX_APPOINTMENTS_PER_TECHNICIAN})` // Updated reason
      };
      console.log('[isTimeWindowAvailable] Result:', result);
      return result;
    }
  }
  
  // Check total capacity for all appointments in this window
  const currentAppointmentCount = appointmentsInWindow.length;
  
  if (currentAppointmentCount >= MAX_APPOINTMENTS_PER_WINDOW) {
    const result = { 
      available: false, 
      reason: `Maximum window capacity reached (${currentAppointmentCount}/${MAX_APPOINTMENTS_PER_WINDOW} appointments)` // Updated reason
    };
    console.log('[isTimeWindowAvailable] Result:', result);
    return result;
  }

  // Determine the relevant count and max to return based on whether a technician is selected
  let displayCount = currentAppointmentCount;
  let displayMax = MAX_APPOINTMENTS_PER_WINDOW;
  
  if (technicianId) {
    // If checking for a specific tech, use the technician-specific limit
    const technicianAppointmentsInWindow = appointmentsInWindow.filter(apt => apt.assigned_technician_id === technicianId);
    displayCount = technicianAppointmentsInWindow.length;
    displayMax = MAX_APPOINTMENTS_PER_TECHNICIAN; // Use the technician limit here
  }
  
  // Window is available
  const finalResult = { 
    available: true,
    appointmentCount: displayCount, // Return the relevant count
    maxAppointments: displayMax      // Return the relevant max
  };
  console.log('[isTimeWindowAvailable] Result:', finalResult);
  return finalResult;
}

/**
 * Find the next available slot for a technician on a given date,
 * considering their full schedule, travel time, and work hours.
 * @param {Date|string} date - The date to check
 * @param {string} windowName - 'morning' or 'afternoon' (influences initial search start)
 * @param {Array} allExistingAppointments - Array of ALL existing appointments (will be filtered)
 * @param {string} technicianId - ID of the technician (REQUIRED for this logic)
 * @param {string} fromAddress - Address to travel from (often previous appointment or shop)
 * @param {string} toAddress - Address of the NEW appointment location
 * @param {number} duration - Duration of NEW appointment in minutes
 * @returns {Promise<Object>} { startTime, endTime, travelTimeBefore, travelDistanceBefore } or null
 */
export async function findNextAvailableSlot(
  date,
  windowName,
  allExistingAppointments, // Renamed for clarity
  technicianId,
  fromAddress, // Note: This might be overridden based on previous appointment
  toAddress,
  duration = 60
) {
  console.log(`[findNextAvailableSlot V2] Finding slot for date: ${date}, window: ${windowName}, technician: ${technicianId}, duration: ${duration} min`);
  console.log(`[findNextAvailableSlot V2] To Address: ${toAddress}`);
  
  if (!technicianId) {
    console.error("[findNextAvailableSlot V2] Technician ID is required for detailed slot finding.");
    return null;
  }

  if (!toAddress || (typeof toAddress === 'string' && !toAddress.trim())) {
    console.error("[findNextAvailableSlot V2] Destination address (toAddress) is required.");
    return null;
  }

  const normalizedToAddress = typeof toAddress === 'string' ? toAddress.trim() : toAddress;
  allExistingAppointments = filterSchedulingConflicts(allExistingAppointments);

  // --- Date and Time Setup ---
  let normalizedDate;
  if (typeof date === 'string') {
    const [datePart] = date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    normalizedDate = new Date(year, month - 1, day, 12, 0, 0, 0);
  } else {
    normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }
  const dateStr = normalizedDate.toDateString(); // For comparison
  console.log(`[findNextAvailableSlot V2] Normalized Date: ${dateStr}`);

  const { startTime: windowStartTime, endTime: windowEndTime } = getTimeWindowBoundaries(normalizedDate, windowName);
  const workDayStartTime = new Date(normalizedDate); workDayStartTime.setHours(TECHNICIAN_WORK_START_HOUR, 0, 0, 0);
  const workDayEndTime = new Date(normalizedDate); workDayEndTime.setHours(TECHNICIAN_WORK_END_HOUR, 0, 0, 0);
  const durationMs = duration * 60 * 1000;

  // --- Filter and Sort Technician's Appointments for the Day ---
  const technicianAppointments = allExistingAppointments.filter(apt => {
    if (!apt.scheduled_start || !apt.scheduled_end || apt.assigned_technician_id !== technicianId) return false;
    const aptDate = new Date(apt.scheduled_start);
    // Check if appointment is on the normalized date
    return aptDate.toDateString() === dateStr;
  }).map(apt => ({ // Convert to Date objects and include location
    ...apt,
    startTime: new Date(apt.scheduled_start),
    endTime: new Date(apt.scheduled_end),
    location: resolveAppointmentLocation(apt),
  })).sort((a, b) => a.startTime - b.startTime); // Sort by start time

  console.log(`[findNextAvailableSlot V2] Found ${technicianAppointments.length} appointments for technician ${technicianId} on ${dateStr}:`, 
              technicianAppointments.map(a => ({ id: a.id, start: a.startTime.toLocaleTimeString(), end: a.endTime.toLocaleTimeString(), loc: a.location }))
             );

  // --- Determine Starting Point for Search ---
  let lastEventEndTime = workDayStartTime;
  let lastEventLocation = fromAddress || DEFAULT_SHOP_ADDRESS; // Use provided fromAddress or default shop

  // Find the last appointment ending *before* the target window starts
  const previousAppointments = technicianAppointments.filter(apt => apt.endTime <= windowStartTime);
  if (previousAppointments.length > 0) {
      const lastPreviousAppt = previousAppointments[previousAppointments.length - 1]; // Already sorted
      lastEventEndTime = lastPreviousAppt.endTime;
      lastEventLocation = lastPreviousAppt.location || lastEventLocation || DEFAULT_SHOP_ADDRESS;
      console.log(`[findNextAvailableSlot V2] Last event before window: Appt ${lastPreviousAppt.id} ending at ${lastEventEndTime.toLocaleTimeString()}, Loc: ${lastEventLocation}`);
  } else {
      console.log(`[findNextAvailableSlot V2] No appointments before window. Starting from WorkDayStart ${workDayStartTime.toLocaleTimeString()}, Loc: ${lastEventLocation}`);
      // Ensure lastEventEndTime is not before the workday start
      lastEventEndTime = lastEventEndTime < workDayStartTime ? workDayStartTime : lastEventEndTime;
  }

  // --- Calculate Initial Travel Time ---
  let initialTravelTimeSecs = 0;
  let initialTravelDistMeters = 0;
  try {
      if (lastEventLocation && normalizedToAddress) {
          console.log(`[findNextAvailableSlot V2] Calculating initial travel from ${lastEventLocation} to ${normalizedToAddress}`);
          const travelResult = await calculateTravelTime(lastEventLocation, normalizedToAddress);
          initialTravelTimeSecs = travelResult.travelTime;
          initialTravelDistMeters = travelResult.distance;
          console.log(`[findNextAvailableSlot V2] Initial travel: ${initialTravelTimeSecs}s, ${initialTravelDistMeters}m`);
      } else {
          console.warn(`[findNextAvailableSlot V2] Missing location for initial travel calculation.`, {lastEventLocation, toAddress});
      }
  } catch(err) {
      console.error(`[findNextAvailableSlot V2] Initial travel calculation failed: ${err}. Using default 0.`);
  }
  const initialTravelTimeMs = initialTravelTimeSecs * 1000;
  
  // --- Determine Earliest Possible Start Time ---
  // Add buffer AFTER the last event ends
  const earliestArrival = new Date(lastEventEndTime.getTime() + BUFFER_TIME_MS + initialTravelTimeMs);
  // Cannot start before the window starts OR before arrival time OR before workday starts
  let currentTryStartTime = new Date(Math.max(windowStartTime.getTime(), earliestArrival.getTime(), workDayStartTime.getTime()));

  console.log(`[findNextAvailableSlot V2] Initial Try Start Time: ${currentTryStartTime.toLocaleTimeString()} (max of windowStart ${windowStartTime.toLocaleTimeString()}, earliestArrival ${earliestArrival.toLocaleTimeString()}, workDayStart ${workDayStartTime.toLocaleTimeString()})`);

  // --- Iterative Slot Checking Loop ---
  let iterationCount = 0;
  const maxIterations = 50; // Safety break for infinite loops

  while (currentTryStartTime < workDayEndTime && iterationCount < maxIterations) {
    iterationCount++;
    console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Checking potential start: ${currentTryStartTime.toLocaleTimeString()}`);
    const proposedEndTime = new Date(currentTryStartTime.getTime() + durationMs);
    console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Proposed end time: ${proposedEndTime.toLocaleTimeString()}`);
    
    // === Add Logging Here ===
    console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Travel time associated with this potential start: ${initialTravelTimeSecs}s`);
    // === End Logging ===

    // Check if proposed slot ends after work day
    if (proposedEndTime > workDayEndTime) {
      console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Proposed end time ${proposedEndTime.toLocaleTimeString()} exceeds work day end time ${workDayEndTime.toLocaleTimeString()}. Advancing to next day or exiting.`);
      break; // No more slots today
    }

    let conflictFound = false;
    let travelTimeToNextConflict = 0;
    let travelDistanceFromNextConflict = 0;

    console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Checking against ${technicianAppointments.length} existing appointments...`);
    for (const existingAppt of technicianAppointments) {
      const existingStart = new Date(existingAppt.scheduled_start);
      const existingEnd = new Date(existingAppt.scheduled_end);
      
      const proposedSlot = { start: currentTryStartTime, end: proposedEndTime };
      const existingSlot = { start: existingStart, end: existingEnd }; // Simplified existing slot for basic overlap
      
      console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Comparing [${proposedSlot.start.toLocaleTimeString()}-${proposedSlot.end.toLocaleTimeString()}] vs Appt ${existingAppt.id.substring(0,4)} [${existingSlot.start.toLocaleTimeString()}-${existingSlot.end.toLocaleTimeString()}]`);

      // Basic Overlap: (Slot1Start < Slot2End) && (Slot1End > Slot2Start)
      if (proposedSlot.start < existingSlot.end && proposedSlot.end > existingSlot.start) {
        conflictFound = true;
        console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}]   -> CONFLICT DETECTED with Appt ${existingAppt.id.substring(0,4)}`);
        
        currentTryStartTime = new Date(existingEnd.getTime() + BUFFER_TIME_MS);
        
        const conflictApptLocation = resolveAppointmentLocation(existingAppt);
        console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Conflict details: Ends at ${existingEnd.toLocaleTimeString()}, Location: ${conflictApptLocation}`);

        if (conflictApptLocation && normalizedToAddress && conflictApptLocation !== normalizedToAddress) {
            console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Calculating travel from conflict location: ${conflictApptLocation} to ${normalizedToAddress}`);
            try {
                const travelInfo = await calculateTravelTime(conflictApptLocation, normalizedToAddress);
                initialTravelTimeSecs = travelInfo.travelTime;
                initialTravelDistMeters = travelInfo.distance;
                currentTryStartTime = new Date(currentTryStartTime.getTime() + initialTravelTimeSecs * 1000);
            } catch (error) {
                console.error('[findNextAvailableSlot V2] Error calculating travel from conflict:', error);
                initialTravelTimeSecs = 0; 
                initialTravelDistMeters = 0;
            }
        } else {
            initialTravelTimeSecs = 0; 
            initialTravelDistMeters = 0;
        }
        console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Conflict resolved. Next try start time calculated as: ${currentTryStartTime.toLocaleTimeString()}`);
        console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] Updated initialTravelTimeSecs for next iteration: ${initialTravelTimeSecs}s`);
        break; 
      }
    }

    if (!conflictFound) {
      console.log(`[findNextAvailableSlot V2 - Loop ${iterationCount}] --> NO CONFLICT found for slot [${currentTryStartTime.toLocaleTimeString()}-${proposedEndTime.toLocaleTimeString()}]`);

      // Recompute travel from the actual prior stop (not shop) for this slot start
      const priorAppointments = technicianAppointments.filter(
        (apt) => apt.endTime.getTime() <= currentTryStartTime.getTime()
      );
      let travelFromLocation = fromAddress || DEFAULT_SHOP_ADDRESS;
      let travelFromEndTime = workDayStartTime;

      if (priorAppointments.length > 0) {
        const lastPrior = priorAppointments[priorAppointments.length - 1];
        travelFromLocation = resolveAppointmentLocation(lastPrior) || travelFromLocation;
        travelFromEndTime = lastPrior.endTime;
        console.log(
          `[findNextAvailableSlot V2] Prior stop: Appt ${lastPrior.id.substring(0, 4)} ended ${travelFromEndTime.toLocaleTimeString()} at ${travelFromLocation}`
        );
      } else {
        travelFromLocation = lastEventLocation || travelFromLocation;
        travelFromEndTime = lastEventEndTime;
      }

      let slotTravelTimeSecs = 0;
      let slotTravelDistMeters = 0;
      try {
        if (travelFromLocation && normalizedToAddress) {
          console.log(
            `[findNextAvailableSlot V2] Final travel from ${travelFromLocation} to ${normalizedToAddress}`
          );
          const travelResult = await calculateTravelTime(travelFromLocation, normalizedToAddress);
          slotTravelTimeSecs = travelResult.travelTime;
          slotTravelDistMeters = travelResult.distance;
        }
      } catch (err) {
        console.error('[findNextAvailableSlot V2] Final travel calculation failed:', err);
      }

      const minStartFromPrior = new Date(
        travelFromEndTime.getTime() + BUFFER_TIME_MS + slotTravelTimeSecs * 1000
      );
      let finalStartTime = currentTryStartTime;
      if (finalStartTime.getTime() < minStartFromPrior.getTime()) {
        finalStartTime = minStartFromPrior;
        console.log(
          `[findNextAvailableSlot V2] Adjusted start to ${finalStartTime.toLocaleTimeString()} to allow drive time from prior stop`
        );
      }

      const finalEndTime = new Date(finalStartTime.getTime() + durationMs);
      if (finalEndTime > workDayEndTime) {
        console.log('[findNextAvailableSlot V2] Adjusted slot exceeds work day end; continuing search.');
        currentTryStartTime = new Date(finalStartTime.getTime() + 15 * 60 * 1000);
        continue;
      }

      // Guard against overlap after time adjustment
      const overlapsExisting = technicianAppointments.some((apt) => {
        return finalStartTime < apt.endTime && finalEndTime > apt.startTime;
      });
      if (overlapsExisting) {
        console.log('[findNextAvailableSlot V2] Adjusted slot overlaps an existing appointment; continuing search.');
        currentTryStartTime = new Date(finalStartTime.getTime() + 15 * 60 * 1000);
        continue;
      }

      console.log(
        `[findNextAvailableSlot V2 - Loop ${iterationCount}] Successfully found slot: [${finalStartTime.toLocaleTimeString()}-${finalEndTime.toLocaleTimeString()}], travel ${slotTravelTimeSecs}s`
      );
      return {
        startTime: finalStartTime,
        endTime: finalEndTime,
        travelTimeBefore: slotTravelTimeSecs,
        travelDistanceBefore: slotTravelDistMeters,
        travelTime: slotTravelTimeSecs,
        travelDistance: slotTravelDistMeters,
      };
    }
  } // End while loop

  if (iterationCount >= maxIterations) {
    console.log(`[findNextAvailableSlot V2] Max iterations (${maxIterations}) reached. No slot found.`);
  } else {
    console.log("[findNextAvailableSlot V2] Exited loop without finding a slot (e.g., proposed end exceeded workday).");
  }
  return null; // No slot found
}

// Helper function to get technician appointments on a specific date, already parsed
export function getTechnicianAppointmentsForDate(allAppointments, technicianId, targetDate) {
  // ... existing code ...
} 