/**
 * Hook for loading and working with shop hours settings
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '../utils/api-client';

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DEFAULT_DAY_HOURS = {
  regular: { enabled: false, start: '09:00', end: '17:00' },
  evening: { enabled: false, start: '17:00', end: '21:00' },
};

/** Parse YYYY-MM-DD (or datetime) as local calendar date — avoids UTC day shift. */
export function parseLocalCalendarDate(date) {
  if (!date) return null;
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  }
  if (typeof date === 'string') {
    const datePart = date.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
}

function periodIsEnabled(period) {
  if (!period) return false;
  return period.enabled === true || period.enabled === 'true' || period.enabled === 1;
}

function resolveRegularEnabled(dayData) {
  if (dayData.regular?.enabled != null) {
    return Boolean(dayData.regular.enabled);
  }
  if (dayData.enabled != null) {
    return Boolean(dayData.enabled);
  }
  return Boolean(dayData.regular?.start || dayData.open);
}

function normalizeDayHours(dayData = {}) {
  return {
    regular: {
      enabled: resolveRegularEnabled(dayData),
      start: dayData.regular?.start ?? dayData.open ?? '09:00',
      end: dayData.regular?.end ?? dayData.close ?? '17:00',
    },
    evening: {
      enabled: Boolean(dayData.evening?.enabled),
      start: dayData.evening?.start ?? '17:00',
      end: dayData.evening?.end ?? '21:00',
    },
  };
}

/**
 * Hook to load and cache shop hours from settings
 */
export function useShopHours() {
  const [shopHours, setShopHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadShopHours() {
      try {
        const response = await apiClient('/api/settings');
        if (cancelled) return;
        
        const hours = response?.settings?.shop_hours || {};
        
        // Normalize the data structure
        const normalized = {};
        DAYS_OF_WEEK.forEach((day) => {
          normalized[day] = normalizeDayHours(hours[day] || {});
        });
        
        setShopHours(normalized);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[useShopHours] Error loading shop hours:', err);
        setError(err);
        setShopHours(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadShopHours();
    return () => { cancelled = true; };
  }, []);

  return { shopHours, loading, error };
}

/**
 * Get shop hours for a specific date
 * @param {Object} shopHours - Full shop hours object
 * @param {Date|string} date - The date to check
 * @returns {Object} Day's hours config { regular, evening }
 */
export function getShopHoursForDate(shopHours, date) {
  if (!shopHours || !date) return DEFAULT_DAY_HOURS;

  const d = parseLocalCalendarDate(date);
  if (!d) return DEFAULT_DAY_HOURS;
  const dayOfWeek = DAYS_OF_WEEK[d.getDay()];

  return shopHours[dayOfWeek] || DEFAULT_DAY_HOURS;
}

/**
 * Check if a specific day is open (has any hours enabled)
 * @param {Object} shopHours - Full shop hours object
 * @param {Date|string} date - The date to check
 * @returns {boolean}
 */
export function isDayOpen(shopHours, date) {
  const dayHours = getShopHoursForDate(shopHours, date);
  return periodIsEnabled(dayHours.regular) || periodIsEnabled(dayHours.evening);
}

/**
 * Get available time windows for a specific date
 * @param {Object} shopHours - Full shop hours object
 * @param {Date|string} date - The date to check
 * @returns {string[]} Array of available window names ['morning', 'afternoon', 'evening']
 */
export function getAvailableWindowsForDate(shopHours, date) {
  const dayHours = getShopHoursForDate(shopHours, date);
  const windows = [];
  
  if (periodIsEnabled(dayHours.regular)) {
    // Parse regular hours to determine which windows are available
    const [startH] = (dayHours.regular.start || '09:00').split(':').map(Number);
    const [endH] = (dayHours.regular.end || '17:00').split(':').map(Number);
    
    // Morning window: roughly 9 AM - 12:30 PM
    if (startH < 13 && endH > 9) {
      windows.push('morning');
    }
    
    // Afternoon window: roughly 12:30 PM - 5 PM
    if (startH < 17 && endH > 12) {
      windows.push('afternoon');
    }
  }
  
  if (periodIsEnabled(dayHours.evening)) {
    windows.push('evening');
  }
  
  return windows;
}

/**
 * Check if a specific time window is available on a date
 * @param {Object} shopHours - Full shop hours object
 * @param {Date|string} date - The date to check
 * @param {string} windowName - 'morning', 'afternoon', or 'evening'
 * @returns {boolean}
 */
export function isWindowAvailableForDate(shopHours, date, windowName) {
  const availableWindows = getAvailableWindowsForDate(shopHours, date);
  return availableWindows.includes(windowName);
}

/**
 * Hour range for scheduling day charts (regular + evening shop hours).
 * @returns {{ dayStartHour: number, dayEndHour: number }}
 */
export function getShopDayChartBounds(shopHours, date) {
  const dayHours = getShopHoursForDate(shopHours, date);

  const parseHour = (timeStr) => {
    const [h, m] = String(timeStr || '0:0').split(':').map(Number);
    return h + (m || 0) / 60;
  };

  const regularActive = periodIsEnabled(dayHours.regular);
  const eveningActive = periodIsEnabled(dayHours.evening);
  const hasRegularTimes = Boolean(dayHours.regular?.start && dayHours.regular?.end);

  let minH = parseHour('09:00');
  let maxH = parseHour('17:00');

  if (regularActive || hasRegularTimes) {
    minH = parseHour(dayHours.regular?.start || '09:00');
    maxH = parseHour(dayHours.regular?.end || '17:00');
  } else if (dayHours.open || dayHours.close) {
    minH = parseHour(dayHours.open || '09:00');
    maxH = parseHour(dayHours.close || '17:00');
  }

  if (eveningActive) {
    const eveningStart = parseHour(dayHours.evening?.start || '17:00');
    const eveningEnd = parseHour(dayHours.evening?.end || '21:00');
    if (!regularActive && !hasRegularTimes && !dayHours.open) {
      minH = eveningStart;
    } else {
      minH = Math.min(minH, eveningStart);
    }
    maxH = Math.max(maxH, eveningEnd);
  }

  return {
    dayStartHour: Math.floor(minH),
    dayEndHour: Math.ceil(maxH),
  };
}

export { DAYS_OF_WEEK, DEFAULT_DAY_HOURS };
