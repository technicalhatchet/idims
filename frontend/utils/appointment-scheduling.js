/**
 * Utility functions for appointment scheduling with time windows
 */
import { format, addMinutes, subMinutes } from 'date-fns';
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

/** Default minimum open slot length when picking a morning/afternoon window. */
export const DEFAULT_MIN_SLOT_MINUTES = 45;

/**
 * Parse API / form schedule timestamps into local Date objects.
 */
export function parseScheduleInstant(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function normalizeCalendarDay(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    const [datePart] = date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function isSameCalendarDay(a, b) {
  const dayA = normalizeCalendarDay(a);
  const dayB = normalizeCalendarDay(b);
  if (!dayA || !dayB) return false;
  return (
    dayA.getFullYear() === dayB.getFullYear() &&
    dayA.getMonth() === dayB.getMonth() &&
    dayA.getDate() === dayB.getDate()
  );
}

function getScheduleItemInterval(item) {
  const start = parseScheduleInstant(item?.scheduled_start);
  const end = parseScheduleInstant(item?.scheduled_end);
  if (!start || !end || end <= start) return null;
  return { start, end };
}

function mergeBusyIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/**
 * True when [rangeStart, rangeEnd] contains a contiguous open segment >= minSlotMinutes.
 */
export function hasOpenSlotInRange(rangeStart, rangeEnd, busyIntervals, minSlotMinutes) {
  const minMs = minSlotMinutes * 60 * 1000;
  const clipped = busyIntervals
    .filter(({ start, end }) => intervalsOverlap(start, end, rangeStart, rangeEnd))
    .map(({ start, end }) => ({
      start: new Date(Math.max(start.getTime(), rangeStart.getTime())),
      end: new Date(Math.min(end.getTime(), rangeEnd.getTime())),
    }))
    .filter(({ start, end }) => end > start);

  const merged = mergeBusyIntervals(clipped);
  let cursor = rangeStart.getTime();

  for (const busy of merged) {
    if (busy.start.getTime() - cursor >= minMs) return true;
    cursor = Math.max(cursor, busy.end.getTime());
  }
  return rangeEnd.getTime() - cursor >= minMs;
}

export function getBlockingIntervalsForTechnician(
  items,
  technicianId,
  day,
  { excludeAppointmentId = null } = {}
) {
  if (!technicianId || !Array.isArray(items)) return [];

  return items
    .filter((item) => {
      if (!isSchedulingConflict(item)) return false;
      if (String(item.assigned_technician_id) !== String(technicianId)) return false;
      if (excludeAppointmentId && item.id === excludeAppointmentId) return false;
      if (!isSameCalendarDay(item.scheduled_start, day)) return false;
      return true;
    })
    .map((item) => {
      const interval = getScheduleItemInterval(item);
      if (!interval) return null;
      return { ...interval, item };
    })
    .filter(Boolean);
}

export function describeScheduleConflict(item) {
  if (isCalendarBlockScheduleItem(item)) {
    const label = item.title || item.block_type || 'Time block';
    return `Time block (${label})`;
  }
  const status = getAppointmentStatusValue(item);
  return status ? `Appointment (${status})` : 'Appointment';
}

/**
 * Conflicts for a proposed [start, end] on a technician's day (appointments + blocks).
 */
export function findScheduleConflictsForInterval(
  items,
  technicianId,
  start,
  end,
  { excludeAppointmentId = null } = {}
) {
  const proposedStart = parseScheduleInstant(start);
  const proposedEnd = parseScheduleInstant(end);
  if (!proposedStart || !proposedEnd || proposedEnd <= proposedStart || !technicianId) {
    return [];
  }

  return getBlockingIntervalsForTechnician(items, technicianId, proposedStart, {
    excludeAppointmentId,
  }).filter(({ start: busyStart, end: busyEnd, item }) => {
    if (!intervalsOverlap(proposedStart, proposedEnd, busyStart, busyEnd)) return false;
    return true;
  }).map(({ item, start: busyStart, end: busyEnd }) => ({
    item,
    label: describeScheduleConflict(item),
    start: busyStart,
    end: busyEnd,
  }));
}

export function isProposedSlotAvailable(
  items,
  technicianId,
  start,
  end,
  options = {}
) {
  const conflicts = findScheduleConflictsForInterval(
    items,
    technicianId,
    start,
    end,
    options
  );
  if (conflicts.length === 0) {
    return { available: true };
  }
  const first = conflicts[0];
  return {
    available: false,
    reason: `Conflicts with ${first.label} (${formatConflictRange(first.start, first.end)})`,
    conflicts,
  };
}

function formatConflictRange(start, end) {
  const opts = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
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

/** Higher score = more likely to geocode correctly (city/state/zip present). */
function addressGeocodeScore(address) {
  if (!address) return 0;
  const trimmed = String(address).trim();
  let score = trimmed.length;
  if (/,/.test(trimmed)) score += 20;
  if (/\b[A-Z]{2}\b/.test(trimmed)) score += 15;
  if (/\b\d{5}(?:-\d{4})?\b/.test(trimmed)) score += 25;
  return score;
}

/** Pick the best geocodable address when service_location is incomplete. */
function pickBestGeocodableAddress(...candidates) {
  const unique = [...new Set(candidates.filter(Boolean).map((a) => String(a).trim()))];
  if (!unique.length) return null;
  return unique.sort((a, b) => addressGeocodeScore(b) - addressGeocodeScore(a))[0];
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
  const fromAppointmentProperty = formatPropertyAddress(appointment.property);

  const workOrder = appointment.work_order;
  let fromWorkOrder = null;
  let fromWorkOrderProperty = null;
  if (workOrder) {
    fromWorkOrder = formatServiceLocationAddress(workOrder.service_location);
    fromWorkOrderProperty = formatPropertyAddress(workOrder.property);
  }

  return pickBestGeocodableAddress(
    fromServiceLocation,
    fromAppointmentProperty,
    fromWorkOrder,
    fromWorkOrderProperty
  );
}

export function resolveWorkOrderServiceAddress(workOrder = {}) {
  const fromServiceLocation = formatServiceLocationAddress(workOrder.service_location);

  const fromProperty = formatPropertyAddress(workOrder.property);

  let fromClientProperty = null;
  const propertyId = workOrder.property_id;
  if (propertyId && Array.isArray(workOrder.client_properties)) {
    const matched = workOrder.client_properties.find(
      (p) => p.id === propertyId || String(p.id) === String(propertyId)
    );
    fromClientProperty = formatPropertyAddress(matched);
  }

  // Prefer the most complete address. Work orders often store only the street line in
  // service_location while the linked property has "242 1/2 Main St, Luckey, OH 43443".
  return pickBestGeocodableAddress(fromServiceLocation, fromProperty, fromClientProperty);
}

// Define time window boundaries (defaults - can be overridden by shop_hours)
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
    label: 'Afternoon (12:30 PM - 5:00 PM)',
    startHour: 12,
    startMinute: 30,
    endHour: 17,
    endMinute: 0
  },
  EVENING: {
    name: 'evening',
    label: 'Evening (5:00 PM - 9:00 PM)',
    startHour: 17,
    startMinute: 0,
    endHour: 21,
    endMinute: 0
  }
};

// Constants for scheduling logic
const TECHNICIAN_WORK_START_HOUR = 8; // 8 AM
const TECHNICIAN_WORK_END_HOUR = 17; // 5 PM
const BUFFER_TIME_MINUTES = 10; // Buffer between appointments
const BUFFER_TIME_MS = BUFFER_TIME_MINUTES * 60 * 1000;

/** Prep time before dispatch when scheduling same-day ASAP (not a hard commitment). */
export const PREP_BUFFER_MINUTES = 15;
const PREP_BUFFER_MS = PREP_BUFFER_MINUTES * 60 * 1000;

/** Client-facing afternoon ETA must not start before noon. */
export const CLIENT_ETA_AFTERNOON_FLOOR = { hour: 12, minute: 0 };

/** Client-facing morning ETA must not start before 8:45 AM. */
export const CLIENT_ETA_MORNING_FLOOR = { hour: 8, minute: 45 };

function applyClientEtaFloor(rawEtaStart, scheduledStartTime, timeWindow) {
  if (timeWindow === 'afternoon') {
    const floor = new Date(scheduledStartTime);
    floor.setHours(
      CLIENT_ETA_AFTERNOON_FLOOR.hour,
      CLIENT_ETA_AFTERNOON_FLOOR.minute,
      0,
      0
    );
    if (rawEtaStart < floor) return floor;
  }
  if (timeWindow === 'morning') {
    const floor = new Date(scheduledStartTime);
    floor.setHours(
      CLIENT_ETA_MORNING_FLOOR.hour,
      CLIENT_ETA_MORNING_FLOOR.minute,
      0,
      0
    );
    if (rawEtaStart < floor) return floor;
  }
  return rawEtaStart;
}

export function roundToNearestQuarterHour(date, direction) {
  const minutes = date.getMinutes();
  let roundedMinutes;

  if (direction === 'down') {
    roundedMinutes = minutes - (minutes % 15);
  } else if (direction === 'up') {
    const remainder = minutes % 15;
    roundedMinutes = remainder === 0 ? minutes : minutes + (15 - remainder);
  } else {
    roundedMinutes = minutes;
  }

  const newDate = new Date(date.getTime());
  newDate.setMinutes(roundedMinutes, 0, 0);

  if (roundedMinutes >= 60) {
    newDate.setHours(newDate.getHours() + Math.floor(roundedMinutes / 60));
    newDate.setMinutes(roundedMinutes % 60);
  } else if (roundedMinutes < 0) {
    newDate.setHours(newDate.getHours() + Math.floor(roundedMinutes / 60));
    newDate.setMinutes((roundedMinutes % 60 + 60) % 60);
  }

  return newDate;
}

/**
 * Same-day ASAP when the anchor time falls inside the selected customer window.
 * Future dates or planning before the window opens use first-slot mode.
 */
export function resolveSchedulingMode(date, windowName, anchorTime = new Date()) {
  const normalizedDate = normalizeCalendarDay(date);
  if (!normalizedDate || !windowName) return 'first-slot';

  const anchor = parseScheduleInstant(anchorTime) || new Date();
  if (!isSameCalendarDay(normalizedDate, anchor)) return 'first-slot';

  const { startTime: windowStart, endTime: windowEnd } = getTimeWindowBoundaries(
    normalizedDate,
    windowName
  );
  return anchor >= windowStart && anchor < windowEnd ? 'asap' : 'first-slot';
}

/**
 * Estimated arrival window shown to the client (±90 min, quarter-hour rounding).
 * Morning ETAs never start before 8:45 AM; afternoon never before 12:00 PM.
 */
export function computeClientEtaWindow(scheduledStart, timeWindow) {
  const scheduledStartTime = parseScheduleInstant(scheduledStart);
  if (!scheduledStartTime) return null;

  let rawEtaStart = subMinutes(scheduledStartTime, 90);
  const rawEtaEnd = addMinutes(scheduledStartTime, 90);

  rawEtaStart = applyClientEtaFloor(rawEtaStart, scheduledStartTime, timeWindow);

  const roundedEtaStart = roundToNearestQuarterHour(rawEtaStart, 'down');
  const roundedEtaEnd = roundToNearestQuarterHour(rawEtaEnd, 'up');

  return {
    display: `${format(roundedEtaStart, 'h:mm a')} - ${format(roundedEtaEnd, 'h:mm a')}`,
    rawEtaStart,
    rawEtaEnd,
    roundedEtaStart,
    roundedEtaEnd,
  };
}

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
 * @param {string} windowName - 'morning', 'afternoon', or 'evening'
 * @param {Object} [shopHours] - Optional shop hours config for the day
 * @returns {Object} { startTime, endTime } as Date objects
 */
export function getTimeWindowBoundaries(date, windowName, shopHours = null) {
  // Get the base window definition
  let window;
  if (windowName === 'morning') {
    window = TIME_WINDOWS.MORNING;
  } else if (windowName === 'evening') {
    window = TIME_WINDOWS.EVENING;
  } else {
    window = TIME_WINDOWS.AFTERNOON;
  }
  
  // Determine day-specific hours
  // shopHours can be either:
  // 1. Full object with day keys: { monday: { regular, evening }, tuesday: {...}, ... }
  // 2. Day-specific object passed directly: { regular, evening }
  let dayHours = null;
  if (shopHours) {
    // Check if this is a full shop hours object (has day keys like 'monday')
    const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const hasDayKeys = DAYS_OF_WEEK.some(day => shopHours[day] !== undefined);
    
    if (hasDayKeys) {
      // Full shop hours object - extract day-specific hours
      let dayOfWeek;
      if (typeof date === 'string') {
        const [datePart] = date.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        dayOfWeek = DAYS_OF_WEEK[new Date(year, month - 1, day).getDay()];
      } else {
        dayOfWeek = DAYS_OF_WEEK[date.getDay()];
      }
      dayHours = shopHours[dayOfWeek];
    } else if (shopHours.regular !== undefined || shopHours.evening !== undefined) {
      // Day-specific object passed directly
      dayHours = shopHours;
    }
  }
  
  // If shop hours provided, use custom times for evening window
  if (dayHours?.evening?.enabled && windowName === 'evening') {
    const [startH, startM] = (dayHours.evening.start || '17:00').split(':').map(Number);
    const [endH, endM] = (dayHours.evening.end || '21:00').split(':').map(Number);
    window = {
      ...window,
      startHour: startH,
      startMinute: startM || 0,
      endHour: endH,
      endMinute: endM || 0,
    };
  }
  
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
 * Check if a time window has capacity for scheduling.
 * With a technician: requires an open slot (interval overlap + blocks), not a simple job count.
 * @param {Object} [options]
 * @param {string} [options.excludeAppointmentId] - When editing, ignore this appointment
 * @param {number} [options.minSlotMinutes] - Minimum contiguous free minutes needed in the window
 * @param {Object} [options.shopHours] - Shop hours config for the day (for evening window customization)
 */
export function isTimeWindowAvailable(
  date,
  windowName,
  existingAppointments,
  technicianId,
  options = {}
) {
  const {
    excludeAppointmentId = null,
    minSlotMinutes = DEFAULT_MIN_SLOT_MINUTES,
    shopHours = null,
  } = options;

  const blockingItems = filterSchedulingConflicts(existingAppointments);
  const MAX_APPOINTMENTS_PER_WINDOW = 18;

  if (!date || !windowName) {
    return { available: false, reason: 'Invalid date or time window' };
  }

  const normalizedDate = normalizeCalendarDay(date);
  if (!normalizedDate) {
    return { available: false, reason: 'Invalid date or time window' };
  }

  const now = new Date();
  const isToday = isSameCalendarDay(normalizedDate, now);

  if (isToday) {
    const { endTime: windowEnd } = getTimeWindowBoundaries(normalizedDate, windowName, shopHours);
    const bufferMs = 30 * 60 * 1000;
    if (now.getTime() + bufferMs >= windowEnd.getTime()) {
      return { available: false, reason: 'This time window has already passed' };
    }
  }

  const { startTime, endTime } = getTimeWindowBoundaries(normalizedDate, windowName, shopHours);

  const appointmentsInWindow = blockingItems.filter((item) => {
    const interval = getScheduleItemInterval(item);
    if (!interval || !isSameCalendarDay(interval.start, normalizedDate)) return false;
    return intervalsOverlap(interval.start, interval.end, startTime, endTime);
  });

  if (appointmentsInWindow.length >= MAX_APPOINTMENTS_PER_WINDOW) {
    return {
      available: false,
      reason: `Maximum window capacity reached (${appointmentsInWindow.length}/${MAX_APPOINTMENTS_PER_WINDOW} appointments)`,
    };
  }

  if (technicianId) {
    const busyIntervals = getBlockingIntervalsForTechnician(
      blockingItems,
      technicianId,
      normalizedDate,
      { excludeAppointmentId }
    );

    const blockInWindow = busyIntervals.find(({ item }) => isCalendarBlockScheduleItem(item));
    const hasOpenSlot = hasOpenSlotInRange(startTime, endTime, busyIntervals, minSlotMinutes);

    if (!hasOpenSlot) {
      if (blockInWindow) {
        const label = describeScheduleConflict(blockInWindow.item);
        return {
          available: false,
          reason: `No open slot — ${label} overlaps this window`,
        };
      }
      return {
        available: false,
        reason: `No open ${minSlotMinutes}-minute slot for this technician in this window`,
      };
    }

    const techOverlaps = appointmentsInWindow.filter(
      (item) => String(item.assigned_technician_id) === String(technicianId)
    );

    return {
      available: true,
      appointmentCount: techOverlaps.length,
      maxAppointments: null,
      hasCalendarBlock: Boolean(blockInWindow),
    };
  }

  return {
    available: true,
    appointmentCount: appointmentsInWindow.length,
    maxAppointments: MAX_APPOINTMENTS_PER_WINDOW,
  };
}

/** When the tech leaves the shop for the first stop in a window (not from a prior job). */
function resolveShopDispatchTime(windowStartTime, anchorTime, normalizedDate) {
  let dispatch = new Date(windowStartTime);
  if (isSameCalendarDay(normalizedDate, anchorTime)) {
    dispatch = new Date(
      Math.max(windowStartTime.getTime(), anchorTime.getTime() + PREP_BUFFER_MS)
    );
  }
  return dispatch;
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
  duration = DEFAULT_MIN_SLOT_MINUTES,
  options = {}
) {
  const {
    schedulingAnchorTime,
    schedulingMode: explicitSchedulingMode,
    shopHours,
  } = options;

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

  const { startTime: windowStartTime, endTime: windowEndTime } = getTimeWindowBoundaries(normalizedDate, windowName, shopHours);
  const workDayStartTime = new Date(normalizedDate); workDayStartTime.setHours(TECHNICIAN_WORK_START_HOUR, 0, 0, 0);
  // For evening windows, extend work day end to the window end time
  const workDayEndTime = new Date(normalizedDate);
  if (windowName === 'evening') {
    // Use the evening window end time as the work day end
    workDayEndTime.setTime(windowEndTime.getTime());
  } else {
    workDayEndTime.setHours(TECHNICIAN_WORK_END_HOUR, 0, 0, 0);
  }
  const durationMs = duration * 60 * 1000;

  const anchorTime = parseScheduleInstant(schedulingAnchorTime) || new Date();
  const schedulingMode =
    explicitSchedulingMode || resolveSchedulingMode(normalizedDate, windowName, anchorTime);
  const isAsap = schedulingMode === 'asap';
  console.log(
    `[findNextAvailableSlot V2] Scheduling mode: ${schedulingMode} (anchor ${anchorTime.toLocaleTimeString()})`
  );

  // --- Filter and Sort Technician's Appointments for the Day ---
  const technicianAppointments = allExistingAppointments.filter(apt => {
    if (
      !apt.scheduled_start ||
      !apt.scheduled_end ||
      String(apt.assigned_technician_id) !== String(technicianId)
    ) {
      return false;
    }
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
  const inProgressBeforeAnchor = technicianAppointments.filter(
    (apt) => apt.startTime <= anchorTime && apt.endTime > anchorTime
  );
  const endedBeforeAnchor = technicianAppointments.filter(
    (apt) => apt.endTime <= anchorTime
  );
  const previousBeforeWindow = technicianAppointments.filter(
    (apt) => apt.endTime <= windowStartTime
  );

  const isDepartingFromShop = isAsap
    ? inProgressBeforeAnchor.length === 0 && endedBeforeAnchor.length === 0
    : previousBeforeWindow.length === 0;

  let shopDispatchTime = resolveShopDispatchTime(windowStartTime, anchorTime, normalizedDate);
  let lastEventEndTime = workDayStartTime;
  let lastEventLocation = fromAddress || DEFAULT_SHOP_ADDRESS;

  if (isAsap) {
    if (inProgressBeforeAnchor.length > 0) {
      const active = inProgressBeforeAnchor[inProgressBeforeAnchor.length - 1];
      lastEventEndTime = active.endTime;
      lastEventLocation = active.location || lastEventLocation || DEFAULT_SHOP_ADDRESS;
      console.log(
        `[findNextAvailableSlot V2] ASAP: in-progress appt ${active.id} until ${lastEventEndTime.toLocaleTimeString()}`
      );
    } else if (endedBeforeAnchor.length > 0) {
      const last = endedBeforeAnchor[endedBeforeAnchor.length - 1];
      lastEventEndTime = last.endTime;
      lastEventLocation = last.location || lastEventLocation || DEFAULT_SHOP_ADDRESS;
      console.log(
        `[findNextAvailableSlot V2] ASAP: last completed appt ended ${lastEventEndTime.toLocaleTimeString()}`
      );
    } else {
      lastEventEndTime = new Date(anchorTime);
      lastEventLocation = fromAddress || DEFAULT_SHOP_ADDRESS;
      console.log('[findNextAvailableSlot V2] ASAP: dispatching from shop after prep buffer');
    }

    const dispatchFloor = new Date(anchorTime.getTime() + PREP_BUFFER_MS);
    lastEventEndTime = new Date(Math.max(lastEventEndTime.getTime(), dispatchFloor.getTime()));
    if (isDepartingFromShop) {
      shopDispatchTime = new Date(lastEventEndTime);
    }
  } else if (previousBeforeWindow.length > 0) {
    const lastPreviousAppt = previousBeforeWindow[previousBeforeWindow.length - 1];
    lastEventEndTime = lastPreviousAppt.endTime;
    lastEventLocation = lastPreviousAppt.location || lastEventLocation || DEFAULT_SHOP_ADDRESS;
    console.log(
      `[findNextAvailableSlot V2] Last event before window: Appt ${lastPreviousAppt.id} ending at ${lastEventEndTime.toLocaleTimeString()}, Loc: ${lastEventLocation}`
    );
  } else {
    lastEventLocation = fromAddress || DEFAULT_SHOP_ADDRESS;
    lastEventEndTime = shopDispatchTime;
    console.log(
      `[findNextAvailableSlot V2] First stop from shop; depart ${lastEventEndTime.toLocaleTimeString()} (window opens ${windowStartTime.toLocaleTimeString()})`
    );
  }

  const gapBeforeTravelMs = isDepartingFromShop ? 0 : BUFFER_TIME_MS;

  // --- Calculate Initial Travel Time ---
  let initialTravelTimeSecs = 0;
  let initialTravelDistMeters = 0;
  try {
      if (lastEventLocation && normalizedToAddress) {
          console.log(`[findNextAvailableSlot V2] Calculating initial travel from ${lastEventLocation} to ${normalizedToAddress}`);
          const travelResult = await calculateTravelTime(lastEventLocation, normalizedToAddress);
          if (travelResult) {
            initialTravelTimeSecs = travelResult.travelTime;
            initialTravelDistMeters = travelResult.distance;
          }
          console.log(`[findNextAvailableSlot V2] Initial travel: ${initialTravelTimeSecs}s, ${initialTravelDistMeters}m`);
      } else {
          console.warn(`[findNextAvailableSlot V2] Missing location for initial travel calculation.`, {lastEventLocation, toAddress});
      }
  } catch(err) {
      console.error(`[findNextAvailableSlot V2] Initial travel calculation failed: ${err}. Using default 0.`);
  }
  const initialTravelTimeMs = initialTravelTimeSecs * 1000;
  
  // --- Determine Earliest Possible Start Time ---
  const earliestArrival = new Date(
    lastEventEndTime.getTime() + gapBeforeTravelMs + initialTravelTimeMs
  );
  let currentTryStartTime;
  if (isAsap) {
    currentTryStartTime = new Date(
      Math.max(earliestArrival.getTime(), workDayStartTime.getTime())
    );
  } else {
    currentTryStartTime = new Date(
      Math.max(
        earliestArrival.getTime(),
        windowStartTime.getTime(),
        workDayStartTime.getTime()
      )
    );
  }

  console.log(
    `[findNextAvailableSlot V2] Initial Try Start Time: ${currentTryStartTime.toLocaleTimeString()} (mode ${schedulingMode}, shop depart ${isDepartingFromShop ? lastEventEndTime.toLocaleTimeString() : 'n/a'}, drive ${Math.round(initialTravelTimeSecs / 60)} min, earliestArrival ${earliestArrival.toLocaleTimeString()})`
  );

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
      let slotGapBeforeTravelMs = BUFFER_TIME_MS;

      if (priorAppointments.length > 0) {
        const lastPrior = priorAppointments[priorAppointments.length - 1];
        travelFromLocation = resolveAppointmentLocation(lastPrior) || travelFromLocation;
        travelFromEndTime = lastPrior.endTime;
        console.log(
          `[findNextAvailableSlot V2] Prior stop: Appt ${lastPrior.id.substring(0, 4)} ended ${travelFromEndTime.toLocaleTimeString()} at ${travelFromLocation}`
        );
      } else {
        travelFromLocation = lastEventLocation || travelFromLocation;
        travelFromEndTime = shopDispatchTime;
        slotGapBeforeTravelMs = 0;
      }

      let slotTravelTimeSecs = 0;
      let slotTravelDistMeters = 0;
      try {
        if (travelFromLocation && normalizedToAddress) {
          console.log(
            `[findNextAvailableSlot V2] Final travel from ${travelFromLocation} to ${normalizedToAddress}`
          );
          const travelResult = await calculateTravelTime(travelFromLocation, normalizedToAddress);
          if (travelResult) {
            slotTravelTimeSecs = travelResult.travelTime;
            slotTravelDistMeters = travelResult.distance;
          }
        }
      } catch (err) {
        console.error('[findNextAvailableSlot V2] Final travel calculation failed:', err);
      }

      const minStartFromPrior = new Date(
        travelFromEndTime.getTime() + slotGapBeforeTravelMs + slotTravelTimeSecs * 1000
      );
      let finalStartTime = currentTryStartTime;
      if (finalStartTime.getTime() < minStartFromPrior.getTime()) {
        finalStartTime = minStartFromPrior;
        console.log(
          `[findNextAvailableSlot V2] Adjusted start to ${finalStartTime.toLocaleTimeString()} (${priorAppointments.length ? 'drive from prior stop' : 'drive from shop'})`
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

      const exceedsCustomerWindow = finalEndTime > windowEndTime;

      console.log(
        `[findNextAvailableSlot V2 - Loop ${iterationCount}] Successfully found slot: [${finalStartTime.toLocaleTimeString()}-${finalEndTime.toLocaleTimeString()}], travel ${slotTravelTimeSecs}s, exceedsCustomerWindow=${exceedsCustomerWindow}`
      );
      return {
        startTime: finalStartTime,
        endTime: finalEndTime,
        travelTimeBefore: slotTravelTimeSecs,
        travelDistanceBefore: slotTravelDistMeters,
        travelTime: slotTravelTimeSecs,
        travelDistance: slotTravelDistMeters,
        exceedsCustomerWindow,
        windowEndTime,
        schedulingMode,
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