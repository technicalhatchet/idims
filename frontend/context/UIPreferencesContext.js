import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserSettings, updateUserSettings } from '../services/api/settingsApi';

const DEFAULT_PREFERENCES = {
  railPosition: 'right', // 'left' | 'right'
  displayName: '',
};

const UIPreferencesContext = createContext({
  preferences: DEFAULT_PREFERENCES,
  setRailPosition: () => {},
  setDisplayName: () => {},
  isLoading: true,
});

export function UIPreferencesProvider({ children }) {
  const router = useRouter();
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

      if (router.pathname.startsWith('/solomon')) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getUserSettings();

        if (response?.ui_preferences) {
          const dbPrefs = response.ui_preferences;
          const newPosition = dbPrefs.railPosition || 'right';
          const newDisplayName = dbPrefs.displayName || '';

          setPreferences((prev) => ({
            ...prev,
            railPosition: newPosition,
            displayName: newDisplayName,
          }));
          if (typeof window !== 'undefined') {
            localStorage.setItem('ui_railPosition', newPosition);
            localStorage.setItem('ui_displayName', newDisplayName);
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
  }, [mounted, user, authLoading, router.pathname]);

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
