import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserSettings, updateUserSettings } from '../services/api/settingsApi';

const DEFAULT_PREFERENCES = {
  railPosition: 'right', // 'left' | 'right'
};

const UIPreferencesContext = createContext({
  preferences: DEFAULT_PREFERENCES,
  setRailPosition: () => {},
  isLoading: true,
});

export function UIPreferencesProvider({ children }) {
  const { user, isLoading: authLoading } = useUser();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || authLoading) return;

    async function loadPreferences() {
      const cachedRailPosition =
        typeof window !== 'undefined' ? localStorage.getItem('ui_railPosition') : null;

      if (cachedRailPosition) {
        setPreferences((prev) => ({
          ...prev,
          railPosition: cachedRailPosition,
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
          const newPosition = dbPrefs.railPosition || 'right';

          setPreferences((prev) => ({
            ...prev,
            railPosition: newPosition,
          }));
          if (typeof window !== 'undefined') {
            localStorage.setItem('ui_railPosition', newPosition);
          }
        } else if (typeof window !== 'undefined') {
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
  }, [mounted, user, authLoading]);

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

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <UIPreferencesContext.Provider
      value={{
        preferences,
        setRailPosition,
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
