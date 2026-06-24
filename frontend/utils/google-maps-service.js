/**
 * Google Maps service utility for calculating travel times and distances.
 * Calls the backend /api/calculate-distance endpoint (Google Routes API, traffic-unaware).
 */

// Constants
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// TEMPORARY HARDCODING FOR DEBUGGING:
//const DEFAULT_SHOP_ADDRESS = "641 Barclay Drive, Toledo, OH 43609, USA";
export const DEFAULT_SHOP_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS || "641 Barclay Drive, Toledo, OH 43609, USA";

/** Open Google Maps directions to an address (mobile-friendly). */
export function buildGoogleMapsDestinationUrl(address) {
  const dest = (address || '').trim();
  if (!dest) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/**
 * Open Maps in the current tab — avoids a blank Safari tab on iOS when the Maps app takes over.
 * (window.open + _blank often leaves an empty background tab on return.)
 */
export function openGoogleMapsDestination(address) {
  const url = buildGoogleMapsDestinationUrl(address);
  if (!url) return false;
  window.location.assign(url);
  return true;
}
// Original line commented out:
// const DEFAULT_SHOP_ADDRESS = process.env.NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS || "YOUR_DEFAULT_SHOP_ADDRESS_HERE"; 

// --- DEBUG --- //
// console.log(`DEBUG: Value read directly for NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS: '${process.env.NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS}'`); // No longer relevant with hardcoding
console.log(`DEBUG: DEFAULT_SHOP_ADDRESS constant after fallback: '${DEFAULT_SHOP_ADDRESS}'`);
// Log all NEXT_PUBLIC_ variables
console.log("DEBUG: All available process.env variables starting with NEXT_PUBLIC_:");
for (const key in process.env) {
  if (key.startsWith('NEXT_PUBLIC_')) {
    console.log(`  ${key}: '${process.env[key]}'`);
  }
}
// --- END DEBUG --- //

// Cache for previously calculated distances/times to avoid redundant API calls
const distanceCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_STORAGE_KEY = 'idims_travel_cache_v1';
const MAX_SESSION_ENTRIES = 80;
let sessionCacheHydrated = false;

function normalizeCacheKey(origin, destination) {
  return `${String(origin || '').trim().toLowerCase()}|${String(destination || '').trim().toLowerCase()}`;
}

/** Drop fractional house numbers (242 1/2 → 242) for Maps routing only. */
export function sanitizeAddressForRouting(address) {
  if (!address) return address;
  const original = String(address).trim();
  const cleaned = original
    .replace(/\s*-\s*\d+\/\d+/g, '')
    .replace(/\s+\d+\/\d+/g, '')
    .replace(/\s+[½¼¾]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim();
  return cleaned || original;
}

function hydrateSessionCache() {
  if (sessionCacheHydrated || typeof sessionStorage === 'undefined') return;
  sessionCacheHydrated = true;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    const now = Date.now();
    Object.entries(entries).forEach(([key, val]) => {
      if (val?.cachedAt && now - val.cachedAt < CACHE_TTL_MS) {
        distanceCache.set(key, val);
      }
    });
  } catch {
    // ignore corrupt session cache
  }
}

function persistSessionCache() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const entries = {};
    const sorted = [...distanceCache.entries()]
      .sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))
      .slice(0, MAX_SESSION_ENTRIES);
    sorted.forEach(([key, val]) => {
      entries[key] = val;
    });
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota or private mode — memory cache still works
  }
}

function getCachedTravel(cacheKey) {
  hydrateSessionCache();
  const hit = distanceCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > CACHE_TTL_MS) {
    distanceCache.delete(cacheKey);
    return null;
  }
  return { travelTime: hit.travelTime, distance: hit.distance };
}

function setCachedTravel(cacheKey, result) {
  distanceCache.set(cacheKey, { ...result, cachedAt: Date.now() });
  persistSessionCache();
}

/** True when the browser tab is in the foreground (safe to hit Routes API). */
export function isTravelApiAllowed() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

/**
 * Load the Google Maps API script dynamically
 * @returns {Promise} A promise that resolves when the API is loaded
 */
