export const SOLOMON_HERO_DEBUG_KEY = 'solomon_hero_debug';
export const SOLOMON_HERO_DEBUG_EVENT = 'solomon-hero-debug-change';

export function isSolomonHeroDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(SOLOMON_HERO_DEBUG_KEY) === '1') return true;
    return new URLSearchParams(window.location.search).get('solomonDebug') === '1';
  } catch {
    return false;
  }
}

export function setSolomonHeroDebugEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem(SOLOMON_HERO_DEBUG_KEY, '1');
    } else {
      localStorage.removeItem(SOLOMON_HERO_DEBUG_KEY);
    }
    window.dispatchEvent(new CustomEvent(SOLOMON_HERO_DEBUG_EVENT));
  } catch {
    // ignore private mode / storage blocks
  }
}

export function toggleSolomonHeroDebug() {
  setSolomonHeroDebugEnabled(!isSolomonHeroDebugEnabled());
}
