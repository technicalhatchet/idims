import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Must match backend FEATURE_FLAG_DEFINITIONS keys. */
export const WAVE1_FEATURE_FLAG_IDS = [
  'estimate_approval',
  'review_requests',
  'customer_media_uploads',
  'appliance_exports',
  'household_invites',
  'self_signup',
];

/** Fail-open: every registry flag ON (matches backend default_feature_flags). */
export function allWave1FeaturesEnabledSet() {
  return new Set(WAVE1_FEATURE_FLAG_IDS);
}

const FeatureFlagsContext = createContext({
  loaded: false,
  features: new Set(WAVE1_FEATURE_FLAG_IDS),
  refresh: async () => {},
});

async function fetchEnabledFeatures() {
  const failOpen = () => allWave1FeaturesEnabledSet();
  try {
    let token = null;
    try {
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      token = session?.accessToken || null;
    } catch {
      token = null;
    }

    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/').replace(/\/$/, '');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${base}/api/features`, { headers });
    if (!res.ok) {
      return failOpen();
    }
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.features)) {
      return failOpen();
    }
    return new Set(data.features);
  } catch {
    return failOpen();
  }
}

export function FeatureFlagsProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [features, setFeatures] = useState(() => allWave1FeaturesEnabledSet());

  const refresh = useCallback(async () => {
    try {
      const next = await fetchEnabledFeatures();
      setFeatures(next);
    } catch {
      setFeatures(allWave1FeaturesEnabledSet());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ loaded, features, refresh }), [loaded, features, refresh]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Fail-open: returns true while loading or when the flag id is unknown to the client registry.
 * Only hides UI after a successful fetch that omits the flag.
 */
export function useFeature(flagId) {
  const { features, loaded } = useContext(FeatureFlagsContext);
  if (!loaded || !WAVE1_FEATURE_FLAG_IDS.includes(flagId)) {
    return true;
  }
  return features.has(flagId);
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
