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
          const dayData = hours[day] || {};
          normalized[day] = {
            regular: {
              enabled: dayData.regular?.enabled ?? dayData.enabled ?? false,
              start: dayData.regular?.start ?? dayData.open ?? '09:00',
              end: dayData.regular?.end ?? dayData.close ?? '17:00',
            },
            evening: {
              enabled: dayData.evening?.enabled ?? false,
              start: dayData.evening?.start ?? '17:00',
              end: dayData.evening?.end ?? '21:00',
            },
          };
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
  
  const d = typeof date === 'string' ? new Date(date) : date;
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
  return dayHours.regular?.enabled || dayHours.evening?.enabled;
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
  
  if (dayHours.regular?.enabled) {
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
  
  if (dayHours.evening?.enabled) {
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

export { DAYS_OF_WEEK, DEFAULT_DAY_HOURS };