export const loadGoogleMapsAPI = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }

    // Create script tag
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    // Set callbacks
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    
    // Add to document
    document.head.appendChild(script);
  });
};

/**
 * Calculate travel time and distance between two addresses.
 * Results are cached in memory + sessionStorage; duplicate in-flight legs share one request.
 *
 * @param {string} originAddress
 * @param {string} destinationAddress
 * @param {{ skipIfHidden?: boolean }} [options]
 * @returns {Promise<{travelTime: number, distance: number} | null>}
 */
export async function calculateTravelTime(originAddress, destinationAddress, options = {}) {
  const { skipIfHidden = false } = options;

  if (!originAddress || !destinationAddress) {
    throw new Error('Origin and destination addresses are required');
  }

  const origin = sanitizeAddressForRouting(originAddress);
  const destination = sanitizeAddressForRouting(destinationAddress);

  const cacheKey = normalizeCacheKey(origin, destination);
  const cached = getCachedTravel(cacheKey);
  if (cached) return cached;

  if (skipIfHidden && !isTravelApiAllowed()) {
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('Google Maps API key not configured');
    return {
      travelTime: 1800,
      distance: 15000,
    };
  }

  const existing = inFlightRequests.get(cacheKey);
  if (existing) return existing;

  const backendHost = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
  const backendEndpoint = `${backendHost}/api/calculate-distance`;

  const request = (async () => {
    try {
      const response = await fetch(backendEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDetail = data?.detail || response.statusText;
        console.error(`Backend error calculating travel time: ${response.status} - ${errorDetail}`);
        throw new Error(`Failed to calculate travel time: ${errorDetail}`);
      }

      if (typeof data.travelTime === 'number' && typeof data.distance === 'number') {
        const result = {
          travelTime: data.travelTime,
          distance: data.distance,
        };
        setCachedTravel(cacheKey, result);
        return result;
      }

      console.warn('Backend proxy returned unexpected data format:', data);
      return {
        travelTime: 1800,
        distance: 15000,
      };
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return {
        travelTime: 1800,
        distance: 15000,
      };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, request);
  return request;
}

/**
 * Calculate an optimal schedule for appointments
 * 
 * @param {string} startLocation - The starting location (usually shop/depot address)
 * @param {Array} appointments - Array of appointment objects with {id, address, duration} properties
 * @param {Date} startDateTime - The start date and time for scheduling
 * @returns {Promise<Array>} - Optimized schedule with appointment times and travel info
 */
export async function calculateOptimalSchedule(startLocation, appointments, startDateTime) {
  try {
    if (!startLocation || !appointments || !startDateTime) {
      throw new Error('Start location, appointments, and start date/time are required');
    }

    if (appointments.length === 0) {
      return [];
    }

    const schedule = [];
    let currentLocation = startLocation;
    let currentTime = new Date(startDateTime);

    // Process each appointment
    for (const appointment of appointments) {
      // Calculate travel time from current location to appointment
      const { travelTime: travelTimeBefore, distance: travelDistanceBefore } = 
        await calculateTravelTime(currentLocation, appointment.address);
      
      // Add travel time to current time
      const arrivalTime = new Date(currentTime.getTime() + (travelTimeBefore * 1000));
      
      // Calculate appointment end time based on duration (default to 1 hour if not specified)
      const duration = appointment.duration || 60;
      const departureTime = new Date(arrivalTime.getTime() + (duration * 60 * 1000));
      
      // Calculate travel time back to the starting location
      const { travelTime: travelTimeAfter, distance: travelDistanceAfter } = 
        await calculateTravelTime(appointment.address, startLocation);
      
      // Add to schedule
      schedule.push({
        id: appointment.id,
        address: appointment.address,
        startTime: arrivalTime.toISOString(),
        endTime: departureTime.toISOString(),
        duration: duration * 60, // duration in seconds
        travelTimeBefore,
        travelTimeAfter,
        travelDistanceBefore,
        travelDistanceAfter
      });
      
      // Update current location and time for next appointment
      currentLocation = appointment.address;
      currentTime = departureTime;
    }

    return schedule;
  } catch (error) {
    console.error('Error calculating optimal schedule:', error);
    return [];
  }
}

/**
 * Find available time slots for a new appointment
 * @param {Array} existingAppointments - Array of existing appointments with start/end times
 * @param {number} durationMinutes - Required duration in minutes for the new appointment
 * @param {string} location - Address of the new appointment
 * @param {Date} startDate - Start date to begin search
 * @param {Date} endDate - End date to end search
 * @returns {Promise<Array<{start: Date, end: Date}>>} Array of available time slots
 */
export const findAvailableTimeSlots = async (
  existingAppointments = [],
  durationMinutes = 60,
  location,
  startDate = new Date(),
  endDate = new Date(new Date().setDate(new Date().getDate() + 7)) // Default to next 7 days
) => {
  const shopAddress = DEFAULT_SHOP_ADDRESS;
  const availableSlots = [];
  
  // Calculate travel time to/from the appointment location
  const travelToAppointment = await calculateTravelTime(shopAddress, location);
  const travelFromAppointment = await calculateTravelTime(location, shopAddress);
  
  // Total time needed including travel (in milliseconds)
  const totalTimeNeeded = (
    travelToAppointment.duration + 
    (durationMinutes * 60) + 
    travelFromAppointment.duration
  ) * 1000;
  
  // Sort existing appointments by start time
  const sortedAppointments = [...existingAppointments].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );
  
  // Business hours (9am to 5pm)
  const businessHourStart = 9;
  const businessHourEnd = 17;
  
  // Iterate through each day in the date range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Skip weekends (0 = Sunday, 6 = Saturday)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Set start and end of business day
    const dayStart = new Date(currentDate);
    dayStart.setHours(businessHourStart, 0, 0, 0);
    
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(businessHourEnd, 0, 0, 0);
    
    // Get appointments for this day
    const appointmentsForDay = sortedAppointments.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime);
      return (
        appointmentDate.getFullYear() === currentDate.getFullYear() &&
        appointmentDate.getMonth() === currentDate.getMonth() &&
        appointmentDate.getDate() === currentDate.getDate()
      );
    });
    
    // Find gaps between appointments
    let timePointer = new Date(dayStart);
    
    // Check if we can fit an appointment before the first appointment of the day
    if (appointmentsForDay.length > 0) {
      const firstAppointment = appointmentsForDay[0];
      const gapBeforeFirst = new Date(firstAppointment.startTime) - timePointer;
      
      if (gapBeforeFirst >= totalTimeNeeded) {
        availableSlots.push({
          start: new Date(timePointer),
          end: new Date(timePointer.getTime() + durationMinutes * 60 * 1000)
        });
      }
      
      // Check gaps between appointments
      for (let i = 0; i < appointmentsForDay.length - 1; i++) {
        const currentAppt = appointmentsForDay[i];
        const nextAppt = appointmentsForDay[i + 1];
        
        timePointer = new Date(currentAppt.endTime);
        const gapBetween = new Date(nextAppt.startTime) - timePointer;
        
        if (gapBetween >= totalTimeNeeded) {
          availableSlots.push({
            start: new Date(timePointer),
            end: new Date(timePointer.getTime() + durationMinutes * 60 * 1000)
          });
        }
      }
      
      // Check if we can fit an appointment after the last appointment of the day
      if (appointmentsForDay.length > 0) {
        const lastAppointment = appointmentsForDay[appointmentsForDay.length - 1];
        timePointer = new Date(lastAppointment.endTime);
        
        const gapAfterLast = dayEnd - timePointer;
        if (gapAfterLast >= totalTimeNeeded) {
          availableSlots.push({
            start: new Date(timePointer),
            end: new Date(timePointer.getTime() + durationMinutes * 60 * 1000)
          });
        }
      }
    } else {
      // No appointments for this day, the entire day is available
      availableSlots.push({
        start: new Date(dayStart),
        end: new Date(dayStart.getTime() + durationMinutes * 60 * 1000)
      });
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return availableSlots;
};

export default {
  loadGoogleMapsAPI,
  calculateTravelTime,
  calculateOptimalSchedule,
  findAvailableTimeSlots
}; 