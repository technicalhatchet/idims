import { useOfflineSync } from '../../hooks/useOfflineSync';

/** ~36px — matches SyncBanner height when offline / pending */
export const SYNC_BANNER_OFFSET_PX = 36;

export const solomonSafeBottom = { paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' };

export function useSolomonTopInset() {
  const { pendingCount, isOnline } = useOfflineSync();
  const bannerOffset = !isOnline || pendingCount > 0 ? SYNC_BANNER_OFFSET_PX : 0;
  return {
    paddingTop: `calc(max(12px, env(safe-area-inset-top, 0px)) + ${bannerOffset}px)`,
    bannerOffset,
  };
}

export function useSolomonHeaderInset() {
  const { pendingCount, isOnline } = useOfflineSync();
  const bannerOffset = !isOnline || pendingCount > 0 ? SYNC_BANNER_OFFSET_PX : 0;
  return {
    paddingTop: `calc(max(12px, env(safe-area-inset-top, 0px)) + ${bannerOffset}px)`,
    paddingBottom: 12,
  };
}
