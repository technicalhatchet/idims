import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { techdeckQueryKeys, fetchTechdeckFeatureFlags } from '../lib/techdeckQueries';

/** Must match backend FEATURE_FLAG_DEFINITIONS keys. */
export const WAVE1_FEATURE_FLAG_IDS = [
  'estimate_approval',
  'review_requests',
  'customer_media_uploads',
  'appliance_exports',
  'household_invites',
  'self_signup',
];

export const WAVE2_FEATURE_FLAG_IDS = [
  'recall_alerts',
  'appliance_age',
  'parts_links',
  'maintenance_reminders',
];

export const ALL_FEATURE_FLAG_IDS = [...WAVE1_FEATURE_FLAG_IDS, ...WAVE2_FEATURE_FLAG_IDS];

/** Fail-open: every registry flag ON (matches backend default_feature_flags). */
export function allWave1FeaturesEnabledSet() {
  return new Set(ALL_FEATURE_FLAG_IDS);
}

function warnFeaturesFetch(message, detail) {
  if (detail !== undefined) {
    console.warn(`[FeatureFlags] ${message}`, detail);
  } else {
    console.warn(`[FeatureFlags] ${message}`);
  }
}

const FeatureFlagsContext = createContext({
  loaded: false,
  features: allWave1FeaturesEnabledSet(),
  refresh: async () => {},
});

const FEATURES_STALE_MS = 5 * 60 * 1000;

export function FeatureFlagsProvider({ children }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: techdeckQueryKeys.features(),
    queryFn: async () => {
      try {
        return await fetchTechdeckFeatureFlags();
      } catch (err) {
        warnFeaturesFetch('GET /api/features failed; using fail-open defaults.', err);
        return allWave1FeaturesEnabledSet();
      }
    },
    staleTime: FEATURES_STALE_MS,
  });

  const features = query.data ?? allWave1FeaturesEnabledSet();
  const loaded = query.isFetched;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: techdeckQueryKeys.features() });
  }, [queryClient]);

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
  if (!loaded || !ALL_FEATURE_FLAG_IDS.includes(flagId)) {
    return true;
  }
  return features.has(flagId);
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
