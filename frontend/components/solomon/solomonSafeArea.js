import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useClientMounted } from '../../hooks/useClientMounted';
import { SOLOMON_BOTTOM_NAV_HEIGHT_PX } from './solomonNavigation';

/** ~36px — matches SyncBanner height when offline / pending */
export const SYNC_BANNER_OFFSET_PX = 36;

export const solomonSafeBottom = { paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' };

/** Main scroll area padding when Professional bottom nav is visible. */
export function solomonBottomNavScrollPadding(extraRem = 1.25) {
  return `calc(${SOLOMON_BOTTOM_NAV_HEIGHT_PX}px + ${extraRem}rem + env(safe-area-inset-bottom, 0px))`;
}

/** Main scroll area padding without bottom nav — home/footer breathing room. */
export function solomonFooterScrollPadding(minRem = 4) {
  return `max(${minRem}rem, env(safe-area-inset-bottom, 0px))`;
}

/** Wizard shell scroll padding — clears home indicator without bottom nav. */
export function solomonWizardScrollPadding() {
  return 'max(1rem, env(safe-area-inset-bottom, 0px))';
}

export function useSolomonTopInset() {
  const mounted = useClientMounted();
  const { pendingCount, isOnline } = useOfflineSync();
  const bannerOffset =
    mounted && (!isOnline || pendingCount > 0) ? SYNC_BANNER_OFFSET_PX : 0;
  return {
    paddingTop: `calc(max(12px, env(safe-area-inset-top, 0px)) + ${bannerOffset}px)`,
    bannerOffset,
  };
}

export function useSolomonHeaderInset() {
  const mounted = useClientMounted();
  const { pendingCount, isOnline } = useOfflineSync();
  const bannerOffset =
    mounted && (!isOnline || pendingCount > 0) ? SYNC_BANNER_OFFSET_PX : 0;
  return {
    paddingTop: `calc(max(12px, env(safe-area-inset-top, 0px)) + ${bannerOffset}px)`,
    paddingBottom: 12,
  };
}
