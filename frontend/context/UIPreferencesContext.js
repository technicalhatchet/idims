import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserSettings, updateUserSettings } from '../services/api/settingsApi';

const DEFAULT_PREFERENCES = {
  railPosition: 'right', // 'left' | 'right'
  displayName: '',
};

function readCachedPreferences() {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  return {
    railPosition: localStorage.getItem('ui_railPosition') || 'right',
    displayName: localStorage.getItem('ui_displayName') ?? '',
  };
}

const UIPreferencesContext = createContext(null);

export function UIPreferencesProvider({ children }) {
  const { user, isLoading: authLoading } = useUser();
  const [preferences, setPreferences] = useState(readCachedPreferences);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    async function loadPreferences() {
      const cachedRailPosition =
        typeof window !== 'undefined' ? localStorage.getItem('ui_railPosition') : null;
      const cachedDisplayName =
        typeof window !== 'undefined' ? localStorage.getItem('ui_displayName') : null;

      if (cachedRailPosition || cachedDisplayName) {
        setPreferences((prev) => ({
          ...prev,
          ...(cachedRailPosition ? { railPosition: cachedRailPosition } : {}),
          ...(cachedDisplayName != null ? { displayName: cachedDisplayName } : {}),
        }));
      }

      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getUserSettings();

        if (response?.ui_preferences) {
          const dbPrefs = response.ui_preferences;

          setPreferences((prev) => {
            const next = { ...prev };
            if (dbPrefs.railPosition != null) {
              next.railPosition = dbPrefs.railPosition || 'right';
            }
            if (Object.prototype.hasOwnProperty.call(dbPrefs, 'displayName')) {
              next.displayName = String(dbPrefs.displayName || '').trim();
            }
            return next;
          });

          if (typeof window !== 'undefined') {
            if (dbPrefs.railPosition != null) {
              localStorage.setItem('ui_railPosition', dbPrefs.railPosition || 'right');
            }
            if (Object.prototype.hasOwnProperty.call(dbPrefs, 'displayName')) {
              localStorage.setItem('ui_displayName', String(dbPrefs.displayName || '').trim());
            }
          }
        } else if (typeof window !== 'undefined' && !cachedRailPosition) {
          localStorage.setItem('ui_railPosition', 'right');
        }
      } catch (error) {
        setPreferences((prev) => ({
          ...prev,
          railPosition: prev.railPosition || 'right',
        }));
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    loadPreferences();
  }, [user, authLoading]);

  const setRailPosition = useCallback(
    async (position) => {
      const newPosition = position === 'left' ? 'left' : 'right';

      setPreferences((prev) => ({
        ...prev,
        railPosition: newPosition,
      }));

      if (typeof window !== 'undefined') {
        localStorage.setItem('ui_railPosition', newPosition);
      }

      if (!user) return;

      try {
        await updateUserSettings({
          ui_preferences: {
            railPosition: newPosition,
          },
        });
      } catch (error) {
        // localStorage already has the value
      }
    },
    [user],
  );

  const setDisplayName = useCallback(
    async (name) => {
      const trimmed = String(name || '').trim();

      setPreferences((prev) => ({
        ...prev,
        displayName: trimmed,
      }));

      if (typeof window !== 'undefined') {
        localStorage.setItem('ui_displayName', trimmed);
      }

      if (!user) return;

      try {
        await updateUserSettings({
          ui_preferences: {
            displayName: trimmed,
          },
        });
      } catch (error) {
        throw error;
      }
    },
    [user],
  );

  return (
    <UIPreferencesContext.Provider
      value={{
        preferences,
        setRailPosition,
        setDisplayName,
        isLoading,
      }}
    >
      {children}
    </UIPreferencesContext.Provider>
  );
}

export function useUIPreferences() {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error('useUIPreferences must be used within a UIPreferencesProvider');
  }
  return context;
}

export { UIPreferencesContext };
