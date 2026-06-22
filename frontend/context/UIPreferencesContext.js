import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    setMounted(true);
    
    async function loadPreferences() {
      try {
        // First check localStorage for cached value (faster initial load)
        const cachedRailPosition = typeof window !== 'undefined' 
          ? localStorage.getItem('ui_railPosition') 
          : null;
        
        if (cachedRailPosition) {
          setPreferences(prev => ({
            ...prev,
            railPosition: cachedRailPosition,
          }));
        }

        // Then try to load from database
        const response = await getUserSettings();
        if (response?.ui_preferences) {
          const dbPrefs = response.ui_preferences;
          setPreferences(prev => ({
            ...prev,
            railPosition: dbPrefs.railPosition || prev.railPosition,
          }));
          // Update localStorage cache
          if (typeof window !== 'undefined' && dbPrefs.railPosition) {
            localStorage.setItem('ui_railPosition', dbPrefs.railPosition);
          }
        }
      } catch (error) {
        console.log('[UIPreferences] Could not load from API, using cached/default:', error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  // Update rail position
  const setRailPosition = useCallback(async (position) => {
    const newPosition = position === 'left' ? 'left' : 'right';
    
    // Optimistically update local state
    setPreferences(prev => ({
      ...prev,
      railPosition: newPosition,
    }));
    
    // Update localStorage cache
    if (typeof window !== 'undefined') {
      localStorage.setItem('ui_railPosition', newPosition);
    }

    // Persist to database
    try {
      await updateUserSettings({
        ui_preferences: {
          railPosition: newPosition,
        },
      });
    } catch (error) {
      console.error('[UIPreferences] Failed to save to database:', error);
    }
  }, []);

  // Prevent flash while loading
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
